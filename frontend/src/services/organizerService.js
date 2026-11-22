// Organizer events through the backend (organizer id = the logged-in user):
//   GET/POST       /api/organizers/{id}/events
//   GET/PUT/DELETE /api/organizers/{id}/events/{eventId}
//   POST           /api/organizers/{id}/events/{eventId}/submit
//   POST           /api/images                (cover picture upload)
// An admin opening an event uses /api/admin/{id}/events/{eventId} instead.
import { api, toBackendDate } from "./api"
import { getSession, requireSession } from "./authService"
import { getCategories } from "./eventService"
import { toBooking, toEvent } from "./mappers"

function organizerPath() {
  const session = requireSession("ORGANIZER")
  return `/api/organizers/${session.id}`
}

function withOwner(event) {
  const session = getSession()
  return session?.role === "ORGANIZER"
    ? { organizerName: session.name, organizerEmail: session.email, ...event }
    : event
}

/** All events of the logged-in organizer. */
export async function getMyEvents() {
  const events = await api(`${organizerPath()}/events`)
  return events.map(toEvent).map(withOwner)
}

/** Every event on the platform (admin pages). */
export async function getAllEvents() {
  const admin = requireSession("ADMIN")
  const events = await api(`/api/admin/${admin.id}/events`)
  return events.map(toEvent)
}

/** A published event whose end time has passed is shown as COMPLETED. */
export function effectiveStatus(event) {
  if (event.status === "PUBLISHED" && new Date(event.endDate).getTime() < Date.now()) return "COMPLETED"
  return event.status
}

/** Only an admin can take an event down (unpublish), so organizers get false. */
export function canCancelEvent(event) {
  const session = getSession()
  if (session?.role !== "ADMIN") return false
  return effectiveStatus(event) === "PUBLISHED"
}

/** The backend has no "cancel" for organizers: an admin unpublishes instead. */
export async function cancelEvent() {
  throw new Error("Only an admin can take a published event down. Ask an admin to unpublish it.")
}

/** Month labels of the last 6 months, oldest first. */
function lastSixMonths() {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    return { key: `${date.getFullYear()}-${date.getMonth()}`, month: date.toLocaleString("en-GB", { month: "short" }) }
  })
}

/** Everything the organizer dashboard needs in one call. */
export async function getDashboardSummary() {
  const base = organizerPath()
  const events = await getMyEvents()
  const countByStatus = (status) => events.filter((event) => event.status === status).length

  // Registrations per month, from the real bookings of every event.
  const lists = await Promise.all(
    events.map((event) => api(`${base}/events/${event.id}/registrations`).catch(() => []))
  )
  const months = lastSixMonths()
  const counts = Object.fromEntries(months.map((m) => [m.key, 0]))
  for (const booking of lists.flat().map(toBooking)) {
    if (booking.status === "REJECTED" || booking.status === "CANCELLED") continue
    const date = new Date(booking.createdAt)
    const key = `${date.getFullYear()}-${date.getMonth()}`
    if (key in counts) counts[key] += booking.quantity
  }

  return {
    totalEvents: events.length,
    published: countByStatus("PUBLISHED"),
    pendingReview: countByStatus("PENDING_REVIEW"),
    totalRegistrations: events.reduce((sum, event) => sum + event.registrations, 0),
    registrationsByMonth: months.map((m) => ({ month: m.month, count: counts[m.key] })),
    events,
  }
}

/** The backend lets organizers edit DRAFT and REVISION_REQUIRED events. */
export function canEditEvent(event) {
  return event.status === "DRAFT" || event.status === "REVISION_REQUIRED"
}

/** The same two statuses can be sent to the admin. */
export function canSubmitForReview(event) {
  return canEditEvent(event)
}

export async function submitForReview(eventId) {
  return toEvent(await api(`${organizerPath()}/events/${eventId}/submit`, { method: "POST" }))
}

/** One event (the organizer's own, or any event for an admin), or null. */
export async function getOrganizerEvent(eventId) {
  const session = requireSession()
  const path =
    session.role === "ADMIN"
      ? `/api/admin/${session.id}/events/${eventId}`
      : `/api/organizers/${session.id}/events/${eventId}`
  try {
    return withOwner(toEvent(await api(path)))
  } catch (error) {
    if (error.status === 404) return null
    throw error
  }
}

/** Deletes an event (only possible while it has no registrations). */
export async function deleteEvent(eventId) {
  await api(`${organizerPath()}/events/${eventId}`, { method: "DELETE" })
}

/** The create page keeps the picture as a data: URL; the backend wants an uploaded file. */
async function uploadIfNeeded(imageUrl) {
  if (!imageUrl) return null
  if (!imageUrl.startsWith("data:") && !imageUrl.startsWith("blob:")) {
    // Already uploaded (http://localhost:8080/uploads/x.jpg) or a /images/ file.
    const at = imageUrl.indexOf("/uploads/")
    return at >= 0 ? imageUrl.slice(at) : imageUrl
  }
  const blob = await (await fetch(imageUrl)).blob()
  const form = new FormData()
  form.append("file", blob, `cover.${blob.type.split("/")[1] ?? "jpg"}`)
  const { path } = await api("/api/images", { method: "POST", form })
  return path
}

/**
 * Creates a new event or updates an editable one.
 * `submit: false` keeps it as DRAFT, `submit: true` also sends it for review.
 */
export async function saveEvent(form, { submit, eventId = null }) {
  const base = organizerPath()
  const categories = await getCategories()
  const category = categories.find((item) => item.name === form.category)

  const body = {
    name: form.title.trim(),
    categoryId: category?.id ?? null,
    imagePath: await uploadIfNeeded(form.imageUrl),
    startDateTime: toBackendDate(form.startDate),
    endDateTime: toBackendDate(form.endDate),
    registrationDeadline: toBackendDate(form.registrationDeadline),
    about: form.description.trim(),
    tickets: form.tickets.map((ticket) => ({
      name: ticket.name.trim(),
      price: Number(ticket.price) || 0,
      capacity: Number(ticket.capacity) || 0,
    })),
    venue: { name: form.venue.trim(), location: form.address.trim(), imagePath: null },
    facilities: form.facilities ?? [],
    approvalMode: form.approvalMode,
  }

  const saved =
    eventId === null || eventId === undefined
      ? await api(`${base}/events`, { method: "POST", body })
      : await api(`${base}/events/${eventId}`, { method: "PUT", body })

  if (submit) return toEvent(await api(`${base}/events/${saved.id}/submit`, { method: "POST" }))
  return toEvent(saved)
}
