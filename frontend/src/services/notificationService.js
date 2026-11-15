// DEMO NOTIFICATIONS. No real email is sent yet: every message is saved in this
// browser so the pages can show what was sent. When the Spring Boot API is ready,
// replace the bodies with fetch calls (for example POST /api/notifications).

const KEY = "eventhub.notifications"
const LIMIT = 200

function readAll() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]")
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function save(notification) {
  const record = {
    id: `n-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    status: "SENT",
    createdAt: new Date().toISOString(),
    ...notification,
  }
  try {
    localStorage.setItem(KEY, JSON.stringify([record, ...readAll()].slice(0, LIMIT)))
  } catch {
    /* storage blocked: the message log just will not be kept */
  }
  return record
}

/** Notification.sendEmail(): a normal message to one person or a group. */
export async function sendEmail({ eventId, to, recipients = 1, subject, message }) {
  return save({ kind: "EMAIL", eventId: String(eventId), to, recipients, subject, message })
}

/** Notification.sendTicket(): emails the ticket code after a registration is approved. */
export async function sendTicket({ eventId, to, ticketCode, eventTitle }) {
  return save({
    kind: "TICKET",
    eventId: String(eventId),
    to,
    recipients: 1,
    subject: `Your ticket for ${eventTitle}`,
    message: `Your registration is approved. Ticket code: ${ticketCode}`,
  })
}

/** Messages sent for one event, newest first. */
export async function listNotifications(eventId) {
  return readAll().filter((item) => item.eventId === String(eventId))
}
