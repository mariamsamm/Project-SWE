import { useEffect, useState } from "react"
import DashboardCard from "../Components/DashboardCard"
import OrganizerSidebar from "../Components/OrganizerSidebar"
import StatusBadge from "../Components/StatusBadge"
import { useSession } from "../hooks/useSession"
import { canEditEvent, getDashboardSummary } from "../services/organizerService"
import { pageUrl } from "../utils/navigation"
import "./OrganizerPages.css"

const FILTERS = [
  { status: "ALL", label: "All" },
  { status: "PUBLISHED", label: "Published" },
  { status: "PENDING_REVIEW", label: "Pending review" },
  { status: "DRAFT", label: "Drafts" },
  { status: "REJECTED", label: "Rejected" },
]

function dayAndMonth(iso) {
  const date = new Date(iso)
  const part = (options) => date.toLocaleString("en-GB", { ...options, timeZone: "Africa/Cairo" })
  return { day: part({ day: "numeric" }), month: part({ month: "short" }) }
}

function initials(name) {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

/* ---------- Registrations per month (simple bar chart, no library) ---------- */

function RegistrationsChart({ data }) {
  const max = Math.max(...data.map((item) => item.count), 1)

  return (
    <ol className="bar-chart" aria-label="Registrations per month">
      {data.map((item) => (
        <li key={item.month}>
          <span className="bar-chart__value">{item.count}</span>
          <span
            className="bar-chart__bar"
            style={{ height: `${(item.count / max) * 100}%` }}
            aria-hidden="true"
          />
          <span className="bar-chart__label">{item.month}</span>
        </li>
      ))}
    </ol>
  )
}

/* ---------- How full each published event is ---------- */

function SeatsFilled({ events }) {
  if (events.length === 0) return <p className="organizer-muted">No published events yet.</p>

  return (
    <ul className="seats-list">
      {events.map((event) => {
        const percent = Math.min(100, Math.round((event.registrations / event.capacity) * 100))
        return (
          <li key={event.id}>
            <div className="seats-list__top">
              <span>{event.title}</span>
              <span>
                {event.registrations} / {event.capacity}
              </span>
            </div>
            <progress max={event.capacity} value={Math.min(event.registrations, event.capacity)}>
              {percent}%
            </progress>
          </li>
        )
      })}
    </ul>
  )
}

/* ---------- One event in the "My events" grid ---------- */

function OrganizerEventCard({ event }) {
  const start = dayAndMonth(event.startDate)
  const end = dayAndMonth(event.endDate)
  const sameDay = start.day === end.day && start.month === end.month

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
      </div>

      <div className="organizer-event__body">
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

        <div className="organizer-event__actions">
          <a className="organizer-btn organizer-btn--primary" href={pageUrl("manage-event", { id: event.id })}>
            Manage
          </a>
          {canEditEvent(event) && (
            <a className="organizer-btn" href={pageUrl("create-event", { id: event.id })}>
              Edit
            </a>
          )}
        </div>
      </div>
    </article>
  )
}

/* ---------- The page ---------- */

function OrganizerDashboard() {
  const session = useSession()
  const [summary, setSummary] = useState(null)
  const [status, setStatus] = useState("loading")
  const [filter, setFilter] = useState("ALL")

  useEffect(() => {
    let active = true
    getDashboardSummary()
      .then((data) => {
        if (!active) return
        setSummary(data)
        setStatus("ready")
      })
      .catch(() => active && setStatus("error"))
    return () => {
      active = false
    }
  }, [])

  const name = session?.name ?? "Organizer"
  const firstName = name.split(" ")[0]
  const visibleEvents =
    summary?.events.filter((event) => filter === "ALL" || event.status === filter) ?? []

  return (
    <main className="organizer">
      <OrganizerSidebar active="dashboard" />

      <div className="organizer__content">
        <header className="organizer__header">
          <div>
            <p className="organizer__eyebrow">Organizer dashboard</p>
            <h1>Welcome back, {firstName}</h1>
          </div>
          <div className="organizer__profile">
            <span className="organizer__avatar" aria-hidden="true">
              {initials(name)}
            </span>
            <span>{name}</span>
          </div>
        </header>

        {status === "loading" && <p role="status">Loading your dashboard…</p>}
        {status === "error" && <p role="alert">We couldn&apos;t load your dashboard. Please refresh.</p>}

        {status === "ready" && (
          <>
            <section className="dashboard-cards" aria-label="Summary">
              <DashboardCard label="Total events" value={summary.totalEvents} note="All statuses" />
              <DashboardCard label="Published events" value={summary.published} note="Visible on the homepage" />
              <DashboardCard label="Pending review" value={summary.pendingReview} note="Waiting for an admin" />
              <DashboardCard
                label="Total registrations"
                value={summary.totalRegistrations}
                note="Across all your events"
              />
            </section>

            <div className="organizer__panels">
              <section className="organizer-panel">
                <div className="organizer-panel__header">
                  <h2>Registrations</h2>
                  <span className="organizer-muted">Last 6 months</span>
                </div>
                <p className="organizer-panel__big">
                  {summary.registrationsByMonth.reduce((sum, item) => sum + item.count, 0)}
                  <span> new registrations</span>
                </p>
                <RegistrationsChart data={summary.registrationsByMonth} />
              </section>

              <section className="organizer-panel">
                <div className="organizer-panel__header">
                  <h2>Seats filled</h2>
                  <span className="organizer-muted">Published events</span>
                </div>
                <SeatsFilled events={summary.events.filter((event) => event.status === "PUBLISHED")} />
              </section>
            </div>

            <section className="organizer-panel" id="my-events" aria-labelledby="my-events-title">
              <div className="organizer-panel__header organizer-panel__header--wrap">
                <h2 id="my-events-title">My events</h2>
                <a className="organizer-btn organizer-btn--primary" href={pageUrl("create-event")}>
                  + Create new event
                </a>
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
                  </button>
                ))}
              </div>

              {visibleEvents.length === 0 ? (
                <p className="organizer-muted">No events with this status.</p>
              ) : (
                <div className="organizer-events">
                  {visibleEvents.map((event) => (
                    <OrganizerEventCard key={event.id} event={event} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}

export default OrganizerDashboard
