import { useEffect, useRef, useState } from "react"
import EventCard from "../Components/EventCard"
import { getEvents } from "../services/eventService"
import "./HomePage.css"

const eventDateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Cairo",
})

function HomePage() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [featuredIndex, setFeaturedIndex] = useState(0)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const carouselRef = useRef(null)

  const featuredEvent = events[featuredIndex]

  useEffect(() => {
    let active = true

    async function loadEvents() {
      try {
        const data = await getEvents()
        if (active) setEvents(data)
      } catch {
        if (active) setError("Unable to load events. Please try again later.")
      } finally {
        if (active) setLoading(false)
      }
    }

    loadEvents()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const carousel = carouselRef.current
    if (!carousel) return

    function updateArrows() {
      const maxScroll = carousel.scrollWidth - carousel.clientWidth
      setCanGoBack(carousel.scrollLeft > 2)
      setCanGoForward(carousel.scrollLeft < maxScroll - 2)
    }

    updateArrows()
    carousel.addEventListener("scroll", updateArrows, { passive: true })

    const observer = new ResizeObserver(updateArrows)
    observer.observe(carousel)

    return () => {
      carousel.removeEventListener("scroll", updateArrows)
      observer.disconnect()
    }
  }, [events, loading, error])

  function moveFeatured(direction) {
    setFeaturedIndex((index) => (index + direction + events.length) % events.length)
  }

  function moveUpcoming(direction) {
    const carousel = carouselRef.current
    const card = carousel?.querySelector(".event-card")
    if (!card) return

    const gap = parseFloat(getComputedStyle(carousel).columnGap) || 0
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    carousel.scrollBy({
      left: direction * (card.getBoundingClientRect().width + gap),
      behavior: reduceMotion ? "auto" : "smooth",
    })
  }

  return (
    <main>
      {featuredEvent ? (
        <section className="featured-events" aria-label="Featured events">
          <div className="featured-events__slide" aria-live="polite">
            <div className="featured-events__info">
              <p className="featured-events__category">{featuredEvent.category}</p>
              <h1>{featuredEvent.title}</h1>

              <time dateTime={featuredEvent.startDate}>
                {eventDateFormat.format(new Date(featuredEvent.startDate))}
                {" · Cairo time"}
              </time>

              <p className="featured-events__venue">{featuredEvent.location}</p>

              <a
                className="featured-events__action"
                href={`/?event=${encodeURIComponent(featuredEvent.id)}`}
              >
                View tickets
              </a>
            </div>

            {featuredEvent.imageUrl && (
              <img
                className="featured-events__poster"
                src={featuredEvent.imageUrl}
                alt=""
              />
            )}
          </div>

          {events.length > 1 && (
            <div className="featured-events__controls">
              <div className="carousel-controls">
                <button
                  type="button"
                  aria-label="Previous featured event"
                  onClick={() => moveFeatured(-1)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m14 6-6 6 6 6" />
                  </svg>
                </button>

                <button
                  type="button"
                  aria-label="Next featured event"
                  onClick={() => moveFeatured(1)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m10 6 6 6-6 6" />
                  </svg>
                </button>
              </div>

              <span>{featuredIndex + 1} of {events.length}</span>
            </div>
          )}
        </section>
      ) : (
        <h1>Discover upcoming events</h1>
      )}

      <div className="events-toolbar" id="upcoming-events">
        <h2 id="upcoming-events-title">Upcoming events</h2>

        {!loading && !error && events.length > 0 && (
          <div className="carousel-controls">
            <button
              type="button"
              aria-label="Previous upcoming events"
              aria-controls="events-carousel"
              disabled={!canGoBack}
              onClick={() => moveUpcoming(-1)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m14 6-6 6 6 6" />
              </svg>
            </button>

            <button
              type="button"
              aria-label="Next upcoming events"
              aria-controls="events-carousel"
              disabled={!canGoForward}
              onClick={() => moveUpcoming(1)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m10 6 6 6-6 6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {loading && <p role="status">Loading events…</p>}
      {error && <p role="alert">{error}</p>}

      {!loading && !error && (
        events.length === 0 ? (
          <p>No events are available yet. Check back soon.</p>
        ) : (
          <section
            id="events-carousel"
            className="event-carousel"
            aria-labelledby="upcoming-events-title"
            tabIndex={0}
            ref={carouselRef}
          >
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </section>
        )
      )}
    </main>
  )
}

export default HomePage