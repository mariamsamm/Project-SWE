import { useEffect, useRef, useState } from "react"
import EventCard from "../Components/EventCard"
import { getEvents } from "../services/eventService"
import "./HomePage.css"

function HomePage() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)

  const carouselRef = useRef(null)

  useEffect(() => {
    let active = true

    async function loadEvents() {
      try {
        const data = await getEvents()

        if (active) {
          setEvents(data)
        }
      } catch {
        if (active) {
          setError("Unable to load events. Please try again later.")
        }
      } finally {
        if (active) {
          setLoading(false)
        }
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

    carousel.addEventListener("scroll", updateArrows, {
      passive: true,
    })

    const observer = new ResizeObserver(updateArrows)
    observer.observe(carousel)

    return () => {
      carousel.removeEventListener("scroll", updateArrows)
      observer.disconnect()
    }
  }, [loading, error, events])

  function moveCarousel(direction) {
    const carousel = carouselRef.current
    if (!carousel) return

    const card = carousel.querySelector(".event-card")
    if (!card) return

    const gap = parseFloat(getComputedStyle(carousel).columnGap) || 0

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches

    carousel.scrollBy({
      left: direction * (card.getBoundingClientRect().width + gap),
      behavior: reduceMotion ? "instant" : "smooth",
    })
  }

  return (
    <main>
      <section className="home-hero" aria-labelledby="hero-title">
        <div className="home-hero__content">
          <h1 id="hero-title">
            Your next great experience starts here.
          </h1>

          <p>
            Discover celebrations, workshops, and sporting events.
            Find your event and be part of it.
          </p>

          <a className="home-hero__button" href="#upcoming-events">
            Explore events
          </a>
        </div>
      </section>

      <div className="events-toolbar" id="upcoming-events">
        <h2 id="upcoming-events-title">Upcoming events</h2>

        {!loading && !error && events.length > 0 && (
          <div className="carousel-controls">
            <button
              type="button"
              aria-label="Previous events"
              aria-controls="events-carousel"
              disabled={!canGoBack}
              onClick={() => moveCarousel(-1)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m14 6-6 6 6 6" />
              </svg>
            </button>

            <button
              type="button"
              aria-label="Next events"
              aria-controls="events-carousel"
              disabled={!canGoForward}
              onClick={() => moveCarousel(1)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m10 6 6 6-6 6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {loading && <p role="status">Loading events...</p>}

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