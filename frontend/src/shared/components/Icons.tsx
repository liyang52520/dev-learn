/** 线性图标：全部使用 currentColor，尺寸由 className 控制。 */

import type { ReactNode } from 'react'

type IconProps = { className?: string }

function base(children: ReactNode, className?: string) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function SunIcon({ className }: IconProps) {
  return base(
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>,
    className,
  )
}

export function MoonIcon({ className }: IconProps) {
  return base(<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />, className)
}

export function SearchIcon({ className }: IconProps) {
  return base(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>,
    className,
  )
}

export function MenuIcon({ className }: IconProps) {
  return base(<path d="M4 7h16M4 12h16M4 17h16" />, className)
}

export function CloseIcon({ className }: IconProps) {
  return base(<path d="M6 6l12 12M18 6 6 18" />, className)
}

export function GithubIcon({ className }: IconProps) {
  return base(
    <path d="M9 19c-4 1.5-4-2.5-6-3m12 6v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 3.8 5.4 4.1 5.4 4.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 10.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V22" />,
    className,
  )
}

export function MailIcon({ className }: IconProps) {
  return base(
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6.5 8.5 6 8.5-6" />
    </>,
    className,
  )
}

export function ArrowLeftIcon({ className }: IconProps) {
  return base(<path d="M15 6l-6 6 6 6" />, className)
}

export function ArrowRightIcon({ className }: IconProps) {
  return base(<path d="M9 6l6 6-6 6" />, className)
}

export function ChevronRightIcon({ className }: IconProps) {
  return base(<path d="M9 6l6 6-6 6" />, className)
}

export function ChevronDownIcon({ className }: IconProps) {
  return base(<path d="m6 9 6 6 6-6" />, className)
}

export function ClockIcon({ className }: IconProps) {
  return base(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>,
    className,
  )
}

export function TagIcon({ className }: IconProps) {
  return base(
    <>
      <path d="M3 12V4h8l9 9-8 8-9-9Z" />
      <circle cx="7.5" cy="7.5" r="1.2" />
    </>,
    className,
  )
}

export function FolderIcon({ className }: IconProps) {
  return base(<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />, className)
}

export function BookIcon({ className }: IconProps) {
  return base(
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" />
      <path d="M4 5.5v15" />
    </>,
    className,
  )
}

export function UndoIcon({ className }: IconProps) {
  return base(<path d="M4 8h9a5 5 0 0 1 0 10H8M4 8l4-4M4 8l4 4" />, className)
}

export function ShuffleIcon({ className }: IconProps) {
  return base(<path d="M4 7h3l10 10h3M4 17h3l3-3M17 4l3 3-3 3M17 14l3 3-3 3" />, className)
}

export function CheckIcon({ className }: IconProps) {
  return base(<path d="m5 13 4 4L19 7" />, className)
}

export function SettingsIcon({ className }: IconProps) {
  return base(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </>,
    className,
  )
}

export function LogoutIcon({ className }: IconProps) {
  return base(
    <>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l5-5-5-5M15 12H3" />
    </>,
    className,
  )
}
