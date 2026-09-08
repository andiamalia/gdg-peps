import { VertexAI } from '@google-cloud/vertexai'
import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { cosineSimilarity, embedTextSafe } from './embeddings'
import {
  buildProfileText,
  EMPTY_PROFILE,
  estimateCompleteness,
  interviewSystemPrompt,
  matchExplainPrompt,
  MAX_INTERVIEW_TURNS,
  mergeProfile,
  READY_COMPLETENESS,
  searchParsePrompt,
  type MemberProfile,
} from './prompts'

initializeApp()

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'gen-lang-client-0137104290'
const VERTEX_LOCATION = 'global'
const VERTEX_API_ENDPOINT = 'aiplatform.googleapis.com'
const VERTEX_MODEL = 'gemini-3.1-flash-lite'
const MEMBER_CAP = 200

type InterviewRequest = {
  event_id?: string
  message?: string
  restart?: boolean
}

type FindRequest = {
  event_id?: string
  limit?: number
  source?: string
}

type SearchRequest = {
  event_id?: string
  query?: string
}

type CircleMatch = {
  uid: string
  display_name: string
  score: number
  reason: string
  icebreaker: string
}

function requireAuth(uid: string | undefined): string {
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.')
  return uid
}

function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```json|```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('Model did not return JSON')
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>
}

function getVertexModel() {
  const vertex = new VertexAI({
    project: PROJECT_ID,
    location: VERTEX_LOCATION,
    apiEndpoint: VERTEX_API_ENDPOINT,
  })
  return vertex.getGenerativeModel({ model: VERTEX_MODEL })
}

async function generateJson(prompt: string): Promise<Record<string, unknown>> {
  const model = getVertexModel()
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  })
  const text =
    result.response.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  return parseJsonObject(text)
}

function asProfile(data: Record<string, unknown> | undefined): MemberProfile {
  const p = (data?.profile ?? {}) as Partial<MemberProfile>
  return mergeProfile(EMPTY_PROFILE, p)
}

async function finalizeMember(params: {
  eventId: string
  uid: string
  profile: MemberProfile
  displayName: string
  completeness: number
}): Promise<void> {
  const profileText = buildProfileText(params.profile, params.displayName)
  const embedding = await embedTextSafe(profileText)
  const db = getFirestore()
  await db.doc(`events/${params.eventId}/members/${params.uid}`).set(
    {
      profile: params.profile,
      profile_text: profileText,
      embedding,
      completeness: params.completeness,
      interview_status: 'ready',
    },
    { merge: true },
  )
}

async function explainMatches(params: {
  seekerName: string
  seekerProfileText: string
  ranked: Array<{ uid: string; display_name: string; profile_text: string; score: number }>
}): Promise<CircleMatch[]> {
  if (params.ranked.length === 0) return []
  try {
    const parsed = await generateJson(
      matchExplainPrompt(params.seekerName, params.seekerProfileText, params.ranked),
    )
    const raw = Array.isArray(parsed.matches) ? parsed.matches : []
    const byUid = new Map(params.ranked.map((r) => [r.uid, r]))
    return raw
      .map((item) => {
        const row = item as Record<string, unknown>
        const uid = String(row.uid ?? '')
        const base = byUid.get(uid)
        if (!base) return null
        return {
          uid,
          display_name: String(row.display_name ?? base.display_name),
          score: Number(row.score ?? base.score),
          reason: String(row.reason ?? 'Shared interests at this event.'),
          icebreaker: String(row.icebreaker ?? `Hi ${base.display_name}! Nice to meet you at this GDG event.`),
        } satisfies CircleMatch
      })
      .filter((m): m is CircleMatch => Boolean(m))
      .slice(0, params.ranked.length)
  } catch {
    return params.ranked.map((r) => ({
      uid: r.uid,
      display_name: r.display_name,
      score: r.score,
      reason: 'Similar profile signals in this event room.',
      icebreaker: `Hi ${r.display_name}! What brought you to this meetup?`,
    }))
  }
}

