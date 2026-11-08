const CLIENT_KEY = 'review-client-id'

/** 每个标签页一个稳定标识：撤销只作用于本标签页的最近一次评分。 */
export function currentClientId(): string {
  try {
    const existing = sessionStorage.getItem(CLIENT_KEY)
    if (existing) return existing
    const created = crypto.randomUUID()
    sessionStorage.setItem(CLIENT_KEY, created)
    return created
  } catch {
    return 'default'
  }
}
