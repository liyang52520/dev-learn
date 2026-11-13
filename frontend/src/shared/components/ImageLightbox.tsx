import { useEffect } from 'react'

import { CloseIcon } from './Icons'

type Props = {
  src: string
  alt: string
  caption: string
  onClose: () => void
}

export function ImageLightbox({ src, alt, caption, onClose }: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="lightbox" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <button type="button" className="lightbox-close" onClick={onClose} aria-label="关闭">
        <CloseIcon className="icon" />
      </button>
      <figure onMouseDown={(event) => event.stopPropagation()}>
        <img src={src} alt={alt} />
        <figcaption>{caption}</figcaption>
      </figure>
    </div>
  )
}