async function rankMembers(params: {
  eventId: string
  seekerUid: string
  seekerEmbedding: number[]
  seekerProfileText: string
  seekerName: string
  limit: number
  queryEmbedding?: number[]
  keywordBoost?: string[]
}): Promise<CircleMatch[]> {
  const db = getFirestore()
  const snap = await db.collection(`events/${params.eventId}/members`).limit(MEMBER_CAP).get()
  const scored: Array<{ uid: string; display_name: string; profile_text: string; score: number }> =
    []

  for (const doc of snap.docs) {
    if (doc.id === params.seekerUid) continue
    const data = doc.data()
    if (data.interview_status !== 'ready') continue
    const embedding = Array.isArray(data.embedding) ? (data.embedding as number[]) : []
    const profileText = String(data.profile_text ?? '')
    const displayName = String(data.display_name ?? 'Member')
    let score = cosineSimilarity(params.seekerEmbedding, embedding)
    if (params.queryEmbedding?.length) {
      const q = cosineSimilarity(params.queryEmbedding, embedding)
      score = score * 0.35 + q * 0.65
    }
    if (params.keywordBoost?.length && profileText) {
      const lower = profileText.toLowerCase()
      const hits = params.keywordBoost.filter((k) => lower.includes(k.toLowerCase())).length
      score += Math.min(0.2, hits * 0.04)
    }
    scored.push({ uid: doc.id, display_name: displayName, profile_text: profileText, score })
  }

  scored.sort((a, b) => b.score - a.score)
  const top = scored.slice(0, Math.max(1, Math.min(params.limit, 8)))
  return explainMatches({
    seekerName: params.seekerName,
    seekerProfileText: params.seekerProfileText,
    ranked: top,
  })
}

export const interviewTurn = onCall({ cors: true }, async (request) => {
  const uid = requireAuth(request.auth?.uid)
  const data = request.data as InterviewRequest
  const eventId = String(data.event_id ?? '')
  const message = typeof data.message === 'string' ? data.message.trim() : ''
  const restart = Boolean(data.restart)
  if (!eventId) throw new HttpsError('invalid-argument', 'event_id is required.')

  const db = getFirestore()
  const eventRef = db.doc(`events/${eventId}`)
  const memberRef = db.doc(`events/${eventId}/members/${uid}`)
  const [eventSnap, memberSnap] = await Promise.all([eventRef.get(), memberRef.get()])
  if (!eventSnap.exists) throw new HttpsError('not-found', 'Event not found.')
  if (!memberSnap.exists) throw new HttpsError('failed-precondition', 'Join the event first.')

  const event = eventSnap.data() as { title?: string; city?: string | null }
  const member = (memberSnap.data() ?? {}) as Record<string, unknown>
  const displayName = String(member.display_name ?? 'Friend')
  let profile = asProfile(member)
  let turns = Number(member.interview_turns ?? 0)

  if (restart) {
    profile = { ...EMPTY_PROFILE }
    turns = 0
    const msgs = await memberRef.collection('interview_messages').listDocuments()
    await Promise.all(msgs.map((d) => d.delete()))
    await memberRef.set(
      {
        profile,
        profile_text: FieldValue.delete(),
        embedding: FieldValue.delete(),
        completeness: 0,
        interview_status: 'in_progress',
        interview_turns: 0,
      },
      { merge: true },
    )
  }

  const historySnap = await memberRef
    .collection('interview_messages')
    .orderBy('created_at', 'asc')
    .limit(24)
    .get()
  const history = historySnap.docs.map((d) => d.data() as { role: string; text: string })

  if (message) {
    turns += 1
    await memberRef.collection('interview_messages').add({
      role: 'user',
      text: message,
      created_at: Date.now(),
    })
    history.push({ role: 'user', text: message })
  }

  const prompt = `${interviewSystemPrompt(String(event.title ?? 'GDG event'), event.city ?? null)}

Current profile JSON:
${JSON.stringify(profile, null, 2)}

Interview turn count: ${turns} / ${MAX_INTERVIEW_TURNS}

Conversation:
${history.map((h) => `${h.role}: ${h.text}`).join('\n') || '(start now with a warm first question)'}

${message ? 'Incorporate the latest user message into extracted_fields.' : 'Ask the first question. extracted_fields may be empty.'}`

  let parsed: Record<string, unknown>
  try {
    parsed = await generateJson(prompt)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gemini interview failed'
    throw new HttpsError('internal', msg)
  }

  const assistantMessage = String(parsed.assistant_message ?? '').trim()
  if (!assistantMessage) throw new HttpsError('internal', 'Empty assistant message.')

  profile = mergeProfile(profile, parsed.extracted_fields as Partial<MemberProfile>)
  let completeness = Math.max(
    estimateCompleteness(profile),
    Number(parsed.completeness ?? 0) || 0,
  )
  completeness = Math.min(1, completeness)
  let done =
    Boolean(parsed.done) || completeness >= READY_COMPLETENESS || turns >= MAX_INTERVIEW_TURNS

  await memberRef.collection('interview_messages').add({
    role: 'assistant',
    text: assistantMessage,
    created_at: Date.now(),
  })

  await memberRef.set(
    {
      profile,
      completeness,
      interview_turns: turns,
      interview_status: done ? 'ready' : 'in_progress',
    },
    { merge: true },
  )

  if (done) {
    await finalizeMember({
      eventId,
      uid,
      profile,
      displayName,
      completeness: Math.max(completeness, READY_COMPLETENESS),
    })
  }

  return {
    assistant_message: assistantMessage,
    completeness,
    done,
    profile_preview: profile,
  }
})

