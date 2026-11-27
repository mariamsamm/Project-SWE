import { useCallback, useEffect, useState } from "react"
import AdminEventsPanel from "../Components/AdminEventsPanel"
import StaffLayout, { StaffHeader } from "../Components/StaffLayout"
import { getAdminSummary } from "../services/adminService"
import "./OrganizerPages.css"
import "./StaffPages.css"

/* The full list of events for the admin: search, filter and sort.
   To review or cancel an event, the admin uses the Event review page. */

function AllEvents({ onPendingCount }) {
  const [summary, setSummary] = useState(null)
  const [status, setStatus] = useState("loading")
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

  return (
    <>
      <StaffHeader eyebrow="Admin" title="All events">
        <p className="organizer-muted staff-header-note">
          Every event on the platform, whatever its status. To review or cancel one, use Event review.
        </p>
      </StaffHeader>

      {status === "loading" && <p role="status">Loading events…</p>}
      {status === "error" && <p role="alert">We couldn&apos;t load the events. Please refresh.</p>}
      {status === "ready" && (
        <AdminEventsPanel
          events={summary.events}
          initialFilter={params.get("status") ?? "ALL"}
          initialSort={params.get("sort") ?? "soonest"}
        />
      )}
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
