export type MemberProfile = {
  hobbies: string[]
  interests: string[]
  origin: string
  occupation: string
  major: string
  city: string
  workplace_or_campus: string
  tech_stack: string[]
  looking_for: string[]
  free_text: string
}

export const EMPTY_PROFILE: MemberProfile = {
  hobbies: [],
  interests: [],
  origin: '',
  occupation: '',
  major: '',
  city: '',
  workplace_or_campus: '',
  tech_stack: [],
  looking_for: [],
  free_text: '',
}

export const MAX_INTERVIEW_TURNS = 8
export const READY_COMPLETENESS = 0.8

export function interviewSystemPrompt(eventTitle: string, city: string | null): string {
  return `You are PEPS, a friendly onboarding interviewer for Google Developer Groups events.
Event: ${eventTitle}${city ? ` in ${city}` : ''}.
Your job: ask SHORT dynamic follow-up questions to learn hobbies, interests, origin, occupation, major/jurusan, city, workplace/campus, tech stack, and what they want to find at this event.
Rules:
- Ask ONE question at a time.
- Be warm and concise (max 2 short sentences + one question).
- Prefer Indonesian if the user writes Indonesian; otherwise English.
- Extract structured fields from the latest user answer.
- completeness is 0..1 based on how many useful fields are filled.
- Set done=true when completeness >= ${READY_COMPLETENESS} OR you have enough for good matching (max ${MAX_INTERVIEW_TURNS} turns).
Return ONLY JSON:
{
  "assistant_message": "...",
  "extracted_fields": {
    "hobbies": [],
    "interests": [],
    "origin": "",
    "occupation": "",
    "major": "",
    "city": "",
    "workplace_or_campus": "",
    "tech_stack": [],
    "looking_for": [],
    "free_text": ""
  },
  "completeness": 0.0,
  "done": false
}`
}

export function matchExplainPrompt(
  seekerName: string,
  seekerProfileText: string,
  candidates: Array<{ uid: string; display_name: string; profile_text: string; score: number }>,
): string {
  return `You help strangers at a GDG event start conversations.
Seeker: ${seekerName}
Seeker profile:
${seekerProfileText}

Candidates (already ranked by similarity score 0..1):
${JSON.stringify(candidates, null, 2)}

For each candidate write a short reason (why they match) and one friendly icebreaker line (Indonesian OK).
Return ONLY JSON:
{"matches":[{"uid":"...","display_name":"...","score":0.0,"reason":"...","icebreaker":"..."}]}`
}

export function searchParsePrompt(query: string): string {
  return `Parse this natural-language people search for a GDG event networking app.
Query: ${query}
Return ONLY JSON:
{
  "keywords": ["..."],
  "must_have": ["..."],
  "city": "",
  "occupation": "",
  "tech_stack": [],
  "rewritten_profile_text": "a short synthetic profile describing who they want to find"
}`
}

export function buildProfileText(profile: MemberProfile, displayName: string): string {
  const parts = [
    `Name: ${displayName}`,
    profile.occupation && `Occupation: ${profile.occupation}`,
    profile.major && `Major: ${profile.major}`,
    profile.origin && `Origin: ${profile.origin}`,
    profile.city && `City: ${profile.city}`,
    profile.workplace_or_campus && `Workplace/campus: ${profile.workplace_or_campus}`,
    profile.hobbies.length && `Hobbies: ${profile.hobbies.join(', ')}`,
    profile.interests.length && `Interests: ${profile.interests.join(', ')}`,
    profile.tech_stack.length && `Tech: ${profile.tech_stack.join(', ')}`,
    profile.looking_for.length && `Looking for: ${profile.looking_for.join(', ')}`,
    profile.free_text && `Notes: ${profile.free_text}`,
  ].filter(Boolean)
  return parts.join('\n')
}

export function mergeProfile(
  base: MemberProfile,
  extracted: Partial<MemberProfile> | Record<string, unknown> | null | undefined,
): MemberProfile {
  if (!extracted || typeof extracted !== 'object') return base
  const next: MemberProfile = { ...base }

  const mergeList = (key: keyof MemberProfile) => {
    const raw = extracted[key]
    if (!Array.isArray(raw)) return
    const incoming = raw.map((v) => String(v).trim()).filter(Boolean)
    const set = new Set([...(base[key] as string[]), ...incoming])
    ;(next as Record<string, unknown>)[key] = [...set].slice(0, 20)
  }

  const mergeStr = (key: keyof MemberProfile) => {
    const raw = extracted[key]
    if (typeof raw !== 'string') return
    const value = raw.trim()
    if (value) (next as Record<string, unknown>)[key] = value
  }

  mergeList('hobbies')
  mergeList('interests')
  mergeList('tech_stack')
  mergeList('looking_for')
  mergeStr('origin')
  mergeStr('occupation')
  mergeStr('major')
  mergeStr('city')
  mergeStr('workplace_or_campus')
  if (typeof extracted.free_text === 'string' && extracted.free_text.trim()) {
    next.free_text = [base.free_text, extracted.free_text.trim()].filter(Boolean).join(' ').slice(0, 800)
  }
  return next
}

export function estimateCompleteness(profile: MemberProfile): number {
  let score = 0
  if (profile.hobbies.length) score += 0.12
  if (profile.interests.length) score += 0.12
  if (profile.tech_stack.length) score += 0.14
  if (profile.looking_for.length) score += 0.12
  if (profile.occupation) score += 0.1
  if (profile.major) score += 0.08
  if (profile.city || profile.origin) score += 0.1
  if (profile.workplace_or_campus) score += 0.08
  if (profile.free_text) score += 0.14
  return Math.min(1, Number(score.toFixed(2)))
}
