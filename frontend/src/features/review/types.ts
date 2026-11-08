export type Phase = 'loading' | 'question' | 'answer' | 'done' | 'error'

/** 与后端 `_phase` 的取值保持一致（snake_case），不要使用 camelCase 比较。 */
export type ReviewPhase = 'review' | 'review_quota' | 'new_quota' | 'paused' | 'done'

const REVIEW_PHASES: readonly ReviewPhase[] = [
  'review',
  'review_quota',
  'new_quota',
  'paused',
  'done',
]

export function toReviewPhase(value: string | null | undefined): ReviewPhase | null {
  return REVIEW_PHASES.includes(value as ReviewPhase) ? (value as ReviewPhase) : null
}

export type CardAction = 'bury' | 'suspend' | 'flag'

export const CARD_ACTION_LABELS: Record<CardAction, string> = {
  bury: '埋藏',
  suspend: '暂停',
  flag: '标记',
}

export const RATING_HINTS: Record<number, string> = { 1: '忘记', 2: '模糊', 3: '记得', 4: '简单' }

export const STATE_LABELS: Record<string, string> = {
  new: '新卡',
  learning: '学习中',
  review: '复习',
  relearning: '重学',
  unknown: '未知',
}
