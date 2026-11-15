import { useSession } from "../hooks/useSession"
import { pageUrl } from "../utils/navigation"

/**
 * "Create event" button in the navbar.
 * Only organizers see it. Visitors, participants and admins get nothing here.
 */
function CreateEventButton() {
  const session = useSession()
  if (session?.role !== "ORGANIZER") return null

  return (
    <a className="site-nav__create" href={pageUrl("create-event")}>
      <span aria-hidden="true">+</span> Create event
    </a>
  )
}

export default CreateEventButton
