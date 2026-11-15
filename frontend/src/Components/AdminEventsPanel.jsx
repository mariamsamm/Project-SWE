import { useMemo, useState } from "react"
import { canCancelEvent } from "../services/organizerService"
import { formatShortDate, STATUS_LABELS } from "../utils/format"
import { pageUrl } from "../utils/navigation"
import StatusBadge from "./StatusBadge"

const ALL_STATUSES = ["PENDING_REVIEW", "PUBLISHED", "REVISION_REQUIRED", "REJECTED", "DRAFT", "CANCELLED", "COMPLETED"]
const OVERVIEW_STATUSES = ["PENDING_REVIEW", "PUBLISHED", "REJECTED"]
const OVERVIEW_ROWS = 5

const SORTS = {
  soonest: { label: "Soonest first", compare: (a, b) => String(a.startDate).localeCompare(String(b.startDate)) },
  popular: { label: "Most registrations", compare: (a, b) => b.registrations - a.registrations },
  name: { label: "Name (A–Z)", compare: (a, b) => a.title.localeCompare(b.title) },
}

/**
 * Searchable, filterable table of every event (Admin.viewAllEvents).
 * `overview` is the short version on the dashboard: 4 filters, 5 rows and a "View all events" link.
 * The full version adds sorting, registrations and a Cancel button (`onCancel`).
 */
function AdminEventsPanel({ events, overview = false, initialFilter = "ALL", initialSort = "soonest", onCancel }) {
  const [filter, setFilter] = useState(initialFilter)
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState(SORTS[initialSort] ? initialSort : "soonest")

  const counts = useMemo(() => {
    const result = { ALL: events.length }
    for (const event of events) result[event.shownStatus] = (result[event.shownStatus] ?? 0) + 1
    return result
  }, [events])

  const visible = useMemo(() => {
    const words = query.trim().toLowerCase()
    return events
      .filter((event) => filter === "ALL" || event.shownStatus === filter)
      .filter(
        (event) =>
          !words || `${event.title} ${event.location} ${event.category} ${event.organizerName}`.toLowerCase().includes(words)
      )
      .sort(SORTS[sort].compare)
  }, [events, filter, query, sort])

  const statuses = overview ? OVERVIEW_STATUSES : ALL_STATUSES.filter((status) => counts[status] || status === filter)
  const rows = overview ? visible.slice(0, OVERVIEW_ROWS) : visible

  return (
    <section className="organizer-panel" id="all-events" aria-labelledby="all-events-title">
      <div className="organizer-panel__header organizer-panel__header--wrap">
        <h2 id="all-events-title">
          {overview ? "All events overview" : "All events"} <span className="staff-panel-count">({events.length})</span>
        </h2>
        {overview && (
          <a className="organizer-btn" href={pageUrl("admin-events")}>
            View all events →
          </a>
        )}
      </div>

      <div className="organizer-toolbar">
        <label className="organizer-search">
          <span className="visually-hidden">Search all events</span>
          <input
            type="search"
            value={query}
            placeholder="Search by name, venue, category or organizer…"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {!overview && (
          <label className="organizer-select">
            <span>Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              {Object.entries(SORTS).map(([key, option]) => (
                <option key={key} value={key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="organizer-filters" role="group" aria-label="Filter events by status">
        {["ALL", ...statuses].map((status) => (
          <button key={status} type="button" aria-pressed={filter === status} onClick={() => setFilter(status)}>
            {status === "ALL" ? "All" : STATUS_LABELS[status]}
            <span className="organizer-filters__count">{counts[status] ?? 0}</span>
          </button>
        ))}
      </div>

      <p className="visually-hidden" aria-live="polite">
        Showing {rows.length} of {visible.length} {visible.length === 1 ? "event" : "events"}
      </p>

      {visible.length === 0 ? (
        <div className="organizer-empty">
          <p>No events match.</p>
          <button
            type="button"
            className="organizer-btn"
            onClick={() => {
              setFilter("ALL")
              setQuery("")
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="organizer-table-wrap">
          <table className="organizer-table staff-table">
            <thead>
              <tr>
                <th scope="col">Event</th>
                <th scope="col">Organizer</th>
                <th scope="col">Date</th>
                <th scope="col">Status</th>
                {!overview && <th scope="col">Registrations</th>}
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((event) => (
                <tr key={event.id}>
                  <th scope="row">
                    {event.title}
                    <span className="organizer-muted">
                      {event.category} · {event.location}
                    </span>
                  </th>
                  <td>{event.organizerName}</td>
                  <td>{event.startDate ? formatShortDate(event.startDate) : "Not set"}</td>
                  <td>
                    <StatusBadge status={event.shownStatus} />
                  </td>
                  {!overview && (
                    <td>
                      {event.registrations} / {event.capacity}
                    </td>
                  )}
                  <td>
                    <div className="organizer-event__actions">
                      <a
                        className={`organizer-btn${event.status === "PENDING_REVIEW" ? " organizer-btn--primary" : ""}`}
                        href={pageUrl("review-event", { id: event.id })}
                      >
                        {event.status === "PENDING_REVIEW" ? "Review" : "View details"}
                      </a>
                      {onCancel && canCancelEvent(event) && event.status === "PUBLISHED" && (
                        <button type="button" className="organizer-btn staff-btn--danger-outline" onClick={() => onCancel(event)}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {overview && visible.length > OVERVIEW_ROWS && (
        <p className="organizer-muted staff-top-gap">
          Showing {OVERVIEW_ROWS} of {visible.length}. <a className="staff-link" href={pageUrl("admin-events")}>View all events</a>
        </p>
      )}
    </section>
  )
}

export default AdminEventsPanel
