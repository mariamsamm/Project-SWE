// DEMO DATA. Admin actions change the events and users saved in this browser.
// When the Spring Boot API is ready, replace the function bodies with fetch calls
// (for example POST /api/admin/events/{id}/review) and keep the same function names.
import { listUsers, updateUser } from "./authService"
import { sendEmail } from "./notificationService"
import { listRegistrations } from "./manageEventService"
import { cancelEvent, effectiveStatus, getAllEvents, getOrganizerEvent, updateEvent } from "./organizerService"

export const DECISIONS = {
  APPROVED: { label: "Approved and published", status: "PUBLISHED" },
  REVISION_REQUIRED: { label: "Changes requested", status: "REVISION_REQUIRED" },
  REJECTED: { label: "Rejected", status: "REJECTED" },
}

export const MIN_FEEDBACK = 10

/* ---------- events (Admin.viewAllEvents) ---------- */

const REVIEW_WORDS = { APPROVED: "approved", REVISION_REQUIRED: "asked for changes to", REJECTED: "rejected" }

/**
 * The latest things that happened on the platform, newest first:
 * events submitted, admin decisions, cancellations and new registrations.
 */
function buildActivity(events, registrationsByEvent, limit) {
  const items = []

  for (const event of events) {
    const about = { eventId: event.id, eventTitle: event.title }

    if (event.submittedAt) {
      items.push({ ...about, id: `submitted-${event.id}`, kind: "SUBMITTED", at: event.submittedAt, actor: event.organizerName, action: "submitted" })
    }
    for (const review of event.reviews ?? []) {
      items.push({ ...about, id: review.id, kind: review.decision, at: review.reviewedAt, actor: review.reviewerName, action: REVIEW_WORDS[review.decision] })
    }
    if (event.cancelledAt) {
      items.push({ ...about, id: `cancelled-${event.id}`, kind: "CANCELLED", at: event.cancelledAt, actor: "", action: "was cancelled:" })
    }
    // Only the 3 newest sign-ups per event, so one busy event doesn't fill the list.
    for (const row of (registrationsByEvent[event.id] ?? []).slice(0, 3)) {
      items.push({ ...about, id: `registered-${row.id}`, kind: "REGISTERED", at: row.createdAt, actor: row.name, action: "registered for" })
    }
  }

  return items.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, limit)
}

/** Everything the admin pages need in one call. */
export async function getAdminSummary() {
  const [events, users] = await Promise.all([getAllEvents(), listUsers()])
  const withStatus = events.map((event) => ({ ...event, shownStatus: effectiveStatus(event) }))
  const count = (status) => withStatus.filter((event) => event.shownStatus === status).length

  // Registrations of every event (newest first), for the participant total and the activity list.
  const registrationsByEvent = {}
  for (const event of withStatus) registrationsByEvent[event.id] = await listRegistrations(event.id)
  const participants = Object.values(registrationsByEvent)
    .flat()
    .filter((row) => row.status === "APPROVED" || row.status === "PENDING").length

  return {
    events: withStatus,
    users,
    totalEvents: withStatus.length,
    published: count("PUBLISHED"),
    pending: count("PENDING_REVIEW"),
    participants,
    // Oldest submission first, so nobody waits too long.
    pendingEvents: withStatus
      .filter((event) => event.status === "PENDING_REVIEW")
      .sort((a, b) => String(a.submittedAt ?? "").localeCompare(String(b.submittedAt ?? ""))),
    activity: buildActivity(withStatus, registrationsByEvent, 8),
  }
}

export async function getEventForReview(eventId) {
  const event = await getOrganizerEvent(eventId)
  return event ? { ...event, shownStatus: effectiveStatus(event) } : null
}

/** Ids of the other events still waiting for a review. */
export async function getPendingIds(exceptId) {
  const { pendingEvents } = await getAdminSummary()
  return pendingEvents.map((event) => event.id).filter((id) => String(id) !== String(exceptId))
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

/**
 * EventReview.approve() / requestRevision() / reject().
 * Approving also publishes the event (Admin.approveEvent + publishEvent).
 */
export async function reviewEvent(eventId, decision, feedback, admin) {
  const rule = DECISIONS[decision]
  if (!rule) throw new Error("Choose a decision first.")

  const event = await getOrganizerEvent(eventId)
  if (!event) throw new Error("This event no longer exists.")
  if (event.status !== "PENDING_REVIEW") throw new Error("This event was already reviewed.")

  const note = feedback.trim()
  if (decision !== "APPROVED" && note.length < MIN_FEEDBACK) {
    throw new Error("Tell the organizer why, in at least a short sentence.")
  }

  const now = new Date().toISOString()
  const review = {
    id: `rv-${Date.now().toString(36)}`,
    decision,
    feedback: note,
    reviewedAt: now,
    reviewerName: admin?.name ?? "Admin",
  }

  const updated = await updateEvent(eventId, {
    status: rule.status,
    reviews: [...(event.reviews ?? []), review],
    rejectionReason: decision === "APPROVED" ? undefined : note,
    publishedAt: decision === "APPROVED" ? now : event.publishedAt,
  })

  await sendEmail({
    eventId,
    to: event.organizerEmail,
    subject: `${rule.label}: ${event.title}`,
    message: note || "Your event is now live on EventHub.",
  })

  return updated
}

/** Takes a live or pending event down (Event.cancel) and tells the organizer why. */
export async function adminCancelEvent(eventId, reason) {
  const updated = await cancelEvent(eventId, reason)
  await sendEmail({
    eventId,
    to: updated.organizerEmail ?? "",
    subject: `Cancelled by an admin: ${updated.title}`,
    message: reason,
  })
  return updated
}

/* ---------- users (Admin.manageUsers) ---------- */

export const ROLES = [
  { role: "PARTICIPANT", label: "Participant" },
  { role: "ORGANIZER", label: "Organizer" },
  { role: "ADMIN", label: "Admin" },
]

export async function setUserRole(userId, role, admin) {
  if (userId === admin.id) throw new Error("You can't change your own role.")
  if (!ROLES.some((item) => item.role === role)) throw new Error("Unknown role.")
  await updateUser(userId, { role })
}

export async function setUserSuspended(userId, suspended, admin) {
  if (userId === admin.id) throw new Error("You can't suspend your own account.")
  await updateUser(userId, { suspended })
}
