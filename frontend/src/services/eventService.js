// Published events for the homepage, search and event details (no login needed).
import { api } from "./api"
import { toEvent } from "./mappers"

/** GET /api/events (optional ?categoryId=). */
export async function getEvents(categoryId) {
  const query = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : ""
  const events = await api(`/api/events${query}`)
  return events.map(toEvent)
}

/** GET /api/events/{id}: one published event, or null. */
export async function getEvent(eventId) {
  try {
    return toEvent(await api(`/api/events/${encodeURIComponent(eventId)}`))
  } catch (error) {
    if (error.status === 404) return null
    throw error
  }
}

/** GET /api/categories: [{ id, name }] */
let categoriesCache = null
export async function getCategories() {
  categoriesCache ??= api("/api/categories").catch((error) => {
    categoriesCache = null
    throw error
  })
  return categoriesCache
}
