import { useCallback, useEffect, useMemo, useState } from "react"
import ConfirmationModal from "../Components/ConfirmationModal"
import DashboardCard from "../Components/DashboardCard"
import ReasonModal from "../Components/ReasonModal"
import StaffLayout, { StaffHeader } from "../Components/StaffLayout"
import StatusBadge from "../Components/StatusBadge"
import Toast from "../Components/Toast"
import { useSession } from "../hooks/useSession"
import { useToast } from "../hooks/useToast"
import {
  adminCancelEvent,
  DECISIONS,
  getAdminSummary,
  MIN_FEEDBACK,
  ROLES,
  setUserRole,
  setUserSuspended,
} from "../services/adminService"
import { canCancelEvent } from "../services/organizerService"
import { formatShortDate, STATUS_LABELS } from "../utils/format"
import "./OrganizerPages.css"
import "./StaffPages.css"

const STATUSES = ["PENDING_REVIEW", "PUBLISHED", "REVISION_REQUIRED", "REJECTED", "DRAFT", "CANCELLED", "COMPLETED"]

const SORTS = {
  soonest: { label: "Soonest first", compare: (a, b) => String(a.startDate).localeCompare(String(b.startDate)) },
  popular: { label: "Most registrations", compare: (a, b) => b.registrations - a.registrations },
  name: { label: "Name (A–Z)", compare: (a, b) => a.title.localeCompare(b.title) },
}

const CANCEL_REASONS = [
  "This event breaks the platform rules.",
  "The venue reported a double booking.",
  "The organizer asked us to take it down.",
]

const DAY = 24 * 60 * 60 * 1000

function cairo(date, options) {
  return date.toLocaleString("en-GB", { ...options, timeZone: "Africa/Cairo" })
}

function greeting() {
  const hour = Number(cairo(new Date(), { hour: "numeric", hour12: false }))
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

/** "Submitted today", "Waiting 3 days". Long waits are highlighted. */
function waiting(event) {
  if (!event.submittedAt) return { text: "Waiting for review", long: false }
  const days = Math.floor((Date.now() - new Date(event.submittedAt).getTime()) / DAY)
  if (days <= 0) return { text: "Submitted today", long: false }
  return { text: `Waiting ${days} ${days === 1 ? "day" : "days"}`, long: days >= 3 }
}

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
}

/* ---------- Pending reviews ---------- */

