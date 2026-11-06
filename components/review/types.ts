/** 复习功能与 anki-svc 之间的数据形状（见 anki-svc/server.py 与 app/api/review/*）。 */

export interface ReviewQuestion {
  title: string;
  aliases: string[];
  summary: string[];
  note: string;
  pages: string;
  answerHtml: string;
  topic: string;
  topicId: string;
}

export interface ReviewCard {
  card_id: number;
  qid: string;
  state: 'new' | 'learning' | 'review' | 'relearning' | 'unknown';
  labels: string[];
  question: ReviewQuestion | null;
}

export interface ReviewCounts {
  new: number;
  learning: number;
  review: number;
}

export interface ReviewDay {
  date: string;
  count: number;
}

export interface ReviewStats {
  counts: ReviewCounts;
  /** 今日学过的卡片数（按卡去重，不是复习次数） */
  today: number;
  /** 今日学过的新卡数 */
  today_new: number;
  /** 今日复习过的到期卡数（不含新卡的学习步骤） */
  today_review: number;
  new_per_day: number;
  rev_per_day: number;
  streak: number;
  total_reviews: number;
  total_cards: number;
  next_due_epoch: number | null;
  can_undo: boolean;
  /** 还没学过的新卡总数 */
  new_remaining: number;
  days: ReviewDay[];
}

export interface ReviewConfig {
  deck: string;
  new_per_day: number;
  rev_per_day: number;
  learning_steps: number[] | null;
  fsrs_enabled: boolean;
}

export type ApiResult<T> = T & { ok: boolean; error?: string };
