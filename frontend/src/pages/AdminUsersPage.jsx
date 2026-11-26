import { useCallback, useEffect, useState } from "react"
import ConfirmationModal from "../Components/ConfirmationModal"
import StaffLayout, { StaffHeader } from "../Components/StaffLayout"
import StatusBadge from "../Components/StatusBadge"
import Toast from "../Components/Toast"
import { useSession } from "../hooks/useSession"
import { useToast } from "../hooks/useToast"
import { getAdminSummary, ROLES, setUserRole, setUserSuspended } from "../services/adminService"
import "./OrganizerPages.css"
import "./StaffPages.css"

function initials(name) {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

/* ---------- Users (Admin.manageUsers) ---------- */

function UsersPanel({ users, me, busy, onRole, onSuspend }) {
  const [query, setQuery] = useState("")
  const [role, setRole] = useState("ALL")

  const visible = users
    .filter((user) => role === "ALL" || user.role === role)
    .filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <section className="organizer-panel" id="users" aria-labelledby="users-title">
      <div className="organizer-panel__header">
        <h2 id="users-title">
          Users <span className="staff-panel-count">({users.length})</span>
        </h2>
      </div>

      <div className="organizer-toolbar">
        <label className="organizer-search">
          <span className="visually-hidden">Search users</span>
          <input type="search" value={query} placeholder="Search by name or email…" onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="segmented" role="group" aria-label="Filter users by role">
          {[{ role: "ALL", label: "All" }, ...ROLES].map((item) => (
            <button key={item.role} type="button" aria-pressed={role === item.role} onClick={() => setRole(item.role)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="organizer-empty">
          <p>No users match.</p>
        </div>
      ) : (
        <div className="organizer-table-wrap">
          <table className="organizer-table staff-table">
            <thead>
              <tr>
                <th scope="col">User</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((user) => {
                const isMe = user.id === me.id
                return (
                  <tr key={user.id}>
                    <th scope="row">
                      <span className="staff-person">
                        <span className="staff-person__avatar" aria-hidden="true">
                          {initials(user.name)}
                        </span>
                        <span>
                          {user.name} {isMe && <span className="staff-tag">You</span>}
                          <span className="organizer-muted">{user.email}</span>
                        </span>
                      </span>
                    </th>
                    <td>
                      <select
                        className="staff-role-select"
                        aria-label={`Role of ${user.name}`}
                        value={user.role}
                        disabled={isMe || busy}
                        onChange={(e) => onRole(user, e.target.value)}
                      >
                        {ROLES.map((item) => (
                          <option key={item.role} value={item.role}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <StatusBadge status={user.suspended ? "Suspended" : "Active"} />
                    </td>
                    <td>
                      {isMe ? (
                        <span className="organizer-muted">Your own account</span>
                      ) : (
                        <button
                          type="button"
                          className={`organizer-btn${user.suspended ? "" : " staff-btn--danger-outline"}`}
                          disabled={busy}
                          onClick={() => onSuspend(user)}
                        >
                          {user.suspended ? "Reactivate" : "Suspend"}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/* ---------- The page ---------- */

function Users({ onPendingCount }) {
  const session = useSession()
  const [summary, setSummary] = useState(null)
  const [status, setStatus] = useState("loading")
  const [dialog, setDialog] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useToast()

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

  async function run(action) {
    setBusy(true)
    try {
      const message = await action()
      await load()
      setToast(message)
    } catch (caught) {
      setToast(caught.message)
    } finally {
      setBusy(false)
      setDialog(null)
    }
  }

  const roleWords = { PARTICIPANT: "a participant", ORGANIZER: "an organizer", ADMIN: "an admin" }

  return (
    <>
      <StaffHeader eyebrow="Admin" title="Users">
        <p className="organizer-muted staff-header-note">Change what people can do, or suspend an account.</p>
      </StaffHeader>

      {status === "loading" && <p role="status">Loading users…</p>}
      {status === "error" && <p role="alert">We couldn&apos;t load the users. Please refresh.</p>}
      {status === "ready" && (
        <UsersPanel
          users={summary.users}
          me={session}
          busy={busy}
          onRole={(user, role) => setDialog({ type: "role", user, role })}
          onSuspend={(user) => setDialog({ type: "suspend", user })}
        />
      )}

      {dialog?.type === "role" && (
        <ConfirmationModal
          title="Change this user's role?"
          message={`${dialog.user.name} will become ${roleWords[dialog.role]}. The change applies the next time they log in.`}
          confirmLabel="Change role"
          busy={busy}
          onConfirm={() =>
            run(async () => {
              await setUserRole(dialog.user.id, dialog.role, session)
              return `${dialog.user.name} is now ${roleWords[dialog.role]}.`
            })
          }
          onCancel={() => setDialog(null)}
        />
      )}

      {dialog?.type === "suspend" && (
        <ConfirmationModal
          title={dialog.user.suspended ? "Reactivate this account?" : "Suspend this account?"}
          message={
            dialog.user.suspended
              ? `${dialog.user.name} will be able to log in again.`
              : `${dialog.user.name} won't be able to log in until you reactivate the account.`
          }
          confirmLabel={dialog.user.suspended ? "Reactivate" : "Suspend"}
          busy={busy}
          onConfirm={() =>
            run(async () => {
              await setUserSuspended(dialog.user.id, !dialog.user.suspended, session)
              return dialog.user.suspended ? `${dialog.user.name} can log in again.` : `${dialog.user.name} was suspended.`
            })
          }
          onCancel={() => setDialog(null)}
        />
      )}

      <Toast message={toast} onDismiss={() => setToast("")} />
    </>
  )
}

function AdminUsersPage() {
  const [pendingCount, setPendingCount] = useState(0)
  return (
    <StaffLayout roles={["ADMIN"]} active="users" pendingCount={pendingCount}>
      <Users onPendingCount={setPendingCount} />
    </StaffLayout>
  )
}

export default AdminUsersPage
