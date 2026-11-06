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

export interface ReviewBackup {
  name: string;
  size: number;
  at: number;
  count: number;
}

export interface ReviewStats {
  counts: ReviewCounts;
  /** 真正到期、未被日限额截断的卡片数 */
  due_total: number;
  /** 今日学过的卡片数（按卡去重，不是复习次数） */
  today: number;
  /** 今日学过的新卡数 */
  today_new: number;
  /** 今日复习过的到期卡数（不含今天新学的卡） */
  today_review: number;
  /** 今日重学（答错后重新学习）的卡片数 */
  today_relearn: number;
  new_per_day: number;
  rev_per_day: number;
  streak: number;
  /** 复习次数（type=1/2，不含新卡学习步骤） */
  total_reviews: number;
  /** revlog 总条数，仅用于说明「评分次数」 */
  total_answers: number;
  total_cards: number;
  next_due_epoch: number | null;
  can_undo: boolean;
  /** 还没学过的新卡总数 */
  new_remaining: number;
  last_backup: ReviewBackup | null;
  days: ReviewDay[];
}

export interface ReviewConfig {
  deck: string;
  new_per_day: number;
  rev_per_day: number;
  learning_steps: number[] | null;
  fsrs_enabled: boolean;
  new_order?: number;
}

export type ApiResult<T> = T & { ok: boolean; error?: string };
