import { useEffect } from "react"
import { useSession } from "../hooks/useSession"
import { currentPathWithSearch, goTo, pageUrl } from "../utils/navigation"
import AdminSidebar from "./AdminSidebar"
import OrganizerSidebar from "./OrganizerSidebar"

const ROLE_WORDS = { ORGANIZER: "event organizers", ADMIN: "admins" }

function initials(name) {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

/** Title row at the top of an organizer or admin page, with the logged-in user on the right. */
export function StaffHeader({ eyebrow, title, badge, children }) {
  const session = useSession()
  return (
    <header className="organizer__header">
      <div>
        <p className="organizer__eyebrow">{eyebrow}</p>
        <h1>
          {title} {badge}
        </h1>
        {children}
      </div>
      {session && (
        <div className="organizer__profile">
          <span className="organizer__avatar" aria-hidden="true">
            {initials(session.name)}
          </span>
          <span>
            {session.name}
            <small>{session.email}</small>
          </span>
        </div>
      )}
    </header>
  )
}

/**
 * Page frame for organizer and admin pages: checks who is logged in,
 * shows the right side menu, and only then shows the page (`children`).
 * `roles` lists who may open the page, for example ["ADMIN"].
 */
function StaffLayout({ roles, active, pendingCount, children }) {
  const session = useSession()
  const allowed = Boolean(session) && roles.includes(session.role)

  // Not logged in: send them to log in, then come back here.
  useEffect(() => {
    if (!session) goTo(pageUrl("login", { next: currentPathWithSearch() }))
  }, [session])

  if (!session) {
    return (
      <main className="organizer organizer--message">
        <p role="status">Redirecting to log in…</p>
      </main>
    )
  }

  if (!allowed) {
    const who = roles.map((role) => ROLE_WORDS[role]).join(" and ")
    return (
      <main className="organizer organizer--message">
        <div className="organizer-panel">
          <h1>{roles.length === 1 && roles[0] === "ADMIN" ? "Admins only" : "Staff only"}</h1>
          <p className="organizer-muted">
            You are logged in as {session.name}. This page is for {who}.
          </p>
          <a className="organizer-btn organizer-btn--primary" href="/">
            Back to events
          </a>
        </div>
      </main>
    )
  }

  return (
    <main className="organizer">
      {session.role === "ADMIN" ? (
        <AdminSidebar active={active} pendingCount={pendingCount} />
      ) : (
        <OrganizerSidebar active={active} />
      )}
      <div className="organizer__content">{children}</div>
    </main>
  )
}

export default StaffLayout