function PendingPanel({ events }) {
  return (
    <section className="organizer-panel" id="pending-reviews" aria-labelledby="pending-title">
      <div className="organizer-panel__header">
        <h2 id="pending-title">Pending reviews</h2>
        <span className="organizer-muted">Oldest first</span>
      </div>

      {events.length === 0 ? (
        <div className="organizer-empty">
          <p>All caught up. No events are waiting for a review.</p>
        </div>
      ) : (
        <ul className="staff-queue">
          {events.map((event) => {
            const wait = waiting(event)
            return (
              <li key={event.id}>
                <div>
                  <h3>{event.title}</h3>
                  <p className="organizer-muted">
                    {event.category} · by {event.organizerName} · {formatShortDate(event.startDate)}
                  </p>
                  <span className={`staff-wait${wait.long ? " staff-wait--long" : ""}`}>{wait.text}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/* ---------- Events by status + latest decisions ---------- */

function OverviewPanel({ events, reviews, onPick }) {
  const max = Math.max(1, ...STATUSES.map((status) => events.filter((event) => event.shownStatus === status).length))

  return (
    <section className="organizer-panel" aria-labelledby="overview-title">
      <div className="organizer-panel__header">
        <h2 id="overview-title">Events by status</h2>
        <span className="organizer-muted">Choose one to filter</span>
      </div>

      <ul className="staff-status-list">
        {STATUSES.map((status) => {
          const count = events.filter((event) => event.shownStatus === status).length
          return (
            <li key={status}>
              <button type="button" onClick={() => onPick(status)} aria-label={`${STATUS_LABELS[status]}: ${count} events`}>
                <span>{STATUS_LABELS[status]}</span>
                <span className="seats-list__track" aria-hidden="true">
                  <span className="seats-list__fill" style={{ width: `${(count / max) * 100}%` }} />
                </span>
                <b>{count}</b>
              </button>
            </li>
          )
        })}
      </ul>

      <h3 className="staff-subtitle">Latest decisions</h3>
      {reviews.length === 0 ? (
        <p className="organizer-muted">No reviews yet. Your decisions will show up here.</p>
      ) : (
        <ul className="staff-feed staff-feed--plain">
          {reviews.map((review) => (
            <li key={review.id}>
              <span>
                <strong>{review.eventTitle}</strong>
                <span className="organizer-muted">
                  {DECISIONS[review.decision]?.label} by {review.reviewerName} · {formatShortDate(review.reviewedAt)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* ---------- All events (Admin.viewAllEvents) ---------- */

function EventsPanel({ events, filter, onFilter, onCancel }) {
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState("soonest")

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

  return (
    <section className="organizer-panel" id="all-events" aria-labelledby="all-events-title">
      <div className="organizer-panel__header">
        <h2 id="all-events-title">
          All events <span className="staff-panel-count">({events.length})</span>
        </h2>
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
      </div>

      <div className="organizer-filters" role="group" aria-label="Filter events by status">
        {["ALL", ...STATUSES.filter((status) => counts[status] || status === filter)].map((status) => (
          <button key={status} type="button" aria-pressed={filter === status} onClick={() => onFilter(status)}>
            {status === "ALL" ? "All" : STATUS_LABELS[status]}
            <span className="organizer-filters__count">{counts[status] ?? 0}</span>
          </button>
        ))}
      </div>

      <p className="visually-hidden" aria-live="polite">
        Showing {visible.length} {visible.length === 1 ? "event" : "events"}
      </p>

      {visible.length === 0 ? (
        <div className="organizer-empty">
          <p>No events match.</p>
          <button
            type="button"
            className="organizer-btn"
            onClick={() => {
              onFilter("ALL")
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
                <th scope="col">Registrations</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((event) => (
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
                  <td>
                    {event.registrations} / {event.capacity}
                  </td>
                  <td>
                    <div className="organizer-event__actions">
                      {canCancelEvent(event) && event.status === "PUBLISHED" && (
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
    </section>
  )
}

/* ---------- Users (Admin.manageUsers) ---------- */

function UsersPanel({ users, me, busy, onRole, onSuspend }) {
  const [query, setQuery] = useState("")
  const [role, setRole] = useState("ALL")

  const visible = users
    .filter((user) => role === "ALL" || user.role === role)
    .filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <section className="organizer-panel" id="users" aria-labelledby="users-title">
      <div className="organizer-panel__header">
        <h2 id="users-title">
          Users <span className="staff-panel-count">({users.length})</span>
        </h2>
      </div>

      <div className="organizer-toolbar">
        <label className="organizer-search">
          <span className="visually-hidden">Search users</span>
          <input type="search" value={query} placeholder="Search by name or email…" onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="segmented" role="group" aria-label="Filter users by role">
          {[{ role: "ALL", label: "All" }, ...ROLES].map((item) => (
            <button key={item.role} type="button" aria-pressed={role === item.role} onClick={() => setRole(item.role)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="organizer-empty">
          <p>No users match.</p>
        </div>
      ) : (
        <div className="organizer-table-wrap">
          <table className="organizer-table staff-table">
            <thead>
              <tr>
                <th scope="col">User</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((user) => {
                const isMe = user.id === me.id
                return (
                  <tr key={user.id}>
                    <th scope="row">
                      <span className="staff-person">
                        <span className="staff-person__avatar" aria-hidden="true">
                          {initials(user.name)}
                        </span>
                        <span>
                          {user.name} {isMe && <span className="staff-tag">You</span>}
                          <span className="organizer-muted">{user.email}</span>
                        </span>
                      </span>
                    </th>
                    <td>
                      <select
                        className="staff-role-select"
                        aria-label={`Role of ${user.name}`}
                        value={user.role}
                        disabled={isMe || busy}
                        onChange={(e) => onRole(user, e.target.value)}
                      >
                        {ROLES.map((item) => (
                          <option key={item.role} value={item.role}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <StatusBadge status={user.suspended ? "Suspended" : "Active"} />
                    </td>
                    <td>
                      {isMe ? (
                        <span className="organizer-muted">Your own account</span>
                      ) : (
                        <button
                          type="button"
                          className={`organizer-btn${user.suspended ? "" : " staff-btn--danger-outline"}`}
                          disabled={busy}
                          onClick={() => onSuspend(user)}
                        >
                          {user.suspended ? "Reactivate" : "Suspend"}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/* ---------- The page ---------- */

function Dashboard({ onPendingCount }) {
  const session = useSession()
  const [summary, setSummary] = useState(null)
  const [status, setStatus] = useState("loading")
  const [filter, setFilter] = useState("ALL")
  const [dialog, setDialog] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useToast()
  const [today] = useState(() => ({
    date: cairo(new Date(), { weekday: "long", day: "numeric", month: "long" }),
    greeting: greeting(),
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

  // Opening /?page=admin#users jumps to that section once it exists.
  useEffect(() => {
    if (status === "ready" && window.location.hash) scrollTo(window.location.hash.slice(1))
  }, [status])

  async function run(action) {
    setBusy(true)
    try {
      const message = await action()
      await load()
      setToast(message)
    } catch (caught) {
      setToast(caught.message)
    } finally {
      setBusy(false)
      setDialog(null)
    }
  }

  function showEvents(next) {
    setFilter(next)
    scrollTo("all-events")
  }

  return (
    <>
      <StaffHeader eyebrow={today.date} title={`${today.greeting}, ${session.name.split(" ")[0]}`} />

      {status === "loading" && <p role="status">Loading the admin dashboard…</p>}
      {status === "error" && <p role="alert">We couldn&apos;t load the dashboard. Please refresh.</p>}

      {status === "ready" && (
        <>
          <section className="dashboard-cards" aria-label="Summary. Choose a card to filter the events.">
            <DashboardCard
              label="Total events"
              value={summary.totalEvents}
              note="Show all"
              active={filter === "ALL"}
              onClick={() => showEvents("ALL")}
            />
            <DashboardCard
              label="Pending approvals"
              value={summary.pending}
              note={summary.pending > 0 ? "Waiting for you" : "All caught up"}
              onClick={() => scrollTo("pending-reviews")}
            />
            <DashboardCard
              label="Published events"
              value={summary.published}
              note="Live right now"
              active={filter === "PUBLISHED"}
              onClick={() => showEvents("PUBLISHED")}
            />
            <DashboardCard
              label="Rejected events"
              value={summary.rejected}
              note="Sent back to organizers"
              active={filter === "REJECTED"}
              onClick={() => showEvents("REJECTED")}
            />
          </section>

          <div className="organizer__panels">
            <PendingPanel events={summary.pendingEvents} />
            <OverviewPanel events={summary.events} reviews={summary.recentReviews} onPick={showEvents} />
          </div>

          <EventsPanel
            events={summary.events}
            filter={filter}
            onFilter={setFilter}
            onCancel={(event) => setDialog({ type: "cancel", event })}
          />

          <UsersPanel
            users={summary.users}
            me={session}
            busy={busy}
            onRole={(user, role) => setDialog({ type: "role", user, role })}
            onSuspend={(user) => setDialog({ type: "suspend", user })}
          />
        </>
      )}

      {dialog?.type === "cancel" && (
        <ReasonModal
          title={`Cancel "${dialog.event.title}"?`}
          message="The event is taken down and the organizer is told why. This can't be undone."
          label="Reason shown to the organizer"
          confirmLabel="Cancel event"
          suggestions={CANCEL_REASONS}
          minLength={MIN_FEEDBACK}
          busy={busy}
          onConfirm={(reason) =>
            run(async () => {
              await adminCancelEvent(dialog.event.id, reason)
              return `"${dialog.event.title}" was cancelled.`
            })
          }
          onCancel={() => setDialog(null)}
        />
      )}

      {dialog?.type === "role" && (
        <ConfirmationModal
          title="Change this user's role?"
          message={`${dialog.user.name} will become ${dialog.role === "PARTICIPANT" ? "a participant" : dialog.role === "ADMIN" ? "an admin" : "an organizer"}. The change applies the next time they log in.`}
          confirmLabel="Change role"
          busy={busy}
          onConfirm={() =>
            run(async () => {
              await setUserRole(dialog.user.id, dialog.role, session)
              return `${dialog.user.name} is now ${ROLES.find((item) => item.role === dialog.role).label.toLowerCase()}.`
            })
          }
          onCancel={() => setDialog(null)}
        />
      )}

      {dialog?.type === "suspend" && (
        <ConfirmationModal
          title={dialog.user.suspended ? "Reactivate this account?" : "Suspend this account?"}
          message={
            dialog.user.suspended
              ? `${dialog.user.name} will be able to log in again.`
              : `${dialog.user.name} won't be able to log in until you reactivate the account.`
          }
          confirmLabel={dialog.user.suspended ? "Reactivate" : "Suspend"}
          busy={busy}
          onConfirm={() =>
            run(async () => {
              await setUserSuspended(dialog.user.id, !dialog.user.suspended, session)
              return dialog.user.suspended ? `${dialog.user.name} can log in again.` : `${dialog.user.name} was suspended.`
            })
          }
          onCancel={() => setDialog(null)}
        />
      )}

      <Toast message={toast} onDismiss={() => setToast("")} />
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
