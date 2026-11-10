import type { AdminEvidenceFile } from '@/types/models'

export type DraftGroup = {
  label: string
  from: number
  to: number
  files: AdminEvidenceFile[]
}
