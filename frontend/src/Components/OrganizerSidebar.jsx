import { logout } from "../services/authService"
import { pageUrl } from "../utils/navigation"

const ICONS = {
  dashboard: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  events: "M5 6h14v14H5zM5 10h14M9 3v4M15 3v4",
  create: "M12 5v14M5 12h14",
  logout: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
}

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const LINKS = [
  { id: "dashboard", label: "Dashboard", href: pageUrl("organizer") },
  { id: "events", label: "My events", href: `${pageUrl("organizer")}#my-events` },
  { id: "create", label: "Create event", href: pageUrl("create-event") },
]

/** Side menu shared by every organizer page. `active` is the id of the current link. */
function OrganizerSidebar({ active }) {
  return (
    <aside className="organizer-sidebar">
      <p className="organizer-sidebar__title">Organizer</p>
      <nav aria-label="Organizer menu">
        <ul>
          {LINKS.map((link) => (
            <li key={link.id}>
              <a
                href={link.href}
                className="organizer-sidebar__link"
                aria-current={active === link.id ? "page" : undefined}
              >
                <Icon name={link.id} />
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <button
        type="button"
        className="organizer-sidebar__link organizer-sidebar__logout"
        onClick={() => {
          logout()
          window.location.assign("/")
        }}
      >
        <Icon name="logout" />
        Log out
      </button>
    </aside>
  )
}

export default OrganizerSidebar
