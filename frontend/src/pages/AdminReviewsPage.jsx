import { useCallback, useEffect, useMemo, useState } from "react"
import DashboardCard from "../Components/DashboardCard"
import StaffLayout, { StaffHeader } from "../Components/StaffLayout"
import StatusBadge from "../Components/StatusBadge"
import { DECISIONS, getAdminSummary } from "../services/adminService"
import { formatShortDate } from "../utils/format"
import { pageUrl } from "../utils/navigation"
import "./OrganizerPages.css"
import "./StaffPages.css"

const DAY = 24 * 60 * 60 * 1000

/**
 * Where each event is in the review process:
 *  needs   = submitted, the admin must decide (EventReview.approve / reject / requestRevision)
 *  waiting = with the organizer (not submitted yet, or changes requested)
 *  done    = already reviewed, nothing to do
 */
const REVIEW_STATE = {
  PENDING_REVIEW: { tone: "needs", label: "Waiting for your review" },
  REVISION_REQUIRED: { tone: "waiting", label: "With the organizer · changes requested" },
  DRAFT: { tone: "waiting", label: "With the organizer · not submitted yet" },
  PUBLISHED: { tone: "done", label: "Reviewed · approved" },
  COMPLETED: { tone: "done", label: "Reviewed · approved, event has ended" },
  REJECTED: { tone: "done", label: "Reviewed · rejected" },
  CANCELLED: { tone: "done", label: "Cancelled" },
}

const FILTERS = [
  { id: "needs", label: "Waiting for review" },
  { id: "waiting", label: "With the organizer" },
  { id: "done", label: "Reviewed" },
  { id: "ALL", label: "All events" },
]

function reviewState(event) {
  return REVIEW_STATE[event.shownStatus] ?? { tone: "done", label: "No action needed" }
}

/** "Submitted 15 Nov 2026 · waiting 3 days". Long waits are highlighted. */
function waiting(event, now) {
  if (!event.submittedAt) return { text: "Waiting for review", long: false }
  const days = Math.floor((now - new Date(event.submittedAt).getTime()) / DAY)
  return {
    text: `Submitted ${formatShortDate(event.submittedAt)}${days > 0 ? ` · waiting ${days} ${days === 1 ? "day" : "days"}` : ""}`,
    long: days >= 3,
  }
}

/** The latest admin decision on an event, if there is one. */
function lastReview(event) {
  const reviews = event.reviews ?? []
  return reviews[reviews.length - 1] ?? null
}

/* Event review: every event with its review status. Events waiting for a decision come first. */

