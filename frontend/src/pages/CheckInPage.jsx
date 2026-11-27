import { useEffect, useState } from "react"
import StaffLayout, { StaffHeader } from "../Components/StaffLayout"
import StatusBadge from "../Components/StatusBadge"
import { canCheckIn, listCheckInEvents } from "../services/manageEventService"
import { effectiveStatus, getOrganizerEvent } from "../services/organizerService"
import { formatEventDate } from "../utils/format"
import { pageUrl } from "../utils/navigation"
import "./OrganizerPages.css"
import "./StaffPages.css"

/*
 * Check-in page, used by the event's organizer at the door.
 * The participant shows the ticket they got when their registration was approved,
 * the organizer scans or types its code, and the page says whether to let them in
 * (Ticket.validate). A valid ticket is recorded with the arrival time (CheckIn.recordEntry)
 * and stops working, so it can't be used twice (Ticket.invalidate).
 */

/* ---------- Choose an event (when the page opens without one) ---------- */

function EventPicker() {
  const [events, setEvents] = useState(null)

  useEffect(() => {
    listCheckInEvents()
      .then((list) => setEvents(list.sort((a, b) => a.startDate.localeCompare(b.startDate))))
      .catch(() => setEvents([]))
  }, [])

  return (
    <>
      <StaffHeader eyebrow="Check-in" title="Choose an event" />
      <section className="organizer-panel">
        {events === null && <p role="status">Loading events…</p>}
        {events?.length === 0 && (
          <div className="organizer-empty">
            <p>No published events yet. Check-in opens once an event is published.</p>
          </div>
        )}
        {events?.length > 0 && (
          <div className="staff-picker">
            {events.map((event) => (
              <a key={event.id} href={pageUrl("check-in", { id: event.id })}>
                <StatusBadge status={effectiveStatus(event)} />
                <strong>{event.title}</strong>
                <span className="organizer-muted">{formatEventDate(event.startDate)}</span>
                <span className="organizer-muted">
                  {event.location} · {event.registrations} registered
                </span>
              </a>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

/* ---------- Check-in for one event ---------- */

function CheckIn({ eventId }) {
  const [event, setEvent] = useState(null)
  const [status, setStatus] = useState("loading")
  const [openedAt] = useState(() => Date.now())

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const found = await getOrganizerEvent(eventId)
        if (!active) return
        if (!found) return setStatus("missing")
        setEvent(found)
        if (!canCheckIn(found)) return setStatus("closed")
        if (active) setStatus("ready")
      } catch {
        if (active) setStatus("error")
      }
    }

    load()
    return () => {
      active = false
    }
  }, [eventId])





  if (status === "loading") return <p role="status">Loading check-in…</p>
  if (status === "error") return <p role="alert">We couldn&apos;t load check-in. Please refresh.</p>
  if (status === "missing" || status === "closed") {
    return (
      <div className="organizer-panel">
        <h1 className="staff-title">{status === "missing" ? "Event not found" : "Check-in isn't open"}</h1>
        <p className="organizer-muted">
          {status === "missing"
            ? "This event doesn't exist or was removed."
            : `"${event.title}" is not published, so there are no tickets to check.`}
        </p>
        <a className="organizer-btn organizer-btn--primary staff-top-gap" href={pageUrl("check-in")}>
          Choose another event
        </a>
      </div>
    )
  }

  const notStarted = new Date(event.startDate).getTime() > openedAt



  return (
    <>
      <StaffHeader eyebrow="Check-in" title={event.title} badge={<StatusBadge status={effectiveStatus(event)} />}>
        <p className="organizer-muted staff-header-note">
          {formatEventDate(event.startDate)} · {event.location}
          {notStarted && " · doors aren't open yet"}
        </p>
        <div className="staff-actions staff-top-gap">
          <a className="organizer-btn" href={pageUrl("manage-event", { id: event.id })}>
            Manage event
          </a>
          <a className="organizer-btn" href={pageUrl("check-in")}>
            Switch event
          </a>
        </div>
      </StaffHeader>





    </>
  )
}

function CheckInPage({ eventId }) {
  return (
    <StaffLayout roles={["ORGANIZER"]} active="checkin">
      {eventId ? <CheckIn eventId={eventId} /> : <EventPicker />}
    </StaffLayout>
  )
}

export default CheckInPage
