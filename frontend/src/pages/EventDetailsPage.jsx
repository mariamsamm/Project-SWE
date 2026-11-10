import { useEffect, useState } from "react"
import TicketBooking from "../Components/TicketBooking"
import { getEvents } from "../services/eventService"

function EventDetailsPage({ eventId }) {
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true

    async function loadEvent() {
      try {
        const events = await getEvents()
        const match = events.find((item) => String(item.id) === eventId)

        if (active) setEvent(match ?? null)
      } catch {
        if (active) {
          setError("We couldn't load this event. Please try again.")
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadEvent()

    return () => {
      active = false
    }
  }, [eventId])

  return (
    <main className="event-details">
        
      {loading && <p role="status">Loading event…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && !event && <h1>Event not found</h1>}

      {!loading && !error && event && (
        <article className="event-details__card">
          {event.imageUrl && <img src={event.imageUrl} alt="" />}

          <div className="event-details__body">
            <span>{event.category}</span>
            <h1>{event.title}</h1>
            <p>{event.description}</p>

            <dl>
              <dt>Date and time</dt>
              <dd>
                <time dateTime={event.startDate}>
                  {new Date(event.startDate).toLocaleString("en-GB", {
                    dateStyle: "long",
                    timeStyle: "short",
                    timeZone: "Africa/Cairo",
                  })}
                </time>
                {" · Cairo time"}
              </dd>

              <dt>Location</dt>
              <dd>{event.location}</dd>

              <dt>Registration approval</dt>
              <dd>
                {event.approvalMode === "MANUAL"
                  ? "Requires organizer approval"
                  : "Automatic approval"}
              </dd>
            </dl>

          </div>

          <TicketBooking key={event.id} event={event} />

        </article>
      )}
    </main>
  )
}

export default EventDetailsPage