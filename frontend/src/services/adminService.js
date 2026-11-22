// Admin pages through the backend (admin id = the logged-in user):
//   GET  /api/admin/{id}/events                      every event
//   POST /api/admin/{id}/events/{eventId}/approve    | reject | request-revision | unpublish
//   GET  /api/admin/{id}/events/{eventId}/reviews    decision history
//   GET  /api/admin/{id}/users,  PUT /users/{userId}/active
//   POST /api/admin/{id}/organizers                  make a user an organizer
// The backend sends the organizer a notification for every decision.
import { api } from "./api"
import { listUsers, requireSession, updateUser } from "./authService"
import { effectiveStatus, getAllEvents, getOrganizerEvent } from "./organizerService"

export const DECISIONS = {
  APPROVED: { label: "Approved and published", status: "PUBLISHED" },
  REVISION_REQUIRED: { label: "Changes requested", status: "REVISION_REQUIRED" },
  REJECTED: { label: "Rejected", status: "REJECTED" },
}

export const MIN_FEEDBACK = 10

// The backend calls it REVISION_REQUESTED, the pages REVISION_REQUIRED.
const FROM_BACKEND = { APPROVED: "APPROVED", REJECTED: "REJECTED", REVISION_REQUESTED: "REVISION_REQUIRED" }
const ENDPOINT = { APPROVED: "approve", REJECTED: "reject", REVISION_REQUIRED: "request-revision" }

function base() {
  return `/api/admin/${requireSession("ADMIN").id}`
}

/* ---------- events (Admin.viewAllEvents) ---------- */

/** Everything the admin dashboard needs in one call. */
export async function getAdminSummary() {
  const [events, users] = await Promise.all([getAllEvents(), listUsers()])
  const nameOf = (id) => users.find((user) => String(user.id) === String(id))?.name ?? "Unknown"

  const withStatus = events.map((event) => ({
    ...event,
    organizerName: nameOf(event.organizerId),
    shownStatus: effectiveStatus(event),
  }))
  const count = (status) => withStatus.filter((event) => event.shownStatus === status).length

  // Only events that were ever submitted can have reviews.
  const reviewed = withStatus.filter((event) => event.submittedAt && event.status !== "PENDING_REVIEW")
  const histories = await Promise.all(
    reviewed.map((event) =>
      api(`${base()}/events/${event.id}/reviews`)
        .then((list) =>
          list.map((review) => ({
            id: review.id,
            decision: FROM_BACKEND[review.decision] ?? review.decision,
            feedback: review.feedback ?? "",
            reviewedAt: review.reviewedAt,
            reviewerName: nameOf(review.adminId),
            eventId: event.id,
            eventTitle: event.title,
          }))
        )
        .catch(() => [])
    )
  )
  const reviews = histories.flat().sort((a, b) => String(b.reviewedAt).localeCompare(String(a.reviewedAt)))

  return {
    events: withStatus,
    users,
    totalEvents: withStatus.length,
    published: count("PUBLISHED"),
    pending: count("PENDING_REVIEW"),
    rejected: count("REJECTED"),
    // Oldest submission first, so nobody waits too long.
    pendingEvents: withStatus
      .filter((event) => event.status === "PENDING_REVIEW")
      .sort((a, b) => String(a.submittedAt ?? "").localeCompare(String(b.submittedAt ?? ""))),
    recentReviews: reviews.slice(0, 5),
  }
}

/** Report numbers (GET /api/admin/{id}/reports). */
export async function getReports() {
  return api(`${base()}/reports`)
}

export async function getEventForReview(eventId) {
  const event = await getOrganizerEvent(eventId)
  return event ? { ...event, shownStatus: effectiveStatus(event) } : null
}

/** Ids of the other events still waiting for a review. */
export async function getPendingIds(exceptId) {
  const events = await getAllEvents()
  return events
    .filter((event) => event.status === "PENDING_REVIEW")
    .map((event) => event.id)
    .filter((id) => String(id) !== String(exceptId))
}

/** Event.validate(): automatic checks shown to the admin before deciding. */
export function validateEvent(event) {
  const start = new Date(event.startDate).getTime()
  const end = new Date(event.endDate).getTime()
  const deadline = new Date(event.registrationDeadline).getTime()
  const tickets = event.ticketCategories ?? []
  const ticketSeats = tickets.reduce((sum, ticket) => sum + (Number(ticket.capacity) || 0), 0)

  return [
    {
      label: "Title and description",
      ok: event.title?.trim().length >= 3 && event.description?.trim().length >= 30,
      detail: "The description should be at least 30 characters.",
    },
    { label: "Venue is filled in", ok: Boolean(event.location?.trim()), detail: "No venue was given." },
    { label: "Starts in the future", ok: start > Date.now(), detail: "The start date has already passed." },
    { label: "Ends after it starts", ok: end > start, detail: "The end time is before the start time." },
    {
      label: "Registration closes before the start",
      ok: deadline <= start,
      detail: "The registration deadline is after the event starts.",
    },
    {
      label: "Tickets match the capacity",
      ok: event.capacity > 0 && tickets.length > 0 && ticketSeats === event.capacity,
      detail: "Ticket quantities don't add up to the capacity.",
    },
    { label: "Has a cover image", ok: Boolean(event.imageUrl), detail: "No cover image was uploaded.", optional: true },
  ]
}

/** Approve (also publishes) / request changes / reject. */
export async function reviewEvent(eventId, decision, feedback) {
  const endpoint = ENDPOINT[decision]
  if (!endpoint) throw new Error("Choose a decision first.")
  const note = feedback.trim()
  if (decision !== "APPROVED" && note.length < MIN_FEEDBACK) {
    throw new Error("Tell the organizer why, in at least a short sentence.")
  }
  return api(`${base()}/events/${eventId}/${endpoint}`, { method: "POST", body: { feedback: note || null } })
}

/** Takes a published event off the homepage (it goes back to DRAFT) and tells the organizer why. */
export async function adminCancelEvent(eventId, reason) {
  return api(`${base()}/events/${eventId}/unpublish`, { method: "POST", body: { feedback: reason.trim() } })
}

/* ---------- users (Admin.manageUsers) ---------- */

export const ROLES = [
  { role: "PARTICIPANT", label: "Participant" },
  { role: "ORGANIZER", label: "Organizer" },
  { role: "ADMIN", label: "Admin" },
]

/** The backend can only turn a participant into an organizer. */
export async function setUserRole(userId, role, admin) {
  if (String(userId) === String(admin.id)) throw new Error("You can't change your own role.")
  if (role !== "ORGANIZER") throw new Error("The backend can only make a participant an organizer.")
  const user = (await listUsers()).find((item) => String(item.id) === String(userId))
  if (!user) throw new Error("This user no longer exists.")
  await api(`${base()}/organizers`, {
    method: "POST",
    body: { email: user.email, organizationName: user.organizationName || user.name, department: null, bio: null },
  })
}

export async function setUserSuspended(userId, suspended, admin) {
  if (String(userId) === String(admin.id)) throw new Error("You can't suspend your own account.")
  await updateUser(userId, { suspended })
}
