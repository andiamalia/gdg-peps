import { httpsCallable } from 'firebase/functions'
import { getFirebaseFunctions, type CircleMatch, type MemberProfile } from './firebase'

export type InterviewTurnResult = {
  assistant_message: string
  completeness: number
  done: boolean
  profile_preview: Partial<MemberProfile> | null
}

export type FindCircleResult = {
  matches: CircleMatch[]
}

export async function interviewTurn(params: {
  eventId: string
  message?: string
  restart?: boolean
}): Promise<InterviewTurnResult> {
  const callable = httpsCallable<
    { event_id: string; message?: string; restart?: boolean },
    InterviewTurnResult
  >(getFirebaseFunctions(), 'interviewTurn')
  const result = await callable({
    event_id: params.eventId,
    message: params.message,
    restart: params.restart,
  })
  return result.data
}

export async function finalizeProfile(params: { eventId: string }): Promise<{
  completeness: number
  done: boolean
}> {
  const callable = httpsCallable<{ event_id: string }, { completeness: number; done: boolean }>(
    getFirebaseFunctions(),
    'finalizeProfile',
  )
  const result = await callable({ event_id: params.eventId })
  return result.data
}

export async function findCircle(params: {
  eventId: string
  limit?: number
  source?: 'shake' | 'button'
}): Promise<FindCircleResult> {
  const callable = httpsCallable<
    { event_id: string; limit?: number; source?: string },
    FindCircleResult
  >(getFirebaseFunctions(), 'findCircle')
  const result = await callable({
    event_id: params.eventId,
    limit: params.limit,
    source: params.source ?? 'button',
  })
  return result.data
}

export async function searchCircle(params: {
  eventId: string
  query: string
}): Promise<FindCircleResult> {
  const callable = httpsCallable<{ event_id: string; query: string }, FindCircleResult>(
    getFirebaseFunctions(),
    'searchCircle',
  )
  const result = await callable({
    event_id: params.eventId,
    query: params.query,
  })
  return result.data
}
