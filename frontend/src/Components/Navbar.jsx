import { useEffect, useState } from "react"
import { getEvents } from "../services/eventService"
import { logout } from "../services/authService"
import { useSession } from "../hooks/useSession"
import { currentPathWithSearch, pageUrl } from "../utils/navigation"
import "./Navbar.css"

function Navbar() {
  const session = useSession()
  const [query, setQuery] = useState("")
  const [events, setEvents] = useState([])
  const [searchStatus, setSearchStatus] = useState("loading")
  const normalizedQuery = query.trim().toLowerCase()

  useEffect(() => {
    let active = true

    async function loadEvents() {
      try {
        const data = await getEvents()

        if (active) {
          setEvents(data)
          setSearchStatus("ready")
        }
      } catch {
        if (active) setSearchStatus("error")
      }
    }

    loadEvents()

    return () => {
      active = false
    }
  }, [])

  const results = normalizedQuery
    ? events
        .filter((event) =>
          `${event.title} ${event.location ?? ""}`
            .toLowerCase()
            .includes(normalizedQuery)
        )
        .slice(0, 6)
    : []

  return (
    <header className="site-header">
      <nav className="site-nav" aria-label="Main navigation">
        <a className="site-brand" href="/">
          Event<span>Hub</span>
        </a>

        <div
          className="site-search"
          role="search"
          aria-label="Search events"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setQuery("")
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.currentTarget.querySelector("input").focus()
              setQuery("")
            }
          }}
        >
          <label className="site-search__label" htmlFor="event-search">
            Search by event or venue
          </label>
          <input
            id="event-search"
            type="search"
            value={query}
            placeholder="Search for events…"
            onChange={(e) => setQuery(e.target.value)}
          />

          {normalizedQuery && (
            <div className="site-search__results">
              {searchStatus === "loading" && <p role="status">Loading events…</p>}
              {searchStatus === "error" && (
                <p role="status">Search is unavailable. Try browsing Events.</p>
              )}
              {searchStatus === "ready" && results.length === 0 && (
                <p role="status">No matching events.</p>
              )}

              {results.length > 0 && (
                <ul aria-label="Matching events">
                  {results.map((event) => (
                    <li key={event.id}>
                      <a href={`/?event=${encodeURIComponent(event.id)}`}>
                        <strong>{event.title}</strong>
                        <span>{event.location}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="site-nav__actions">
          <a className="site-nav__link" href="/#upcoming-events">
            Home
          </a>

          {session ? (
            <>
              <a className="site-nav__link" href={pageUrl("registrations")}>
                My registrations
              </a>
              <button
                type="button"
                className="site-nav__button"
                onClick={() => {
                  logout()
                  window.location.assign("/")
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <a
                className="site-nav__link"
                href={pageUrl("login", { next: currentPathWithSearch() })}
              >
                Log in
              </a>
              <a className="site-nav__button" href={pageUrl("signup")}>
                Sign up
              </a>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}

export default Navbar