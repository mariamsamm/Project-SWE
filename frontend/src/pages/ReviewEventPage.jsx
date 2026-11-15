import { useCallback, useEffect, useState } from "react"
import ConfirmationModal from "../Components/ConfirmationModal"
import ReasonModal from "../Components/ReasonModal"
import StaffLayout, { StaffHeader } from "../Components/StaffLayout"
import StatusBadge from "../Components/StatusBadge"
import Toast from "../Components/Toast"
import { useSession } from "../hooks/useSession"
import { useToast } from "../hooks/useToast"
import {
  adminCancelEvent,
  DECISIONS,
  getEventForReview,
  getPendingIds,
  MIN_FEEDBACK,
  reviewEvent,
  validateEvent,
} from "../services/adminService"
import { formatEventDate, formatPrice } from "../utils/format"
import { pageUrl } from "../utils/navigation"
import "./OrganizerPages.css"
import "./StaffPages.css"

const OPTIONS = [
  { decision: "APPROVED", label: "Approve and publish", hint: "The event goes live and people can register." },
  { decision: "REVISION_REQUIRED", label: "Request changes", hint: "The organizer fixes it and submits again." },
  { decision: "REJECTED", label: "Reject", hint: "The event is turned down." },
]

const QUICK_FEEDBACK = {
  REVISION_REQUIRED: [
    "Please add more detail to the description.",
    "Please upload a cover image.",
    "The date or time looks wrong. Please check it.",
  ],
  REJECTED: [
    "The venue is booked on that date. Please choose another day.",
    "This event doesn't fit the platform rules.",
    "This is a duplicate of an existing event.",
  ],
}

const CONFIRM_TEXT = {
  APPROVED: { title: "Approve and publish?", confirm: "Publish" },
  REVISION_REQUIRED: { title: "Send back for changes?", confirm: "Request changes" },
  REJECTED: { title: "Reject this event?", confirm: "Reject" },
}

const DONE_TEXT = {
  APPROVED: "The event is now published.",
  REVISION_REQUIRED: "The organizer was asked to make changes.",
  REJECTED: "The event was rejected.",
}

