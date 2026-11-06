export type Phase = 'loading' | 'question' | 'answer' | 'done' | 'error'

export const RATING_HINTS: Record<number, string> = { 1: '忘记', 2: '模糊', 3: '记得', 4: '简单' }

export const STATE_LABELS: Record<string, string> = {
  new: '新卡',
  learning: '学习中',
  review: '复习',
  relearning: '重学',
  unknown: '未知',
}
