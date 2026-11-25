import { db } from '../db'

export interface NotificationItem {
  id: number
  title: string
  createdAt: Date
  read: boolean
}

export const DEFAULT_LIST_LIMIT = 50

export function useNotifications(customerId: number) {
  async function list(limit = DEFAULT_LIST_LIMIT): Promise<NotificationItem[]> {
    return db.query<NotificationItem>(
      'SELECT id, title, created_at AS "createdAt", read FROM notifications WHERE customer_id = $1 ORDER BY created_at DESC LIMIT $2',
      [customerId, limit],
    )
  }

  async function open(id: number): Promise<void> {
    await db.execute('UPDATE notifications SET read = true WHERE id = $1 AND customer_id = $2', [id, customerId])
  }

  return { list, open }
}
