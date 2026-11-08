import { apiGet, apiSend } from '@/shared/api/client'
import type {
  AnswerPayload,
  AnswerResult,
  CardActionPayload,
  CardActionResult,
  CardAnswer,
  LapseList,
  ReviewQueue,
  ReviewStats,
  TouchPayload,
  TouchResult,
  UndoPayload,
  UndoResult,
} from '@/types/models'

export function fetchQueue(): Promise<ReviewQueue> {
  return apiGet<ReviewQueue>('/api/review/queue', { limit: 1 })
}

export function fetchStats(): Promise<ReviewStats> {
  return apiGet<ReviewStats>('/api/review/stats')
}

export function fetchLapses(): Promise<LapseList> {
  return apiGet<LapseList>('/api/review/lapses')
}

export function fetchCardAnswer(qid: string): Promise<CardAnswer> {
  return apiGet<CardAnswer>('/api/review/card-answer', { qid })
}

export function submitAnswer(payload: AnswerPayload): Promise<AnswerResult> {
  return apiSend<AnswerResult>('POST', '/api/review/answer', payload)
}

export function touchCard(payload: TouchPayload): Promise<TouchResult> {
  return apiSend<TouchResult>('POST', '/api/review/touch', payload)
}

export function undoAnswer(payload: UndoPayload): Promise<UndoResult> {
  return apiSend<UndoResult>('POST', '/api/review/undo', payload)
}

export function submitCardAction(payload: CardActionPayload): Promise<CardActionResult> {
  return apiSend<CardActionResult>('POST', '/api/review/card-action', payload)
}
