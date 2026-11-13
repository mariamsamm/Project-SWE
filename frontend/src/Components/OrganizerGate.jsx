import { logout } from "../services/authService"
import { goTo, pageUrl } from "../utils/navigation"

const ROLE_NAMES = { PARTICIPANT: "a participant", ADMIN: "an admin" }

/**
 * Message shown when someone who is not an organizer tries to create an event.
 * Used in the navbar pop-up and on the Create event page itself.
 */
function OrganizerGate({ session, onClose, titleId = "organizer-gate-title", primaryRef }) {
  const loginUrl = pageUrl("login", { next: pageUrl("create-event") })

  return (
    <div className="organizer-gate">
      <span className="organizer-gate__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M5 6h14v14H5zM5 10h14M9 3v4M15 3v4M12 13v4M10 15h4" />
        </svg>
      </span>
      <h2 id={titleId}>Are you an organizer?</h2>
      <p>
        {session
          ? `You're logged in as ${ROLE_NAMES[session.role] ?? "a participant"} (${session.name}). Only organizer accounts can create events.`
          : "Only organizers can create events. Log in with your organizer account to get started."}
      </p>
      <div className="organizer-gate__actions">
        <button
          ref={primaryRef}
          type="button"
          className="organizer-gate__primary"
          onClick={() => {
            if (session) logout()
            goTo(loginUrl)
          }}
        >
          {session ? "Switch to organizer account" : "Log in as organizer"}
        </button>
        {onClose && (
          <button type="button" className="organizer-gate__secondary" onClick={onClose}>
            Not now
          </button>
        )}
      </div>
    </div>
  )
}

export default OrganizerGate
