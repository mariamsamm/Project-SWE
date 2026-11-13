import { useEffect, useRef, useState } from "react"
import { useSession } from "../hooks/useSession"
import { pageUrl } from "../utils/navigation"
import OrganizerGate from "./OrganizerGate"

/**
 * "Create event" button in the navbar.
 * Organizers go straight to the form; everyone else sees a small pop-up asking them to log in as an organizer.
 */
function CreateEventButton() {
  const session = useSession()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)
  const primaryRef = useRef(null)
  const triggerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    primaryRef.current?.focus()

    function onPointerDown(event) {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false)
    }
    function onKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  if (session?.role === "ORGANIZER") {
    return (
      <a className="site-nav__create" href={pageUrl("create-event")}>
        <span aria-hidden="true">+</span> Create event
      </a>
    )
  }

  return (
    <div className="create-gate" ref={wrapperRef}>
      <button
        ref={triggerRef}
        type="button"
        className="site-nav__create"
        aria-expanded={open}
        aria-controls="create-gate-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">+</span> Create event
      </button>

      {open && (
        <div id="create-gate-panel" className="create-gate__panel" role="dialog" aria-labelledby="create-gate-title">
          <OrganizerGate
            session={session}
            titleId="create-gate-title"
            primaryRef={primaryRef}
            onClose={() => {
              setOpen(false)
              triggerRef.current?.focus()
            }}
          />
        </div>
      )}
    </div>
  )
}

export default CreateEventButton