function initials(name) {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

/* ---------- What the organizer submitted ---------- */

function EventDetails({ event }) {
  const tickets = event.ticketCategories ?? []

  return (
    <div className="staff-review__main">
      <section className="organizer-panel" aria-label="Event details">
        <div className="staff-review__cover">
          {event.imageUrl ? <img src={event.imageUrl} alt="" /> : <span aria-hidden="true">{initials(event.title || "Event")}</span>}
        </div>

        <p className="staff-review__description">{event.description || "No description was given."}</p>

        <dl className="staff-facts">
          <div>
            <dt>Category</dt>
            <dd>{event.category || "Not set"}</dd>
          </div>
          <div>
            <dt>Venue</dt>
            <dd>
              {event.location || "Not set"}
              {event.address && <small>{event.address}</small>}
            </dd>
          </div>
          <div>
            <dt>Starts</dt>
            <dd>{event.startDate ? formatEventDate(event.startDate) : "Not set"}</dd>
          </div>
          <div>
            <dt>Ends</dt>
            <dd>{event.endDate ? formatEventDate(event.endDate) : "Not set"}</dd>
          </div>
          <div>
            <dt>Registration closes</dt>
            <dd>{event.registrationDeadline ? formatEventDate(event.registrationDeadline) : "Not set"}</dd>
          </div>
          <div>
            <dt>Capacity</dt>
            <dd>{event.capacity} seats</dd>
          </div>
          <div>
            <dt>Approval mode</dt>
            <dd>
              {event.approvalMode === "MANUAL" ? "Manual" : "Automatic"}
              <small>
                {event.approvalMode === "MANUAL"
                  ? "The organizer approves each participant"
                  : "Participants are approved instantly"}
              </small>
            </dd>
          </div>
        </dl>
      </section>

      <section className="organizer-panel" aria-labelledby="tickets-title">
        <h2 id="tickets-title">Tickets</h2>
        {tickets.length === 0 ? (
          <p className="organizer-muted">No tickets were added.</p>
        ) : (
          <div className="organizer-table-wrap">
            <table className="organizer-table">
              <thead>
                <tr>
                  <th scope="col">Type</th>
                  <th scope="col">Price</th>
                  <th scope="col">Seats</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.name}>
                    <th scope="row">{ticket.name}</th>
                    <td>{ticket.price > 0 ? formatPrice(ticket.price) : "Free"}</td>
                    <td>{ticket.capacity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(event.facilities ?? []).length > 0 && (
          <>
            <h3 className="staff-subtitle staff-top-gap">Facilities</h3>
            <ul className="staff-pills">
              {event.facilities.map((facility) => (
                <li key={facility}>{facility}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="organizer-panel" aria-labelledby="organizer-title">
        <h2 id="organizer-title">Organizer</h2>
        <span className="staff-person">
          <span className="staff-person__avatar" aria-hidden="true">
            {initials(event.organizerName)}
          </span>
          <span>
            <strong>{event.organizerName}</strong>
            <span className="organizer-muted">{event.organizerEmail}</span>
          </span>
        </span>
        {event.submittedAt && (
          <p className="organizer-muted staff-top-gap">Submitted {formatEventDate(event.submittedAt)}</p>
        )}
      </section>
    </div>
  )
}

/* ---------- Automatic checks (Event.validate) ---------- */

function ChecksPanel({ checks }) {
  const problems = checks.filter((check) => !check.ok && !check.optional).length

  return (
    <section className="organizer-panel" aria-labelledby="checks-title">
      <div className="organizer-panel__header">
        <h2 id="checks-title">Automatic checks</h2>
        <span className={problems ? "trend trend--down" : "trend trend--up"}>
          {problems ? `${problems} ${problems === 1 ? "problem" : "problems"}` : "All passed"}
        </span>
      </div>
      <ul className="staff-checks">
        {checks.map((check) => (
          <li key={check.label}>
            <span
              className={`staff-checks__mark${check.ok ? "" : check.optional ? " staff-checks__mark--warn" : " staff-checks__mark--fail"}`}
              aria-hidden="true"
            >
              {check.ok ? "✓" : "!"}
            </span>
            <span>
              <span className="visually-hidden">{check.ok ? "Passed: " : "Problem: "}</span>
              {check.label}
              {!check.ok && <small>{check.detail}</small>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ---------- Decision form (EventReview.approve / requestRevision / reject) ---------- */

function DecisionPanel({ problems, onDecide }) {
  const [decision, setDecision] = useState("")
  const [feedback, setFeedback] = useState("")
  const [error, setError] = useState("")
  const needsReason = decision === "REVISION_REQUIRED" || decision === "REJECTED"

  function submit(e) {
    e.preventDefault()
    if (!decision) return setError("Choose a decision first.")
    if (needsReason && feedback.trim().length < MIN_FEEDBACK) {
      return setError(`Tell the organizer why, in at least ${MIN_FEEDBACK} characters.`)
    }
    setError("")
    onDecide(decision, feedback.trim())
  }

  return (
    <section className="organizer-panel" aria-labelledby="decision-title">
      <h2 id="decision-title">Your decision</h2>
      <form className="staff-decision" onSubmit={submit} noValidate>
        <div className="staff-options" role="radiogroup" aria-labelledby="decision-title">
          {OPTIONS.map((option) => (
            <label key={option.decision} className="staff-option">
              <input
                type="radio"
                name="decision"
                value={option.decision}
                checked={decision === option.decision}
                onChange={() => {
                  setDecision(option.decision)
                  setError("")
                }}
              />
              <span className="staff-option__box">
                {option.label}
                <small>{option.hint}</small>
              </span>
            </label>
          ))}
        </div>

        {decision === "APPROVED" && problems > 0 && (
          <p className="staff-note staff-note--danger">
            {problems} automatic {problems === 1 ? "check" : "checks"} failed. Are you sure this event is ready?
          </p>
        )}

        {decision && (
          <label className="staff-field">
            <span>
              {needsReason ? "Feedback for the organizer" : "Note for the organizer"} {!needsReason && <small>(optional)</small>}
            </span>
            <textarea
              rows={4}
              value={feedback}
              maxLength={500}
              aria-invalid={Boolean(error) && needsReason}
              onChange={(e) => {
                setFeedback(e.target.value)
                setError("")
              }}
            />
          </label>
        )}

        {needsReason && (
          <div className="staff-chips" role="group" aria-label="Quick feedback">
            {QUICK_FEEDBACK[decision].map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => {
                  setFeedback(text)
                  setError("")
                }}
              >
                {text}
              </button>
            ))}
          </div>
        )}

        {error && (
          <p className="staff-error" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className={`organizer-btn ${decision === "REJECTED" ? "staff-btn--danger" : "organizer-btn--primary"}`}
        >
          {decision ? CONFIRM_TEXT[decision].confirm : "Submit decision"}
        </button>
      </form>
    </section>
  )
}

function HistoryPanel({ reviews }) {
  if (reviews.length === 0) return null
  return (
    <section className="organizer-panel" aria-labelledby="history-title">
      <h2 id="history-title">Review history</h2>
      <ul className="staff-history">
        {[...reviews].reverse().map((review) => (
          <li key={review.id}>
            <strong>{DECISIONS[review.decision]?.label ?? review.decision}</strong>
            <span className="organizer-muted">
              {review.reviewerName} · {formatEventDate(review.reviewedAt)}
            </span>
            {review.feedback && <p>{review.feedback}</p>}
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ---------- The page ---------- */

function Review({ eventId, onPendingCount }) {
  const session = useSession()
  const [event, setEvent] = useState(null)
  const [others, setOthers] = useState([])
  const [status, setStatus] = useState("loading")
  const [dialog, setDialog] = useState(null)
  const [done, setDone] = useState("")
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useToast()

  const load = useCallback(async () => {
    try {
      const [found, pendingIds] = await Promise.all([eventId ? getEventForReview(eventId) : null, getPendingIds(eventId)])
      if (!found) return setStatus("missing")
      setEvent(found)
      setOthers(pendingIds)
      onPendingCount(pendingIds.length + (found.status === "PENDING_REVIEW" ? 1 : 0))
      setStatus("ready")
    } catch {
      setStatus("error")
    }
  }, [eventId, onPendingCount])

  useEffect(() => {
    async function start() {
      await load()
    }
    start()
  }, [load])

  async function run(action) {
    setBusy(true)
    try {
      await action()
      await load()
    } catch (caught) {
      setToast(caught.message)
    } finally {
      setBusy(false)
      setDialog(null)
    }
  }

  if (status === "loading") return <p role="status">Loading the event…</p>
  if (status === "error") return <p role="alert">We couldn&apos;t load this event. Please refresh.</p>
  if (status === "missing") {
    return (
      <div className="organizer-panel">
        <h1 className="staff-title">Event not found</h1>
        <p className="organizer-muted">This event doesn&apos;t exist or was removed.</p>
        <a className="organizer-btn organizer-btn--primary staff-top-gap" href={pageUrl("admin")}>
          Back to dashboard
        </a>
      </div>
    )
  }

  const checks = validateEvent(event)
  const problems = checks.filter((check) => !check.ok && !check.optional).length
  const isPending = event.status === "PENDING_REVIEW"

  return (
    <>
      <StaffHeader
        eyebrow={isPending ? "Review event" : "Event details"}
        title={event.title || "Untitled event"}
        badge={<StatusBadge status={event.shownStatus} />}
      />

      <div className="staff-review">
        <EventDetails event={event} />

        <div className="staff-review__side">
          {done && (
            <section className="organizer-panel staff-done" role="status">
              <h2>Decision saved</h2>
              <p className="staff-note staff-note--success">{DONE_TEXT[done]} The organizer was notified.</p>
              <div className="staff-actions">
                {others.length > 0 && (
                  <a className="organizer-btn organizer-btn--primary" href={pageUrl("review-event", { id: others[0] })}>
                    Review next event ({others.length} left)
                  </a>
                )}
                <a className="organizer-btn" href={pageUrl("admin")}>
                  Back to dashboard
                </a>
              </div>
            </section>
          )}

          {isPending && (
            <>
              <ChecksPanel checks={checks} />
              <DecisionPanel problems={problems} onDecide={(decision, feedback) => setDialog({ type: "decide", decision, feedback })} />
            </>
          )}

          {!isPending && !done && (
            <section className="organizer-panel">
              <h2>Nothing to decide</h2>
              <p className="organizer-muted">
                {event.status === "DRAFT"
                  ? "The organizer hasn't submitted this event yet."
                  : event.status === "REVISION_REQUIRED"
                    ? "Waiting for the organizer to make changes and submit again."
                    : event.status === "CANCELLED"
                      ? `This event was cancelled.${event.cancelReason ? ` Reason: ${event.cancelReason}` : ""}`
                      : "This event has already been reviewed."}
              </p>
            </section>
          )}

          {event.status === "PUBLISHED" && event.shownStatus === "PUBLISHED" && (
            <section className="organizer-panel">
              <h2>Take this event down</h2>
              <p className="organizer-muted">
                {event.registrations} of {event.capacity} seats are registered. Cancelling can&apos;t be undone.
              </p>
              <button
                type="button"
                className="organizer-btn staff-btn--danger-outline staff-top-gap"
                onClick={() => setDialog({ type: "cancel" })}
              >
                Cancel event
              </button>
            </section>
          )}

          <HistoryPanel reviews={event.reviews ?? []} />
        </div>
      </div>

      {dialog?.type === "decide" && (
        <ConfirmationModal
          title={CONFIRM_TEXT[dialog.decision].title}
          message={
            dialog.decision === "APPROVED"
              ? `"${event.title}" will be published and ${event.organizerName} will be told.`
              : `${event.organizerName} will get your feedback: "${dialog.feedback}"`
          }
          confirmLabel={CONFIRM_TEXT[dialog.decision].confirm}
          busy={busy}
          onConfirm={() =>
            run(async () => {
              await reviewEvent(event.id, dialog.decision, dialog.feedback, session)
              setDone(dialog.decision)
            })
          }
          onCancel={() => setDialog(null)}
        />
      )}

      {dialog?.type === "cancel" && (
        <ReasonModal
          title={`Cancel "${event.title}"?`}
          message="The event is taken down and the organizer is told why. This can't be undone."
          label="Reason shown to the organizer"
          confirmLabel="Cancel event"
          minLength={MIN_FEEDBACK}
          busy={busy}
          onConfirm={(reason) =>
            run(async () => {
              await adminCancelEvent(event.id, reason)
              setToast("The event was cancelled.")
            })
          }
          onCancel={() => setDialog(null)}
        />
      )}

      <Toast message={toast} onDismiss={() => setToast("")} />
    </>
  )
}

function ReviewEventPage({ eventId }) {
  const [pendingCount, setPendingCount] = useState(0)
  return (
    <StaffLayout roles={["ADMIN"]} active="pending" pendingCount={pendingCount}>
      <Review eventId={eventId} onPendingCount={setPendingCount} />
    </StaffLayout>
  )
}

export default ReviewEventPage
