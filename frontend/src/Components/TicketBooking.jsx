import { useRef, useState } from "react"
import LoginForm from "./LoginForm"
import { useSession } from "../hooks/useSession"
import {
  MAX_TICKETS_PER_BOOKING,
  createRegistration,
  getBookedCounts,
} from "../services/registrationService"
import { formatPrice } from "../utils/format"
import { pageUrl } from "../utils/navigation"
import "./TicketBooking.css"

function TicketBooking({ event }) {
  const categories = event.ticketCategories ?? []
  const session = useSession()

  const [quantities, setQuantities] = useState({})
  const [booked, setBooked] = useState(() => getBookedCounts(event.id))
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const dialogRef = useRef(null)
  const bookingInProgress = useRef(false)

  function remainingOf(category) {
    return Math.max(0, category.available - (booked[category.id] ?? 0))
  }

  const count = categories.reduce(
    (sum, category) => sum + (quantities[category.id] ?? 0),
    0
  )

  const total = categories.reduce(
    (sum, category) =>
      sum + category.price * (quantities[category.id] ?? 0),
    0
  )

  function changeQuantity(category, change) {
    setQuantities((current) => {
      const currentQuantity = current[category.id] ?? 0
      const selectedCount = categories.reduce(
        (sum, item) => sum + (current[item.id] ?? 0),
        0
      )

      if (
        change > 0 &&
        (currentQuantity >= remainingOf(category) ||
          selectedCount >= MAX_TICKETS_PER_BOOKING)
      ) {
        return current
      }

      return {
        ...current,
        [category.id]: Math.max(0, currentQuantity + change),
      }
    })

    setError("")
  }

  async function submitBooking(user) {
    if (bookingInProgress.current || count === 0) return

    bookingInProgress.current = true
    setBusy(true)
    setError("")

    let registration

    try {
      registration = await createRegistration({ event, user, quantities })
    } catch (caught) {
      setError(caught.message || "We couldn't save your booking. Please try again.")
      setBooked(getBookedCounts(event.id))
      bookingInProgress.current = false
      setBusy(false)
      return
    }

    window.location.assign(pageUrl("ticket", { id: registration.id }))
  }

  function handleBooking() {
    if (bookingInProgress.current || count === 0) return

    if (session) {
      void submitBooking(session)
      return
    }

    dialogRef.current.showModal()
  }

  function handleSignedIn(user) {
    dialogRef.current.close()
    void submitBooking(user)
  }

  return (
    <section className="ticket-booking" aria-labelledby="ticket-heading">
      <h2 id="ticket-heading">Select tickets</h2>

      {categories.length === 0 && <p>Ticket options are unavailable.</p>}

      {categories.map((category) => {
        const quantity = quantities[category.id] ?? 0
        const remaining = remainingOf(category)

        return (
          <div className="ticket-option" key={category.id}>
            <div>
              <strong>{category.name}</strong>
              <p>
                {formatPrice(category.price)} per ticket
                {remaining === 0 ? " · Sold out" : ` · ${remaining} left`}
              </p>
            </div>

            <div className="ticket-stepper">
              <button
                type="button"
                aria-label={`Remove one ${category.name} ticket`}
                disabled={busy || quantity === 0}
                onClick={() => changeQuantity(category, -1)}
              >
                −
              </button>

              <output aria-label={`${category.name} quantity`}>{quantity}</output>

              <button
                type="button"
                aria-label={`Add one ${category.name} ticket`}
                disabled={
                  busy ||
                  quantity >= remaining ||
                  count >= MAX_TICKETS_PER_BOOKING
                }
                onClick={() => changeQuantity(category, 1)}
              >
                +
              </button>
            </div>
          </div>
        )
      })}

      {categories.length > 0 && (
        <>
          <p className="ticket-total" aria-live="polite">
            {count} {count === 1 ? "ticket" : "tickets"} · {formatPrice(total)}
          </p>

          {count >= MAX_TICKETS_PER_BOOKING && (
            <p>Maximum {MAX_TICKETS_PER_BOOKING} tickets per booking.</p>
          )}

          <button
            type="button"
            className="ticket-primary"
            disabled={count === 0 || busy}
            onClick={handleBooking}
          >
            {busy ? "Booking…" : session ? "Book now" : "Sign in and book now"}
          </button>
        </>
      )}

      {error && <p role="alert">{error}</p>}

      <dialog
        ref={dialogRef}
        className="ticket-dialog"
        aria-labelledby="signin-title"
      >
        <h2 id="signin-title">Log in to book</h2>

        <LoginForm
          idPrefix="booking"
          onSuccess={handleSignedIn}
          onCancel={() => dialogRef.current.close()}
        />

        <p>
          No account?{" "}
          <a
            href={pageUrl("signup", {
              next: window.location.pathname + window.location.search,
            })}
          >
            Sign up
          </a>
        </p>
      </dialog>
    </section>
  )
}

export default TicketBooking