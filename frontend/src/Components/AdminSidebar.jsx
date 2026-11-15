import { logout } from "../services/authService"
import { pageUrl } from "../utils/navigation"

const ICONS = {
  dashboard: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  pending: "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
  events: "M5 6h14v14H5zM5 10h14M9 3v4M15 3v4",
  users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5a6 6 0 0 1 3.5 5.5",
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
  { id: "dashboard", label: "Dashboard", href: pageUrl("admin") },
  { id: "pending", label: "Pending reviews", href: `${pageUrl("admin")}#pending-reviews` },
  { id: "events", label: "All events", href: `${pageUrl("admin")}#all-events` },
  { id: "users", label: "Users", href: `${pageUrl("admin")}#users` },
]

/** Side menu shared by every admin page. `active` is the id of the current link. */
function AdminSidebar({ active, pendingCount = 0 }) {
  return (
    <aside className="organizer-sidebar">
      <p className="organizer-sidebar__title">Admin</p>
      <nav aria-label="Admin menu">
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
                {link.id === "pending" && pendingCount > 0 && (
                  <span className="staff-count" aria-label={`${pendingCount} waiting`}>
                    {pendingCount}
                  </span>
                )}
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

export default AdminSidebar
