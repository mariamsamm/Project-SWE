// One place that talks to the Spring Boot backend.
// The address comes from VITE_API_URL (see frontend/.env.example).
// Every page keeps calling the service functions; only the services call api().

export const API_URL = (import.meta.env?.VITE_API_URL ?? "http://localhost:8080").replace(/\/$/, "")

/**
 * Calls the backend and returns the JSON answer (or null for an empty answer).
 * On an error it throws an Error with the backend's message, plus .status.
 */
export async function api(path, { method = "GET", body, form } = {}) {
  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    })
  } catch {
    throw new Error("Can't reach the server. Is the backend running on " + API_URL + "?")
  }

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  if (!response.ok) {
    // Backend errors look like { status, message, details: [...] }
    const details = Array.isArray(data?.details) && data.details.length ? ` ${data.details.join(" ")}` : ""
    const error = new Error((data?.message ?? `Request failed (${response.status}).`) + details)
    error.status = response.status
    throw error
  }
  return data
}

/** Pictures saved by the backend start with /uploads/; the rest live in frontend/public. */
export function imageUrl(path) {
  if (!path) return ""
  return path.startsWith("/uploads/") ? `${API_URL}${path}` : path
}

/** The backend wants local time without a zone: "2026-12-23T12:00:00". */
export function toBackendDate(value) {
  if (!value) return null
  const date = new Date(value)
  const pad = (n) => String(n).padStart(2, "0")
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  )
}
