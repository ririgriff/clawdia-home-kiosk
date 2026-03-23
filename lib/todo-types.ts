import type { TodoAssignee } from '@/config/family'
export type { TodoAssignee }
export type TodoSource = 'manual' | 'agent' | 'auto'

export { TODO_ASSIGNEES, ASSIGNEE_STYLE } from '@/config/family'

export interface ITodoItem {
  _id:        string
  title:      string
  date?:      string         // YYYY-MM-DD — omit for general/undated items
  assignee?:  TodoAssignee
  done:       boolean
  doneAt?:    string         // ISO string — set when done, cleared on undo
  source:     TodoSource
  /** Stable dedup key used by auto-gen cron. Retained (not cleared) when
   *  item is converted to manual so the cron won't recreate it. */
  autoGenKey?: string
  createdAt:  string
  updatedAt:  string
}
