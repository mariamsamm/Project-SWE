import { useCallback, useEffect, useRef, useState } from "react"
import AdminEventsPanel from "../Components/AdminEventsPanel"
import DashboardCard from "../Components/DashboardCard"
import StaffLayout, { StaffHeader } from "../Components/StaffLayout"
import StatusBadge from "../Components/StatusBadge"
import { useSession } from "../hooks/useSession"
import { getAdminSummary } from "../services/adminService"
import { formatShortDate } from "../utils/format"
import { goTo, pageUrl } from "../utils/navigation"
import "./OrganizerPages.css"
import "./StaffPages.css"

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const ACTIVITY_TAGS = {
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REVISION_REQUIRED: "Changes",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  REGISTERED: "Registered",
}

function cairo(date, options) {
  return date.toLocaleString("en-GB", { ...options, timeZone: "Africa/Cairo" })
}

/** "Just now", "5 minutes ago", "3 hours ago", "2 days ago", then the date. */
function timeAgo(iso, now) {
  const passed = now - new Date(iso).getTime()
  const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"} ago`
  if (passed < MINUTE) return "Just now"
  if (passed < HOUR) return plural(Math.floor(passed / MINUTE), "minute")
  if (passed < DAY) return plural(Math.floor(passed / HOUR), "hour")
  if (passed < 7 * DAY) return plural(Math.floor(passed / DAY), "day")
  return formatShortDate(iso)
}

/** How long an event has waited for a review. Long waits are highlighted. */
function waiting(event, now) {
  if (!event.submittedAt) return { text: "Waiting for review", long: false }
  const days = Math.floor((now - new Date(event.submittedAt).getTime()) / DAY)
  return {
    text: `Submitted ${formatShortDate(event.submittedAt)}${days > 0 ? ` · waiting ${days} ${days === 1 ? "day" : "days"}` : ""}`,
    long: days >= 3,
  }
}

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
}

/* ---------- 1. Welcome: notification bell ---------- */

