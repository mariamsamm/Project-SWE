import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import StaffLayout, { StaffHeader } from "../Components/StaffLayout"
import StatusBadge from "../Components/StatusBadge"
import Toast from "../Components/Toast"
import { useToast } from "../hooks/useToast"
import {
  canCheckIn,
  checkInByCode,
  listCheckInEvents,
  listRegistrations,
  normalizeCode,
} from "../services/manageEventService"
import { effectiveStatus, getOrganizerEvent } from "../services/organizerService"
import { formatEventDate, STATUS_LABELS } from "../utils/format"
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

function timeOf(iso) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Cairo" })
}

/** Adds the time of the scan, so every scan counts as a new result and the box animates again. */
function stamped(answer) {
  return { ...answer, at: Date.now() }
}

/** What to show for each answer from checkInByCode(). */
function describe(outcome) {
  const person = outcome.registration
  const seats = person ? `${person.quantity} × ${person.ticketName}` : ""

  switch (outcome.result) {
    case "OK":
      return {
        tone: "ok",
        icon: "✓",
        title: `Welcome, ${person.name}`,
        text: `Checked in. Admits ${person.quantity}: ${seats}.`,
      }
    case "ALREADY":
      return {
        tone: "warn",
        icon: "!",
        title: "Already checked in",
        text: `${person.name} used this ticket at ${timeOf(person.checkedInAt)}. Don't let it in twice.`,
      }
    case "NOT_APPROVED":
      return {
        tone: "warn",
        icon: "!",
        title: "Ticket not valid",
        text: `${person.name}'s registration is "${STATUS_LABELS[person.status] ?? person.status}", so it can't be used.`,
      }
    case "WRONG_EVENT":
      return {
        tone: "bad",
        icon: "×",
        title: "Ticket is for another event",
        text: `This ticket belongs to ${person.name} for "${outcome.otherEvent.title}".`,
      }
    default:
      return {
        tone: "bad",
        icon: "×",
        title: "Invalid ticket",
        text: outcome.code ? `No ticket has the code ${outcome.code}.` : "Enter a ticket code first.",
      }
  }
}


/* ---------- Camera QR scanner ---------- */

