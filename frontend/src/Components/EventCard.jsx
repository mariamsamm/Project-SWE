function EventCard({ event }) {
  const formattedDate = new Date(event.startDate).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Cairo",
  })

  return (
    <article className="event-card">
      <div className="event-card__poster">
        <img
          src={event.imageUrl}
          alt=""
          loading="lazy"
        />
        <span className="event-card__category">
          {event.category}
        </span>
      </div>

      <div className="event-card__content">
        <h3>{event.title}</h3>
        <a
  className="event-card__action"
  href={`/?event=${encodeURIComponent(event.id)}`}
  aria-label={`View tickets for ${event.title}`}
>
  View tickets
</a>

        <time dateTime={event.startDate}>
          {formattedDate} · Cairo time
        </time>

        <p className="event-card__location">{event.location}</p>
        <p className="event-card__description">{event.description}</p>
      </div>
    </article>
  )
}

export default EventCard