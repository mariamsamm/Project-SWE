// Query-string routing, matching the team's existing "?event=1" convention.
//   /?page=login   /?page=signup   /?page=registrations   /?page=ticket&id=r-123

export function pageUrl(page, params = {}) {
  const search = new URLSearchParams({ page, ...params })
  return `/?${search.toString()}`
}

/** Only allow same-site relative paths as a post-login destination. */
export function safeNext(value, fallback = "/") {
  if (typeof value !== "string") return fallback
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback
  return value
}

export function currentPathWithSearch() {
  return window.location.pathname + window.location.search
}

export function goTo(url) {
  window.location.assign(url)
}
