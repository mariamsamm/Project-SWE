// Demo bookings are stored in this browser.
// When the backend is ready, replace the storage logic with API calls.
import { getEvents } from "./eventService"

const KEY = "eventhub.registrations"
export const MAX_TICKETS_PER_BOOKING = 10

function readAll() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]")
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    throw new Error("Your browser blocked storage, so the booking could not be saved.")
  }
}

function newTicketCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()

  return `EH-${hex.slice(0, 4)}-${hex.slice(4)}`
}

function confirmLegacyBookings(userId) {
  const registrations = readAll()
  let changed = false

  const updated = registrations.map((registration) => {
    if (registration.userId !== userId || registration.status !== "PENDING") {
      return registration
    }

    changed = true
    return {
      ...registration,
      status: "CONFIRMED",
      ticketCode: registration.ticketCode || newTicketCode(),
    }
  })

  if (changed) writeAll(updated)
  return updated
}

/** Counts seats held by existing pending and confirmed bookings. */
export function getBookedCounts(eventId) {
  const counts = {}

  for (const registration of readAll()) {
    if (String(registration.eventId) !== String(eventId)) continue
    if (registration.status === "REJECTED") continue

    for (const item of registration.items) {
      counts[item.categoryId] = (counts[item.categoryId] ?? 0) + item.quantity
    }
  }

  return counts
}

/** Saves a confirmed registration for the selected ticket quantities. */
export async function createRegistration({ event, user, quantities }) {
  if (!user) throw new Error("Please sign in to book tickets.")

  const booked = getBookedCounts(event.id)
  const items = []

  for (const category of event.ticketCategories ?? []) {
    const quantity = Number(quantities[category.id] ?? 0)

    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new Error("Ticket quantities must be non-negative whole numbers.")
    }

    if (quantity === 0) continue

    const remaining = category.available - (booked[category.id] ?? 0)

    if (quantity > remaining) {
      throw new Error(
        remaining <= 0
          ? `${category.name} is sold out.`
          : `Only ${remaining} ${category.name} ${remaining === 1 ? "ticket is" : "tickets are"} left.`
      )
    }

    items.push({
      categoryId: category.id,
      name: category.name,
      price: category.price,
      quantity,
    })
  }

  const quantity = items.reduce((sum, item) => sum + item.quantity, 0)

  if (quantity === 0) throw new Error("Choose at least one ticket.")

  if (quantity > MAX_TICKETS_PER_BOOKING) {
    throw new Error(`You can book at most ${MAX_TICKETS_PER_BOOKING} tickets at a time.`)
  }

  const registration = {
    id: `r-${Date.now().toString(36)}${crypto.getRandomValues(new Uint8Array(2)).join("")}`,
    eventId: String(event.id),
    userId: user.id,
    items,
    quantity,
    total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    status: "CONFIRMED",
    ticketCode: newTicketCode(),
    createdAt: new Date().toISOString(),
  }

  writeAll([...readAll(), registration])
  return registration
}

async function withEvent(registration) {
  const events = await getEvents()
  const event = events.find((item) => String(item.id) === String(registration.eventId)) ?? null
  return { ...registration, event }
}

export async function listMyRegistrations(userId) {
  const mine = confirmLegacyBookings(userId)
    .filter((registration) => registration.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return Promise.all(mine.map(withEvent))
}

/** Looks up a registration owned by the given user. */
export async function getMyRegistration(id, userId) {
  const found = readAll().find(
    (registration) => registration.id === id && registration.userId === userId
  )

  return found ? withEvent(found) : null
}