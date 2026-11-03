import { useRef, useState } from "react"
import "./TicketBooking.css"

const demoSessionKey = "eventhub-demo-session"

const formatPrice = new Intl.NumberFormat("en-EG", {
  style: "currency",
  currency: "EGP",
}).format

function TicketBooking({ event }) {
  const categories = event.ticketCategories ?? []
  console.log("TicketBooking received:", event.title, event.ticketCategories)
  const [quantities, setQuantities] = useState({})
  const [signedIn, setSignedIn] = useState(
    () => sessionStorage.getItem(demoSessionKey) === "true"
  )
  const [message, setMessage] = useState("")
  const dialogRef = useRef(null)

  const count = categories.reduce(
    (sum, category) => sum + (quantities[category.id] ?? 0),
    0
  )

  const total = categories.reduce(
    (sum, category) => sum + category.price * (quantities[category.id] ?? 0),
    0
  )

  function changeQuantity(category, change) {
    setQuantities((current) => ({
      ...current,
      [category.id]: Math.max(
        0,
        Math.min(category.available, (current[category.id] ?? 0) + change)
      ),
    }))
    setMessage("")
  }

  function handleBooking() {
    if (!signedIn) {
      dialogRef.current.showModal()
      return
    }

    setMessage(
      `Booking preview: ${count} ${count === 1 ? "ticket" : "tickets"} for ${
        event.title
      }, ${formatPrice(total)}. ${
        event.approvalMode === "MANUAL"
          ? "This event requires organizer approval."
          : "This event uses automatic approval."
      }`
    )
  }

  function handleSignIn(e) {
    e.preventDefault()
    sessionStorage.setItem(demoSessionKey, "true")
    setSignedIn(true)
    dialogRef.current.close()
    e.currentTarget.reset()
    setMessage("Signed in for this demo. Select Book now to review your booking.")
  }

  return (
    <section className="ticket-booking" aria-labelledby="ticket-heading">
      <h2 id="ticket-heading">Select tickets</h2>

      {categories.length === 0 && <p>Ticket options are unavailable.</p>}

      {categories.map((category) => {
        const quantity = quantities[category.id] ?? 0

        return (
          <div className="ticket-option" key={category.id}>
            <div>
              <strong>{category.name}</strong>
              <p>
                {formatPrice(category.price)} per ticket
                {category.available === 0 && " · Sold out"}
              </p>
            </div>

            <div className="ticket-stepper">
              <button
                type="button"
                aria-label={`Remove one ${category.name} ticket`}
                disabled={quantity === 0}
                onClick={() => changeQuantity(category, -1)}
              >
                −
              </button>
              <output aria-label={`${category.name} quantity`}>{quantity}</output>
              <button
                type="button"
                aria-label={`Add one ${category.name} ticket`}
                disabled={quantity >= category.available}
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

          <button
            type="button"
            className="ticket-primary"
            disabled={count === 0}
            onClick={handleBooking}
          >
            {signedIn ? "Book now" : "Sign in and book now"}
          </button>
        </>
      )}

      <p role="status">{message}</p>

      <dialog ref={dialogRef} className="ticket-dialog" aria-labelledby="signin-title">
        <form onSubmit={handleSignIn}>
          <h2 id="signin-title">Sign in to book</h2>
          <p>Demo sign-in. Use test credentials.</p>

          <label htmlFor="booking-email">Email</label>
          <input id="booking-email" type="email" autoComplete="email" required />

          <label htmlFor="booking-password">Password</label>
          <input
            id="booking-password"
            type="password"
            autoComplete="current-password"
            required
          />

          <div className="ticket-dialog__actions">
            <button type="button" onClick={() => dialogRef.current.close()}>
              Cancel
            </button>
            <button type="submit" className="ticket-primary">Sign in</button>
          </div>
        </form>
      </dialog>
    </section>
  )
}

export default TicketBooking