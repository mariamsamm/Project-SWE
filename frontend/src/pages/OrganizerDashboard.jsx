import { useCallback, useEffect, useMemo, useState } from "react"
import ConfirmationModal from "../Components/ConfirmationModal"
import DashboardCard from "../Components/DashboardCard"
import OrganizerSidebar from "../Components/OrganizerSidebar"
import StatusBadge from "../Components/StatusBadge"
import { useSession } from "../hooks/useSession"
import {
  canEditEvent,
  canSubmitForReview,
  getDashboardSummary,
  submitForReview,
} from "../services/organizerService"
import { goTo, pageUrl } from "../utils/navigation"
import "./OrganizerPages.css"

const FILTERS = [
  { status: "ALL", label: "All" },
  { status: "PUBLISHED", label: "Published" },
  { status: "PENDING_REVIEW", label: "Pending review" },
  { status: "DRAFT", label: "Drafts" },
  { status: "REJECTED", label: "Rejected" },
]

const SORTS = {
  soonest: { label: "Soonest first", compare: (a, b) => a.startDate.localeCompare(b.startDate) },
  popular: { label: "Most registrations", compare: (a, b) => b.registrations - a.registrations },
  name: { label: "Name (A–Z)", compare: (a, b) => a.title.localeCompare(b.title) },
}

const VIEW_KEY = "eventhub.organizerView"
const DAY = 24 * 60 * 60 * 1000

/* ---------- small helpers ---------- */

function cairo(iso, options) {
  return new Date(iso).toLocaleString("en-GB", { ...options, timeZone: "Africa/Cairo" })
}

function dayAndMonth(iso) {
  return { day: cairo(iso, { day: "numeric" }), month: cairo(iso, { month: "short" }) }
}

function greeting() {
  const hour = Number(cairo(new Date().toISOString(), { hour: "numeric", hour12: false }))
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

function initials(name) {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

/** "Today", "Tomorrow", "In 12 days" or "Ended". */
function countdown(event) {
  const now = Date.now()
  if (new Date(event.endDate).getTime() < now) return { text: "Ended", past: true }
  const days = Math.ceil((new Date(event.startDate).getTime() - now) / DAY)
  if (days <= 0) return { text: "Happening now", past: false }
  if (days === 1) return { text: "Tomorrow", past: false }
  return { text: `In ${days} days`, past: false }
}

function readView() {
  try {
    return localStorage.getItem(VIEW_KEY) === "table" ? "table" : "grid"
  } catch {
    return "grid"
  }
}

function saveView(view) {
  try {
    localStorage.setItem(VIEW_KEY, view)
  } catch {
    /* storage blocked: the choice just will not be remembered */
  }
}

/** True one frame after mount, so bars can grow from 0 with a CSS transition. */
function useReady() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  return ready
}

/* ---------- Registrations chart: pick 3 or 6 months, click a bar for details ---------- */

function RegistrationsPanel({ data }) {
  const [range, setRange] = useState(6)
  const months = data.slice(-range)
  const [selected, setSelected] = useState(months.length - 1)
  const ready = useReady()

  const index = Math.min(selected, months.length - 1)
  const current = months[index]
  const previous = months[index - 1]
  const total = months.reduce((sum, item) => sum + item.count, 0)
  const max = Math.max(...months.map((item) => item.count), 1)
  const change = previous && previous.count > 0 ? Math.round(((current.count - previous.count) / previous.count) * 100) : null

  return (
    <section className="organizer-panel" id="registrations-panel" aria-labelledby="registrations-title">
      <div className="organizer-panel__header">
        <h2 id="registrations-title">Registrations</h2>
        <div className="segmented" role="group" aria-label="Time range">
          {[3, 6].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={range === value}
              onClick={() => {
                setRange(value)
                setSelected(value - 1)
              }}
            >
              {value} months
            </button>
          ))}
        </div>
      </div>

      <p className="organizer-panel__big">
        {total}
        <span> new registrations</span>
      </p>

      <div className="bar-chart" role="group" aria-label="Registrations per month. Choose a month for details.">
        {months.map((item, i) => (
          <button
            key={item.month}
            type="button"
            className="bar-chart__item"
            aria-pressed={i === index}
            aria-label={`${item.month}: ${item.count} registrations`}
            onClick={() => setSelected(i)}
          >
            <span className="bar-chart__value">{item.count}</span>
            <span
              className="bar-chart__bar"
              style={{ height: ready ? `${(item.count / max) * 100}%` : "0%" }}
              aria-hidden="true"
            />
            <span className="bar-chart__label">{item.month}</span>
          </button>
        ))}
      </div>

      <p className="bar-chart__detail" aria-live="polite">
        <strong>{current.month}:</strong> {current.count} registrations
        {change !== null && (
          <span className={change >= 0 ? "trend trend--up" : "trend trend--down"}>
            {change >= 0 ? "▲" : "▼"} {Math.abs(change)}% vs {previous.month}
          </span>
        )}
      </p>
    </section>
  )
}

