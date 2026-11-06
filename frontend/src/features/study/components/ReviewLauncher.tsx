import { Link } from 'react-router-dom'

import { BookIcon } from '@/shared/components/Icons'

export function ReviewLauncher() {
  return (
    <Link className="review-launcher" to="/review">
      <BookIcon className="icon" />
      <span>
        <strong>开始复习</strong>
        <small>按记忆曲线抽题</small>
      </span>
    </Link>
  )
}
