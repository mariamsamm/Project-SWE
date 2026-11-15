import { useCallback, useEffect, useState } from "react"
import AdminEventsPanel from "../Components/AdminEventsPanel"
import ReasonModal from "../Components/ReasonModal"
import StaffLayout, { StaffHeader } from "../Components/StaffLayout"
import Toast from "../Components/Toast"
import { useToast } from "../hooks/useToast"
import { adminCancelEvent, getAdminSummary, MIN_FEEDBACK } from "../services/adminService"
import "./OrganizerPages.css"
import "./StaffPages.css"

const CANCEL_REASONS = [
  "This event breaks the platform rules.",
  "The venue reported a double booking.",
  "The organizer asked us to take it down.",
]

/* The full list of events for the admin: search, filter, sort, view and cancel. */

function AllEvents({ onPendingCount }) {
  const [summary, setSummary] = useState(null)
  const [status, setStatus] = useState("loading")
  const [cancelling, setCancelling] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useToast()
  // The dashboard cards link here with a filter, for example ?page=admin-events&status=PUBLISHED
  const [params] = useState(() => new URLSearchParams(window.location.search))

  const load = useCallback(async () => {
    try {
      const data = await getAdminSummary()
      setSummary(data)
      onPendingCount(data.pending)
      setStatus("ready")
    } catch {
      setStatus("error")
    }
  }, [onPendingCount])

  useEffect(() => {
    async function start() {
      await load()
    }
    start()
  }, [load])

  async function confirmCancel(reason) {
    setBusy(true)
    try {
      await adminCancelEvent(cancelling.id, reason)
      await load()
      setToast(`"${cancelling.title}" was cancelled.`)
    } catch (caught) {
      setToast(caught.message)
    } finally {
      setBusy(false)
      setCancelling(null)
    }
  }

  return (
    <>
      <StaffHeader eyebrow="Admin" title="All events">
        <p className="organizer-muted staff-header-note">Every event on the platform, whatever its status.</p>
      </StaffHeader>

      {status === "loading" && <p role="status">Loading events…</p>}
      {status === "error" && <p role="alert">We couldn&apos;t load the events. Please refresh.</p>}
      {status === "ready" && (
        <AdminEventsPanel
          events={summary.events}
          initialFilter={params.get("status") ?? "ALL"}
          initialSort={params.get("sort") ?? "soonest"}
          onCancel={setCancelling}
        />
      )}

      {cancelling && (
        <ReasonModal
          title={`Cancel "${cancelling.title}"?`}
          message="The event is taken down and the organizer is told why. This can't be undone."
          label="Reason shown to the organizer"
          confirmLabel="Cancel event"
          suggestions={CANCEL_REASONS}
          minLength={MIN_FEEDBACK}
          busy={busy}
          onConfirm={confirmCancel}
          onCancel={() => setCancelling(null)}
        />
      )}

      <Toast message={toast} onDismiss={() => setToast("")} />
    </>
  )
}

function AdminEventsPage() {
  const [pendingCount, setPendingCount] = useState(0)
  return (
    <StaffLayout roles={["ADMIN"]} active="events" pendingCount={pendingCount}>
      <AllEvents onPendingCount={setPendingCount} />
    </StaffLayout>
  )
}

export default AdminEventsPage
