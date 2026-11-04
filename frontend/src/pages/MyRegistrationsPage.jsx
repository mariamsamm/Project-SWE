import { useEffect, useState } from "react"
import StatusBadge from "../Components/StatusBadge"
import { useSession } from "../hooks/useSession"
import { listMyRegistrations } from "../services/registrationService"
import { formatEventDate, formatPrice } from "../utils/format"
import { currentPathWithSearch, goTo, pageUrl } from "../utils/navigation"
import "./AccountPages.css"

const NOTES = {
  PENDING: "The organizer has not approved this yet. Your ticket appears here once they do.",
  REJECTED: "The organizer declined this registration.",
}

function MyRegistrationsPage() {
  const session = useSession()
  const [registrations, setRegistrations] = useState([])
  const [status, setStatus] = useState("loading")

  useEffect(() => {
    if (!session) {
      goTo(pageUrl("login", { next: currentPathWithSearch() }))
      return
    }
    let active = true
    listMyRegistrations(session.id)
      .then((list) => {
        if (!active) return
        setRegistrations(list)
        setStatus("ready")
      })
      .catch(() => active && setStatus("error"))
    return () => {
      active = false
    }
  }, [session])

  if (!session) return <main className="account-page account-page--wide"><p role="status">Redirecting to log in…</p></main>

  return (
    <main className="account-page account-page--wide">
      <h1>My registrations</h1>

      {status === "loading" && <p role="status">Loading your registrations…</p>}
      {status === "error" && <p role="alert">We couldn&apos;t load your registrations. Please refresh.</p>}

      {status === "ready" && registrations.length === 0 && (
        <div className="empty-state">
          <p>You haven&apos;t registered for any events yet.</p>
          <a className="btn-primary" href="/#upcoming-events">Browse events</a>
        </div>
      )}

      {status === "ready" && registrations.length > 0 && (
        <ul className="registration-list">
          {registrations.map((registration) => (
            <li className="registration-card" key={registration.id}>
              <div className="registration-card__top">
                <h2>{registration.event?.title ?? "Event no longer available"}</h2>
                <StatusBadge status={registration.status} />
              </div>

              {registration.event && (
                <p className="registration-card__meta">
                  {formatEventDate(registration.event.startDate)} · {registration.event.location}
                </p>
              )}

              <ul className="registration-card__items" aria-label="Tickets">
                {registration.items.map((item) => (
                  <li key={item.categoryId}>
                    {item.quantity} × {item.name}
                  </li>
                ))}
              </ul>
              <p className="registration-card__total">
                {registration.quantity} {registration.quantity === 1 ? "ticket" : "tickets"} · {formatPrice(registration.total)}
              </p>

              {NOTES[registration.status] && <p className="registration-card__note">{NOTES[registration.status]}</p>}

              {registration.status === "CONFIRMED" && (
                <a className="btn-primary" href={pageUrl("ticket", { id: registration.id })}>
                  View ticket
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export default MyRegistrationsPage