/* ---------- How full each published event is ---------- */

function SeatsPanel({ events }) {
  const ready = useReady()

  return (
    <section className="organizer-panel" aria-labelledby="seats-title">
      <div className="organizer-panel__header">
        <h2 id="seats-title">Seats filled</h2>
        <span className="organizer-muted">Published events</span>
      </div>

      {events.length === 0 ? (
        <p className="organizer-muted">No published events yet.</p>
      ) : (
        <ul className="seats-list">
          {events.map((event) => {
            const percent = Math.min(100, Math.round((event.registrations / event.capacity) * 100))
            const level = percent >= 100 ? "full" : percent >= 70 ? "high" : "normal"
            return (
              <li key={event.id}>
                <div className="seats-list__top">
                  <a href={pageUrl("manage-event", { id: event.id })}>{event.title}</a>
                  <span>
                    {event.registrations} / {event.capacity} · {percent}%
                  </span>
                </div>
                <div className="seats-list__track" aria-hidden="true">
                  <span
                    className={`seats-list__fill seats-list__fill--${level}`}
                    style={{ width: ready ? `${percent}%` : "0%" }}
                  />
                </div>
                {level === "high" && <span className="seats-list__tag">Filling up fast</span>}
                {level === "full" && <span className="seats-list__tag seats-list__tag--full">Sold out</span>}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/* ---------- Buttons shared by card and table views ---------- */

function EventActions({ event, onSubmit }) {
  return (
    <div className="organizer-event__actions">
      <a className="organizer-btn organizer-btn--primary" href={pageUrl("manage-event", { id: event.id })}>
        Manage
      </a>
      {canEditEvent(event) && (
        <a className="organizer-btn" href={pageUrl("create-event", { id: event.id })}>
          Edit
        </a>
      )}
      {canSubmitForReview(event) && (
        <button type="button" className="organizer-btn organizer-btn--outline" onClick={() => onSubmit(event)}>
          Submit for review
        </button>
      )}
    </div>
  )
}

function EventCard({ event, onSubmit }) {
  const start = dayAndMonth(event.startDate)
  const end = dayAndMonth(event.endDate)
  const sameDay = start.day === end.day && start.month === end.month
  const when = countdown(event)

  return (
    <article className="organizer-event">
      <div className="organizer-event__poster">
        {event.imageUrl ? (
          <img src={event.imageUrl} alt="" loading="lazy" />
        ) : (
          <span className="organizer-event__placeholder" aria-hidden="true">
            {initials(event.title)}
          </span>
        )}
        <StatusBadge status={event.status} />
        <span className={`organizer-event__countdown${when.past ? " is-past" : ""}`}>{when.text}</span>
      </div>

      <div className="organizer-event__body">
        <p className="organizer-event__category">{event.category}</p>
        <h3>{event.title}</h3>

        <p className="organizer-event__dates">
          <time dateTime={event.startDate}>
            <strong>{start.day}</strong> {start.month}
          </time>
          {!sameDay && (
            <>
              {" – "}
              <time dateTime={event.endDate}>
                <strong>{end.day}</strong> {end.month}
              </time>
            </>
          )}
        </p>

        <p className="organizer-muted">{event.location}</p>

        <p className="organizer-event__registrations">
          {event.registrations} / {event.capacity} registered
        </p>

        {event.status === "REJECTED" && event.rejectionReason && (
          <p className="organizer-event__reason">
            <strong>Admin feedback:</strong> {event.rejectionReason}
          </p>
        )}

        <EventActions event={event} onSubmit={onSubmit} />
      </div>
    </article>
  )
}

function EventsTable({ events, onSubmit }) {
  return (
    <div className="organizer-table-wrap">
      <table className="organizer-table">
        <thead>
          <tr>
            <th scope="col">Event name</th>
            <th scope="col">Date</th>
            <th scope="col">Status</th>
            <th scope="col">Registrations</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <th scope="row">
                {event.title}
                <span className="organizer-muted">{event.location}</span>
              </th>
              <td>
                {cairo(event.startDate, { dateStyle: "medium" })}
                <span className="organizer-muted">{countdown(event).text}</span>
              </td>
              <td>
                <StatusBadge status={event.status} />
              </td>
              <td>
                {event.registrations} / {event.capacity}
              </td>
              <td>
                <EventActions event={event} onSubmit={onSubmit} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ---------- The page ---------- */

function OrganizerDashboard() {
  const session = useSession()
  const isOrganizer = session?.role === "ORGANIZER"

  const [summary, setSummary] = useState(null)
  const [status, setStatus] = useState("loading")
  const [filter, setFilter] = useState("ALL")
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState("soonest")
  const [view, setView] = useState(readView)
  const [confirming, setConfirming] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState("")
  const [today] = useState(() => ({
    date: cairo(new Date().toISOString(), { weekday: "long", day: "numeric", month: "long" }),
    greeting: greeting(),
  }))

  // Not logged in: send them to log in, then come back here.
  useEffect(() => {
    if (!session) goTo(pageUrl("login", { next: pageUrl("organizer") }))
  }, [session])

  const load = useCallback(() => {
    return getDashboardSummary()
      .then((data) => {
        setSummary(data)
        setStatus("ready")
      })
      .catch(() => setStatus("error"))
  }, [])

  useEffect(() => {
    if (isOrganizer) load()
  }, [isOrganizer, load])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(""), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  const counts = useMemo(() => {
    const result = { ALL: summary?.events.length ?? 0 }
    for (const event of summary?.events ?? []) result[event.status] = (result[event.status] ?? 0) + 1
    return result
  }, [summary])

  const visibleEvents = useMemo(() => {
    const words = query.trim().toLowerCase()
    return (summary?.events ?? [])
      .filter((event) => filter === "ALL" || event.status === filter)
      .filter((event) => !words || `${event.title} ${event.location} ${event.category}`.toLowerCase().includes(words))
      .sort(SORTS[sort].compare)
  }, [summary, filter, query, sort])

  if (!session) {
    return (
      <main className="organizer organizer--message">
        <p role="status">Redirecting to log in…</p>
      </main>
    )
  }

  if (!isOrganizer) {
    return (
      <main className="organizer organizer--message">
        <div className="organizer-panel">
          <h1>Organizers only</h1>
          <p className="organizer-muted">
            You are logged in as {session.name}. This page is for event organizers.
          </p>
          <a className="organizer-btn organizer-btn--primary" href="/">
            Back to events
          </a>
        </div>
      </main>
    )
  }

  const firstName = session.name.split(" ")[0]

  function showEvents(nextFilter) {
    setFilter(nextFilter)
    document.getElementById("my-events")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  function changeView(nextView) {
    setView(nextView)
    saveView(nextView)
  }

  async function confirmSubmit() {
    setBusy(true)
    try {
      await submitForReview(confirming.id)
      await load()
      setToast(`"${confirming.title}" was sent to the admin for review.`)
    } catch (caught) {
      setToast(caught.message)
    } finally {
      setBusy(false)
      setConfirming(null)
    }
  }

  return (
    <main className="organizer">
      <OrganizerSidebar active="dashboard" />

      <div className="organizer__content">
        <header className="organizer__header">
          <div>
            <p className="organizer__eyebrow">{today.date}</p>
            <h1>
              {today.greeting}, {firstName}
            </h1>
          </div>
          <div className="organizer__profile">
            <span className="organizer__avatar" aria-hidden="true">
              {initials(session.name)}
            </span>
            <span>
              {session.name}
              <small>{session.email}</small>
            </span>
          </div>
        </header>

        {status === "loading" && <p role="status">Loading your dashboard…</p>}
        {status === "error" && <p role="alert">We couldn&apos;t load your dashboard. Please refresh.</p>}

        {status === "ready" && (
          <>
            <section className="dashboard-cards" aria-label="Summary. Choose a card to filter your events.">
              <DashboardCard
                label="Total events"
                value={summary.totalEvents}
                note="Show all"
                active={filter === "ALL"}
                onClick={() => showEvents("ALL")}
              />
              <DashboardCard
                label="Published events"
                value={summary.published}
                note="Visible on the homepage"
                active={filter === "PUBLISHED"}
                onClick={() => showEvents("PUBLISHED")}
              />
              <DashboardCard
                label="Pending review"
                value={summary.pendingReview}
                note="Waiting for an admin"
                active={filter === "PENDING_REVIEW"}
                onClick={() => showEvents("PENDING_REVIEW")}
              />
              <DashboardCard
                label="Total registrations"
                value={summary.totalRegistrations}
                note="See the chart"
                onClick={() =>
                  document.getElementById("registrations-panel")?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              />
            </section>

            <div className="organizer__panels">
              <RegistrationsPanel data={summary.registrationsByMonth} />
              <SeatsPanel events={summary.events.filter((event) => event.status === "PUBLISHED")} />
            </div>

            <section className="organizer-panel" id="my-events" aria-labelledby="my-events-title">
              <div className="organizer-panel__header organizer-panel__header--wrap">
                <h2 id="my-events-title">My events</h2>
                <a className="organizer-btn organizer-btn--primary" href={pageUrl("create-event")}>
                  + Create new event
                </a>
              </div>

              <div className="organizer-toolbar">
                <label className="organizer-search">
                  <span className="visually-hidden">Search your events</span>
                  <input
                    type="search"
                    value={query}
                    placeholder="Search by name, venue or category…"
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>

                <label className="organizer-select">
                  <span>Sort</span>
                  <select value={sort} onChange={(event) => setSort(event.target.value)}>
                    {Object.entries(SORTS).map(([key, option]) => (
                      <option key={key} value={key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="segmented" role="group" aria-label="Layout">
                  <button type="button" aria-pressed={view === "grid"} onClick={() => changeView("grid")}>
                    Cards
                  </button>
                  <button type="button" aria-pressed={view === "table"} onClick={() => changeView("table")}>
                    Table
                  </button>
                </div>
              </div>

              <div className="organizer-filters" role="group" aria-label="Filter events by status">
                {FILTERS.map((item) => (
                  <button
                    key={item.status}
                    type="button"
                    aria-pressed={filter === item.status}
                    onClick={() => setFilter(item.status)}
                  >
                    {item.label}
                    <span className="organizer-filters__count">{counts[item.status] ?? 0}</span>
                  </button>
                ))}
              </div>

              <p className="visually-hidden" aria-live="polite">
                Showing {visibleEvents.length} {visibleEvents.length === 1 ? "event" : "events"}
              </p>

              {visibleEvents.length === 0 ? (
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
              ) : view === "table" ? (
                <EventsTable events={visibleEvents} onSubmit={setConfirming} />
              ) : (
                <div className="organizer-events">
                  {visibleEvents.map((event) => (
                    <EventCard key={event.id} event={event} onSubmit={setConfirming} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {confirming && (
        <ConfirmationModal
          title="Submit for review?"
          message={`"${confirming.title}" will be sent to an admin. You can't edit it while it is being reviewed.`}
          confirmLabel="Submit"
          busy={busy}
          onConfirm={confirmSubmit}
          onCancel={() => setConfirming(null)}
        />
      )}

      {toast && (
        <div className="organizer-toast" role="status">
          {toast}
          <button type="button" aria-label="Dismiss" onClick={() => setToast("")}>
            ×
          </button>
        </div>
      )}
    </main>
  )
}

export default OrganizerDashboard