function CameraScanner({ onCode, onError }) {
  const videoRef = useRef(null)
  const handlers = useRef({ onCode, onError })

  useEffect(() => {
    handlers.current = { onCode, onError }
  }, [onCode, onError])

  useEffect(() => {
    const video = videoRef.current
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d", { willReadFrequently: true })
    let stream = null
    let frame = 0
    let stopped = false
    let lastScan = 0
    let last = { code: "", at: 0 }

    function scan(now) {
      if (stopped) return
      frame = requestAnimationFrame(scan)
      // Look at about 5 frames per second: enough to feel instant, light on the battery.
      if (now - lastScan < 200 || video.readyState < 2 || !video.videoWidth) return
      lastScan = now

      const scale = Math.min(1, 640 / video.videoWidth)
      canvas.width = Math.round(video.videoWidth * scale)
      canvas.height = Math.round(video.videoHeight * scale)
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
      const found = jsQR(pixels.data, canvas.width, canvas.height, { inversionAttempts: "dontInvert" })

      // A ticket held in front of the camera is read once. It is only read again
      // after it has been out of view for 2 seconds.
      if (found?.data) {
        const isNew = found.data !== last.code || now - last.at > 2000
        last = { code: found.data, at: now }
        if (isNew) handlers.current.onCode(found.data)
      }
    }

    let jsQR = null

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        return handlers.current.onError("This browser can't use the camera. Type the code instead.")
      }
      try {
        // The QR reader is only downloaded when the camera is first used.
        jsQR = (await import("jsqr")).default
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })
        if (stopped) return stream.getTracks().forEach((track) => track.stop())
        video.srcObject = stream
        await video.play()
        frame = requestAnimationFrame(scan)
      } catch (caught) {
        handlers.current.onError(
          caught?.name === "NotAllowedError"
            ? "Camera access was blocked. Allow the camera in your browser, or type the code instead."
            : "We couldn't start the camera. Type the code instead."
        )
      }
    }

    start()

    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach((track) => track.stop())
      video.srcObject = null
    }
  }, [])

  return (
    <div className="staff-camera">
      <video ref={videoRef} muted playsInline aria-label="Camera view. Hold the QR code inside the frame." />
    </div>
  )
}


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
  const inputRef = useRef(null)
  const [registrations, setRegistrations] = useState([])
  const [otherCode, setOtherCode] = useState("")
  const [code, setCode] = useState("")
  const [outcome, setOutcome] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useToast()
  const [camera, setCamera] = useState(false)
  const [cameraError, setCameraError] = useState("")

  const refresh = useCallback(async () => {
    setRegistrations(await listRegistrations(eventId))
  }, [eventId])

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const found = await getOrganizerEvent(eventId)
        if (!active) return
        if (!found) return setStatus("missing")
        setEvent(found)
        if (!canCheckIn(found)) return setStatus("closed")
        await refresh()

        // A ticket from a different event, so the "wrong event" answer can be tried.
        const others = (await listCheckInEvents()).filter((item) => String(item.id) !== String(eventId))
        for (const other of others) {
          const ticket = (await listRegistrations(other.id)).find((row) => row.status === "APPROVED" && row.ticketCode)
          if (ticket && active) {
            setOtherCode(ticket.ticketCode)
            break
          }
        }
        if (active) setStatus("ready")
      } catch {
        if (active) setStatus("error")
      }
    }

    load()
    return () => {
      active = false
    }
  }, [eventId, refresh])

  const verify = useCallback(
    async (value) => {
      setBusy(true)
      try {
        const answer = await checkInByCode(eventId, value)
        setOutcome(stamped(answer))
        await refresh()
        setCode("")
      } catch (caught) {
        setToast(caught.message)
      } finally {
        setBusy(false)
        inputRef.current?.focus()
      }
    },
    [eventId, refresh, setToast]
  )

  const approved = useMemo(() => registrations.filter((row) => row.status === "APPROVED"), [registrations])




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
  const shown = outcome ? describe(outcome) : null
  const waitingTicket = approved.find((row) => !row.checkedInAt)
  const usedTicket = approved.find((row) => row.checkedInAt)



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


      <div className="staff-checkin">
        <section className="organizer-panel" aria-labelledby="scan-title">
          <div className="organizer-panel__header">
            <h2 id="scan-title">Scan or enter a ticket</h2>
          </div>


          <form
            className="staff-code-form"
            onSubmit={(e) => {
              e.preventDefault()
              verify(code)
            }}
          >
            <label className="visually-hidden" htmlFor="ticket-code">
              Ticket code
            </label>
            <input
              id="ticket-code"
              ref={inputRef}
              type="text"
              value={code}
              placeholder="EH-0000-0000"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={14}
              autoFocus
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onBlur={() => code && setCode(normalizeCode(code))}
            />
            <button type="submit" className="organizer-btn organizer-btn--primary" disabled={busy || !code.trim()}>
              {busy ? "Checking…" : "Verify"}
            </button>
          </form>

          <div className="staff-scan-row">
            <button
              type="button"
              className="organizer-btn organizer-btn--outline"
              aria-pressed={camera}
              onClick={() => {
                setCameraError("")
                setCamera(!camera)
              }}
            >
              {camera ? "Stop camera" : "Scan QR with camera"}
            </button>
            <span className="organizer-muted">{camera ? "Hold the QR code inside the frame." : "Or type the code under the QR."}</span>
          </div>

          {cameraError && (
            <p className="staff-error staff-top-gap" role="alert">
              {cameraError}
            </p>
          )}
          {camera && (
            <CameraScanner
              onCode={verify}
              onError={(message) => {
                setCameraError(message)
                setCamera(false)
              }}
            />
          )}


          <div aria-live="assertive">
            {shown && (
              <div key={outcome.at} className={`staff-result staff-result--${shown.tone}`}>
                <span className="staff-result__icon" aria-hidden="true">
                  {shown.icon}
                </span>
                <div>
                  <h3>{shown.title}</h3>
                  <p>{shown.text}</p>
                </div>
              </div>
            )}
          </div>

          <details className="staff-demo">
            <summary>Need a code to test with?</summary>
            <div className="staff-chips">
              {waitingTicket && (
                <button type="button" onClick={() => setCode(waitingTicket.ticketCode)}>
                  {waitingTicket.ticketCode} (valid)
                </button>
              )}
              {usedTicket && (
                <button type="button" onClick={() => setCode(usedTicket.ticketCode)}>
                  {usedTicket.ticketCode} (already used)
                </button>
              )}
              {otherCode && (
                <button type="button" onClick={() => setCode(otherCode)}>
                  {otherCode} (other event)
                </button>
              )}
              <button type="button" onClick={() => setCode("EH-0000-0000")}>
                EH-0000-0000 (invalid)
              </button>
            </div>
          </details>
        </section>

      </div>

      <Toast message={toast} onDismiss={() => setToast("")} />
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