function NotificationBell({ pendingEvents }) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)
  const count = pendingEvents.length

  useEffect(() => {
    if (!open) return
    function onPointerDown(event) {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false)
    }
    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  return (
    <div className="staff-bell" ref={wrapperRef}>
      <button
        type="button"
        className="staff-bell__button"
        aria-expanded={open}
        aria-controls="admin-notifications"
        aria-label={count > 0 ? `Notifications: ${count} need your attention` : "Notifications: nothing new"}
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" />
        </svg>
        {count > 0 && <span className="staff-bell__dot">{count}</span>}
      </button>

      {open && (
        <div id="admin-notifications" className="staff-bell__panel" role="region" aria-label="Notifications">
          <p className="staff-bell__title">Notifications</p>
          {count === 0 ? (
            <p className="organizer-muted">You&apos;re all caught up. Nothing needs your attention.</p>
          ) : (
            <ul>
              {pendingEvents.map((event) => (
                <li key={event.id}>
                  <a href={pageUrl("review-event", { id: event.id })}>
                    <strong>{event.title}</strong>
                    <span className="organizer-muted">Waiting for your review · by {event.organizerName}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------- 3. Pending event approvals ---------- */

function PendingPanel({ events, now }) {
  return (
    <section className="organizer-panel" id="pending-reviews" aria-labelledby="pending-title">
      <div className="organizer-panel__header">
        <h2 id="pending-title">Pending event approvals</h2>
        <span className="organizer-muted">Oldest first</span>
      </div>
      <p className="organizer-muted staff-tab-intro">Events submitted by organizers and waiting for your review.</p>

      {events.length === 0 ? (
        <div className="organizer-empty">
          <p>All caught up. No events are waiting for a review.</p>
        </div>
      ) : (
        <ul className="staff-queue">
          {events.map((event) => {
            const wait = waiting(event, now)
            return (
              <li key={event.id}>
                <div>
                  <h3>
                    {event.title} <StatusBadge status={event.status} />
                  </h3>
                  <p className="organizer-muted">
                    {event.organizerName} · {formatShortDate(event.startDate)} · {event.category}
                  </p>
                  <span className={`staff-wait${wait.long ? " staff-wait--long" : ""}`}>{wait.text}</span>
                </div>
                <a className="organizer-btn organizer-btn--primary" href={pageUrl("review-event", { id: event.id })}>
                  View details →
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/* ---------- 5. Recent activity ---------- */

function ActivityPanel({ activity, now }) {
  return (
    <section className="organizer-panel" aria-labelledby="activity-title">
      <div className="organizer-panel__header">
        <h2 id="activity-title">Recent activity</h2>
        <span className="organizer-muted">Latest first</span>
      </div>

      {activity.length === 0 ? (
        <p className="organizer-muted">Nothing has happened yet. New submissions, decisions and registrations show up here.</p>
      ) : (
        <ul className="staff-feed staff-feed--plain staff-activity">
          {activity.map((item) => (
            <li key={item.id}>
              <span className={`staff-activity__tag staff-activity__tag--${item.kind.toLowerCase()}`}>
                {ACTIVITY_TAGS[item.kind]}
              </span>
              <span>
                {item.actor && <strong>{item.actor}</strong>} {item.action}{" "}
                <a className="staff-link" href={pageUrl("review-event", { id: item.eventId })}>
                  {item.eventTitle}
                </a>
                <time className="organizer-muted" dateTime={item.at}>
                  {timeAgo(item.at, now)}
                </time>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* ---------- 6. Quick actions ---------- */

function QuickActions({ pendingEvents, userCount, eventCount }) {
  const next = pendingEvents[0]
  const actions = [
    {
      title: "Review pending events",
      text: next ? `${pendingEvents.length} waiting. Start with "${next.title}".` : "No new submissions right now.",
      href: next ? pageUrl("review-event", { id: next.id }) : `${pageUrl("admin")}#pending-reviews`,
      icon: "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
    },
    {
      title: "Manage users",
      text: `View ${userCount} participants, organizers and admins.`,
      href: pageUrl("admin-users"),
      icon: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5a6 6 0 0 1 3.5 5.5",
    },
    {
      title: "Manage all events",
      text: `View and monitor all ${eventCount} event records.`,
      href: pageUrl("admin-events"),
      icon: "M5 6h14v14H5zM5 10h14M9 3v4M15 3v4",
    },
  ]

  return (
    <section className="organizer-panel" aria-labelledby="quick-title">
      <div className="organizer-panel__header">
        <h2 id="quick-title">Quick actions</h2>
      </div>
      <div className="staff-quick">
        {actions.map((action) => (
          <a key={action.title} href={action.href}>
            <span className="staff-quick__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d={action.icon} />
              </svg>
            </span>
            <span>
              <strong>{action.title}</strong>
              <span className="organizer-muted">{action.text}</span>
            </span>
          </a>
        ))}
      </div>
    </section>
  )
}

/* ---------- The page ---------- */

function Dashboard({ onPendingCount }) {
  const session = useSession()
  const [summary, setSummary] = useState(null)
  const [status, setStatus] = useState("loading")
  const [today] = useState(() => ({
    now: Date.now(),
    date: cairo(new Date(), { weekday: "long", day: "numeric", month: "long" }),
  }))

  const load = useCallback(async () => {
    try {
      const data = await getAdminSummary()
      setSummary(data)
      onPendingCount(data.pending)
      setStatus("ready")
    } catch {
      setStatus("error")
    }
  }, [onPendingCount])

  useEffect(() => {
    async function start() {
      await load()
    }
    start()
  }, [load])

  // Opening /?page=admin#pending-reviews jumps to that section once it exists.
  useEffect(() => {
    if (status === "ready" && window.location.hash) scrollTo(window.location.hash.slice(1))
  }, [status])

  return (
    <>
      <StaffHeader
        eyebrow={today.date}
        title={`Welcome back, ${session.name.split(" ")[0]}!`}
        aside={summary && <NotificationBell pendingEvents={summary.pendingEvents} />}
      >
        <p className="organizer-muted staff-header-note">Here&apos;s what&apos;s happening across your platform.</p>
      </StaffHeader>

      {status === "loading" && <p role="status">Loading the admin dashboard…</p>}
      {status === "error" && <p role="alert">We couldn&apos;t load the dashboard. Please refresh.</p>}

      {status === "ready" && (
        <>
          <section className="dashboard-cards" aria-label="Overview. Choose a card for more.">
            <DashboardCard
              label="Total events"
              value={summary.totalEvents}
              note="Across all organizers"
              onClick={() => goTo(pageUrl("admin-events"))}
            />
            <DashboardCard
              label="Pending approvals"
              value={summary.pending}
              note={summary.pending > 0 ? "Need attention" : "All caught up"}
              onClick={() => scrollTo("pending-reviews")}
            />
            <DashboardCard
              label="Published events"
              value={summary.published}
              note="Approved and visible"
              onClick={() => goTo(pageUrl("admin-events", { status: "PUBLISHED" }))}
            />
            <DashboardCard
              label="Total participants"
              value={summary.participants}
              note="Registered for events"
              onClick={() => goTo(pageUrl("admin-events", { sort: "popular" }))}
            />
          </section>

          <div className="organizer__panels">
            <PendingPanel events={summary.pendingEvents} now={today.now} />
            <ActivityPanel activity={summary.activity} now={today.now} />
          </div>

          <AdminEventsPanel events={summary.events} overview />

          <QuickActions
            pendingEvents={summary.pendingEvents}
            userCount={summary.users.length}
            eventCount={summary.totalEvents}
          />
        </>
      )}
    </>
  )
}

function AdminDashboard() {
  const [pendingCount, setPendingCount] = useState(0)
  return (
    <StaffLayout roles={["ADMIN"]} active="dashboard" pendingCount={pendingCount}>
      <Dashboard onPendingCount={setPendingCount} />
    </StaffLayout>
  )
}

export default AdminDashboard