function Reviews({ onPendingCount }) {
  const [events, setEvents] = useState([])
  const [status, setStatus] = useState("loading")
  const [filter, setFilter] = useState(null)
  const [query, setQuery] = useState("")
  const [now] = useState(() => Date.now())

  const load = useCallback(async () => {
    try {
      const data = await getAdminSummary()
      setEvents(data.events)
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

  const counts = useMemo(() => {
    const result = { ALL: events.length, needs: 0, waiting: 0, done: 0 }
    for (const event of events) result[reviewState(event).tone] += 1
    return result
  }, [events])

  // Open on "Needs approval" when something is waiting, otherwise show every event.
  const shownFilter = filter ?? (counts.needs > 0 ? "needs" : "ALL")

  const visible = useMemo(() => {
    const order = { needs: 0, waiting: 1, done: 2 }
    const words = query.trim().toLowerCase()
    return events
      .filter((event) => shownFilter === "ALL" || reviewState(event).tone === shownFilter)
      .filter((event) => !words || `${event.title} ${event.organizerName} ${event.category}`.toLowerCase().includes(words))
      .sort((a, b) => {
        const byTone = order[reviewState(a).tone] - order[reviewState(b).tone]
        if (byTone !== 0) return byTone
        // Waiting longest first for pending events, soonest date first for the rest.
        if (a.status === "PENDING_REVIEW") return String(a.submittedAt ?? "").localeCompare(String(b.submittedAt ?? ""))
        return String(a.startDate).localeCompare(String(b.startDate))
      })
  }, [events, shownFilter, query])

  return (
    <>
      <StaffHeader eyebrow="Admin" title="Event review">
        <p className="organizer-muted staff-header-note">
          Approve, reject or ask for changes on submitted events, and see the review status of every event.
        </p>
      </StaffHeader>

      {status === "loading" && <p role="status">Loading events…</p>}
      {status === "error" && <p role="alert">We couldn&apos;t load the events. Please refresh.</p>}

      {status === "ready" && (
        <section className="dashboard-cards" aria-label="Review summary. Choose a card to filter the list.">
          <DashboardCard
            label="Waiting for review"
            value={counts.needs}
            note={counts.needs > 0 ? "Need your decision" : "All caught up"}
            active={shownFilter === "needs"}
            onClick={() => setFilter("needs")}
          />
          <DashboardCard
            label="With the organizer"
            value={counts.waiting}
            note="Drafts and changes requested"
            active={shownFilter === "waiting"}
            onClick={() => setFilter("waiting")}
          />
          <DashboardCard
            label="Reviewed"
            value={counts.done}
            note="Approved, rejected or cancelled"
            active={shownFilter === "done"}
            onClick={() => setFilter("done")}
          />
          <DashboardCard
            label="All events"
            value={counts.ALL}
            note="Show everything"
            active={shownFilter === "ALL"}
            onClick={() => setFilter("ALL")}
          />
        </section>
      )}

      {status === "ready" && (
        <section className="organizer-panel" aria-labelledby="reviews-title">
          <div className="organizer-panel__header organizer-panel__header--wrap">
            <h2 id="reviews-title">
              {counts.needs > 0
                ? `${counts.needs} ${counts.needs === 1 ? "event is" : "events are"} waiting for your review`
                : "No events are waiting for review"}
            </h2>
            <span className="organizer-muted">{events.length} events in total</span>
          </div>

          <div className="organizer-toolbar">
            <label className="organizer-search">
              <span className="visually-hidden">Search events</span>
              <input
                type="search"
                value={query}
                placeholder="Search by name, organizer or category…"
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>

          <div className="organizer-filters" role="group" aria-label="Filter events by review status">
            {FILTERS.map((item) => (
              <button key={item.id} type="button" aria-pressed={shownFilter === item.id} onClick={() => setFilter(item.id)}>
                {item.label}
                <span className="organizer-filters__count">{counts[item.id]}</span>
              </button>
            ))}
          </div>

          <p className="visually-hidden" aria-live="polite">
            Showing {visible.length} {visible.length === 1 ? "event" : "events"}
          </p>

          {visible.length === 0 ? (
            <div className="organizer-empty">
              <p>
                {shownFilter === "needs" && !query
                  ? "Nothing is waiting for your review right now."
                  : "No events match."}
              </p>
              <button
                type="button"
                className="organizer-btn"
                onClick={() => {
                  setFilter("ALL")
                  setQuery("")
                }}
              >
                Show all events
              </button>
            </div>
          ) : (
            <ul className="staff-queue">
              {visible.map((event) => {
                const state = reviewState(event)
                const review = lastReview(event)
                const wait = event.status === "PENDING_REVIEW" ? waiting(event, now) : null
                return (
                  <li key={event.id} className={`staff-queue__item--${state.tone}`}>
                    <div>
                      <h3>
                        {event.title} <StatusBadge status={event.shownStatus} />
                      </h3>
                      <p className="organizer-muted">
                        {event.organizerName} · {event.startDate ? formatShortDate(event.startDate) : "No date"} ·{" "}
                        {event.category}
                      </p>
                      <span className={`staff-review-state staff-review-state--${state.tone}`}>{state.label}</span>
                      {wait && <span className={`staff-wait${wait.long ? " staff-wait--long" : ""}`}> · {wait.text}</span>}
                      {!wait && review && (
                        <span className="organizer-muted">
                          {" "}
                          · last decision: {DECISIONS[review.decision]?.label.toLowerCase()} by {review.reviewerName},{" "}
                          {formatShortDate(review.reviewedAt)}
                        </span>
                      )}
                    </div>
                    <a
                      className={`organizer-btn${state.tone === "needs" ? " organizer-btn--primary" : ""}`}
                      href={pageUrl("review-event", { id: event.id })}
                    >
                      {state.tone === "needs" ? "Review now →" : "View review"}
                    </a>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}
    </>
  )
}

function AdminReviewsPage() {
  const [pendingCount, setPendingCount] = useState(0)
  return (
    <StaffLayout roles={["ADMIN"]} active="pending" pendingCount={pendingCount}>
      <Reviews onPendingCount={setPendingCount} />
    </StaffLayout>
  )
}

export default AdminReviewsPage
