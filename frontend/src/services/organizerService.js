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