export const finalizeProfile = onCall({ cors: true }, async (request) => {
  const uid = requireAuth(request.auth?.uid)
  const eventId = String((request.data as { event_id?: string }).event_id ?? '')
  if (!eventId) throw new HttpsError('invalid-argument', 'event_id is required.')

  const db = getFirestore()
  const memberRef = db.doc(`events/${eventId}/members/${uid}`)
  const snap = await memberRef.get()
  if (!snap.exists) throw new HttpsError('not-found', 'Member not found.')
  const data = (snap.data() ?? {}) as Record<string, unknown>
  const profile = asProfile(data)
  const completeness = Math.max(estimateCompleteness(profile), Number(data.completeness ?? 0))
  await finalizeMember({
    eventId,
    uid,
    profile,
    displayName: String(data.display_name ?? 'Friend'),
    completeness,
  })
  return { completeness, done: true }
})

export const findCircle = onCall({ cors: true }, async (request) => {
  const uid = requireAuth(request.auth?.uid)
  const data = request.data as FindRequest
  const eventId = String(data.event_id ?? '')
  const limit = Number(data.limit ?? 5)
  const source = data.source === 'shake' ? 'shake' : 'button'
  if (!eventId) throw new HttpsError('invalid-argument', 'event_id is required.')

  const db = getFirestore()
  const memberSnap = await db.doc(`events/${eventId}/members/${uid}`).get()
  if (!memberSnap.exists) throw new HttpsError('not-found', 'Member not found.')
  const member = (memberSnap.data() ?? {}) as Record<string, unknown>
  if (member.interview_status !== 'ready' || !Array.isArray(member.embedding)) {
    throw new HttpsError('failed-precondition', 'Complete the interview first.')
  }

  const matches = await rankMembers({
    eventId,
    seekerUid: uid,
    seekerEmbedding: member.embedding as number[],
    seekerProfileText: String(member.profile_text ?? ''),
    seekerName: String(member.display_name ?? 'Friend'),
    limit,
  })

  await db.collection(`events/${eventId}/matches`).add({
    from_uid: uid,
    to_uids: matches.map((m) => m.uid),
    scores: matches.map((m) => m.score),
    created_at: Date.now(),
    source,
  })

  return { matches }
})

export const searchCircle = onCall({ cors: true }, async (request) => {
  const uid = requireAuth(request.auth?.uid)
  const data = request.data as SearchRequest
  const eventId = String(data.event_id ?? '')
  const query = String(data.query ?? '').trim()
  if (!eventId) throw new HttpsError('invalid-argument', 'event_id is required.')
  if (!query) throw new HttpsError('invalid-argument', 'query is required.')

  const db = getFirestore()
  const memberSnap = await db.doc(`events/${eventId}/members/${uid}`).get()
  if (!memberSnap.exists) throw new HttpsError('not-found', 'Member not found.')
  const member = (memberSnap.data() ?? {}) as Record<string, unknown>
  if (member.interview_status !== 'ready' || !Array.isArray(member.embedding)) {
    throw new HttpsError('failed-precondition', 'Complete the interview first.')
  }

  let rewritten = query
  let keywords: string[] = query.split(/\s+/).filter((t) => t.length > 2)
  try {
    const parsed = await generateJson(searchParsePrompt(query))
    rewritten = String(parsed.rewritten_profile_text ?? query)
    if (Array.isArray(parsed.keywords)) {
      keywords = parsed.keywords.map((k) => String(k)).filter(Boolean)
    }
    if (Array.isArray(parsed.must_have)) {
      keywords = [...keywords, ...parsed.must_have.map((k) => String(k))]
    }
    if (Array.isArray(parsed.tech_stack)) {
      keywords = [...keywords, ...parsed.tech_stack.map((k) => String(k))]
    }
  } catch {
    // keep raw query keywords
  }

  const queryEmbedding = await embedTextSafe(rewritten)
  const matches = await rankMembers({
    eventId,
    seekerUid: uid,
    seekerEmbedding: member.embedding as number[],
    seekerProfileText: String(member.profile_text ?? ''),
    seekerName: String(member.display_name ?? 'Friend'),
    limit: 5,
    queryEmbedding,
    keywordBoost: keywords,
  })

  await db.collection(`events/${eventId}/matches`).add({
    from_uid: uid,
    to_uids: matches.map((m) => m.uid),
    scores: matches.map((m) => m.score),
    created_at: Date.now(),
    source: 'search',
    query,
  })

  return { matches }
})
