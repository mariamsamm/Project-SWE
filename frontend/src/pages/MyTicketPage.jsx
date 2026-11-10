import { useEffect, useState } from "react"
import QRCode from "../Components/QRCode"
import StatusBadge from "../Components/StatusBadge"
import { useSession } from "../hooks/useSession"
import { getMyRegistration } from "../services/registrationService"
import { formatEventDate, formatPrice } from "../utils/format"
import { currentPathWithSearch, goTo, pageUrl } from "../utils/navigation"
import "./AccountPages.css"

function MyTicketPage({ registrationId }) {
  const session = useSession()
  const [registration, setRegistration] = useState(null)
  const [status, setStatus] = useState("loading")

  useEffect(() => {
    if (!session) {
      goTo(pageUrl("login", { next: currentPathWithSearch() }))
      return
    }
    let active = true
    getMyRegistration(registrationId, session.id)
      .then((found) => {
        if (!active) return
        setRegistration(found)
        setStatus("ready")
      })
      .catch(() => active && setStatus("error"))
    return () => {
      active = false
    }
  }, [registrationId, session])

  const back = <a href={pageUrl("registrations")}>← My registrations</a>

  if (!session) return <main className="account-page"><p role="status">Redirecting to log in…</p></main>

  if (status === "loading") return <main className="account-page"><p role="status">Loading your ticket…</p></main>

  if (status === "error") {
    return (
      <main className="account-page">
        {back}
        <p role="alert">We couldn&apos;t load this ticket. Please try again.</p>
      </main>
    )
  }

  // Same message for "missing" and "someone else's" so ids cannot be probed.
  if (!registration) {
    return (
      <main className="account-page">
        {back}
        <h1>Ticket not found</h1>
        <p>This ticket doesn&apos;t exist or isn&apos;t on your account.</p>
      </main>
    )
  }

  const event = registration.event
  const hasTicket = registration.status === "CONFIRMED" && registration.ticketCode

  return (
    <main className="account-page">
      {back}
      <h1>My ticket</h1>

      <article className="ticket-card">
        <div className="ticket-card__top">
          <h2>{event?.title ?? "Event no longer available"}</h2>
          <StatusBadge status={registration.status} />
        </div>

        {event && (
          <dl className="ticket-card__details">
            <dt>Date and time</dt>
            <dd>{formatEventDate(event.startDate)} · Cairo time</dd>
            <dt>Location</dt>
            <dd>{event.location}</dd>
            <dt>Tickets</dt>
            <dd>
              {registration.items.map((item) => `${item.quantity} × ${item.name}`).join(", ")}
            </dd>
            <dt>Total</dt>
            <dd>{formatPrice(registration.total)}</dd>
          </dl>
        )}

        {hasTicket ? (
          <div className="ticket-card__code">
            <QRCode value={registration.ticketCode} label={`QR code for ticket ${registration.ticketCode}`} />
            <p className="ticket-code">{registration.ticketCode}</p>
            <p className="ticket-card__admits">
              Admits {registration.quantity} {registration.quantity === 1 ? "person" : "people"}. Show this at the entrance.
            </p>
            <button type="button" className="btn-secondary" onClick={() => window.print()}>
              Print ticket
            </button>
          </div>
        ) : (
          <p className="registration-card__note">
            {registration.status === "PENDING"
              ? "Your ticket will appear here once the organizer approves your registration."
              : "No ticket was issued for this registration."}
          </p>
        )}
      </article>
    </main>
  )
}

export default MyTicketPage
