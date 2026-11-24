// Participant bookings through the backend:
//   POST /api/participants/{id}/registrations            book tickets
//   GET  /api/participants/{id}/registrations            my tickets
//   POST /api/participants/{id}/registrations/{rid}/cancel
import { api } from "./api"
import { getEvent } from "./eventService"
import { toBooking } from "./mappers"

export const MAX_TICKETS_PER_BOOKING = 10

/**
 * Seats already taken per ticket type. The backend already removes them from
 * "available" (seatsLeft), so nothing more has to be subtracted here.
 */
export function getBookedCounts() {
  return {}
}

/** Books the chosen ticket quantities. */
export async function createRegistration({ event, user, quantities }) {
  if (!user) throw new Error("Please sign in to book tickets.")

  const items = (event.ticketCategories ?? [])
    .map((category) => ({ ticketCategoryId: category.id, quantity: Number(quantities[category.id] ?? 0) }))
    .filter((item) => item.quantity > 0)

  const count = items.reduce((sum, item) => sum + item.quantity, 0)
  if (count === 0) throw new Error("Choose at least one ticket.")
  if (count > MAX_TICKETS_PER_BOOKING) {
    throw new Error(`You can book at most ${MAX_TICKETS_PER_BOOKING} tickets at a time.`)
  }

  const saved = await api(`/api/participants/${user.id}/registrations`, {
    method: "POST",
    body: { eventId: event.id, items },
  })
  return toBooking(saved)
}

/** Adds the event (title, date, place) to a booking for the pages. */
async function withEvent(booking) {
  const event = (await getEvent(booking.eventId).catch(() => null)) ?? {
    id: booking.eventId,
    title: booking.eventName,
    location: "",
  }
  return { ...booking, event }
}

export async function listMyRegistrations(userId) {
  const list = await api(`/api/participants/${userId}/registrations`)
  const mine = list.map(toBooking).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  return Promise.all(mine.map(withEvent))
}

/** One of my bookings, or null. */
export async function getMyRegistration(id, userId) {
  const list = await api(`/api/participants/${userId}/registrations`)
  const found = list.map(toBooking).find((booking) => String(booking.id) === String(id))
  return found ? withEvent(found) : null
}

/** Cancels one of my bookings. */
export async function cancelMyRegistration(id, userId) {
  return toBooking(await api(`/api/participants/${userId}/registrations/${id}/cancel`, { method: "POST" }))
}
