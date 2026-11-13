// DEMO DATA. There is no backend yet, so organizer events live in this browser.
// When the Spring Boot API is ready, replace the function bodies with fetch calls
// (for example GET /api/organizer/events) and keep the same function names,
// so no page has to change.
import { organizerEvents, registrationsByMonth } from "../data/organizerEvents"
import { getBookedCounts } from "./registrationService"

const KEY = "eventhub.organizerEvents"

function readAll() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null")
    return Array.isArray(parsed) ? parsed : organizerEvents
  } catch {
    return organizerEvents
  }
}

function writeAll(events) {
  try {
    localStorage.setItem(KEY, JSON.stringify(events))
  } catch {
    throw new Error("Your browser couldn't save this. Try a smaller image, or free up browser storage.")
  }
}

/** Tickets that participants booked in this browser for one event. */
function liveBookings(eventId) {
  return Object.values(getBookedCounts(eventId)).reduce((sum, count) => sum + count, 0)
}

/** All events that belong to the organizer, with up-to-date registration counts. */
export async function getMyEvents() {
  return readAll().map((event) => ({
    ...event,
    registrations: event.registrations + liveBookings(event.id),
  }))
}

/** Everything the organizer dashboard needs in one call. */
export async function getDashboardSummary() {
  const events = await getMyEvents()
  const countByStatus = (status) => events.filter((event) => event.status === status).length

  return {
    totalEvents: events.length,
    published: countByStatus("PUBLISHED"),
    pendingReview: countByStatus("PENDING_REVIEW"),
    totalRegistrations: events.reduce((sum, event) => sum + event.registrations, 0),
    registrationsByMonth,
    events,
  }
}

/** An organizer may only edit an event before it is published. */
export function canEditEvent(event) {
  return event.status === "DRAFT" || event.status === "REJECTED"
}

/** Only a draft can be sent to the admin for review. */
export function canSubmitForReview(event) {
  return event.status === "DRAFT"
}

/** Moves a draft to PENDING_REVIEW so an admin can approve or reject it. */
export async function submitForReview(eventId) {
  const events = readAll()
  const event = events.find((item) => String(item.id) === String(eventId))
  if (!event) throw new Error("This event no longer exists.")
  if (!canSubmitForReview(event)) throw new Error("Only drafts can be submitted for review.")

  writeAll(
    events.map((item) =>
      item === event ? { ...item, status: "PENDING_REVIEW", submittedAt: new Date().toISOString() } : item
    )
  )
}

/** One of the organizer's events, or null if it doesn't exist. */
export async function getOrganizerEvent(eventId) {
  return readAll().find((event) => String(event.id) === String(eventId)) ?? null
}

/**
 * Creates a new event or updates an editable one.
 * `submit: false` saves it as DRAFT, `submit: true` sends it for review (PENDING_REVIEW).
 */
export async function saveEvent(form, { submit, eventId = null }) {
  const events = readAll()
  const existing = eventId === null ? null : events.find((event) => String(event.id) === String(eventId))

  if (eventId !== null && !existing) throw new Error("This event no longer exists.")
  if (existing && !canEditEvent(existing)) throw new Error("Published or pending events can't be edited.")

  const now = new Date().toISOString()
  const ticketCategories = form.tickets.map((ticket) => ({
    name: ticket.name.trim(),
    price: Number(ticket.price) || 0,
    capacity: Number(ticket.capacity) || 0,
  }))

  const record = {
    registrations: 0,
    ...existing,
    id: existing?.id ?? Math.max(0, ...events.map((event) => Number(event.id) || 0)) + 1,
    title: form.title.trim(),
    category: form.category,
    description: form.description.trim(),
    location: form.venue.trim(),
    address: form.address.trim(),
    startDate: form.startDate,
    endDate: form.endDate,
    registrationDeadline: form.registrationDeadline,
    capacity: ticketCategories.reduce((sum, ticket) => sum + ticket.capacity, 0),
    approvalMode: form.approvalMode,
    ticketCategories,
    facilities: form.facilities,
    imageUrl: form.imageUrl,
    status: submit ? "PENDING_REVIEW" : "DRAFT",
    rejectionReason: undefined,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    submittedAt: submit ? now : existing?.submittedAt,
  }

  writeAll(existing ? events.map((event) => (event === existing ? record : event)) : [...events, record])
  return record
}
