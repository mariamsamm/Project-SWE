import { useCallback, useEffect, useMemo, useState } from "react"
import ConfirmationModal from "../Components/ConfirmationModal"
import DashboardCard from "../Components/DashboardCard"
import QRCode from "../Components/QRCode"
import ReasonModal from "../Components/ReasonModal"
import StaffLayout, { StaffHeader } from "../Components/StaffLayout"
import StatusBadge from "../Components/StatusBadge"
import Toast from "../Components/Toast"
import { FIELD_TYPES } from "../data/demoRegistrations"
import { useToast } from "../hooks/useToast"
import { getEvents } from "../services/eventService"
import {
  approveRegistrations,
  canCheckIn,
  getFormFields,
  listRegistrations,
  registrationsToCsv,
  rejectRegistrations,
  resendTicket,
  saveFormFields,
  summarize,
  validateAnswers,
  validateFormFields,
} from "../services/manageEventService"
import { listNotifications, sendEmail } from "../services/notificationService"
import {
  canCancelEvent,
  canEditEvent,
  canSubmitForReview,
  cancelEvent,
  effectiveStatus,
  getOrganizerEvent,
  submitForReview,
} from "../services/organizerService"
import { formatEventDate, formatPrice, formatShortDate } from "../utils/format"
import { pageUrl } from "../utils/navigation"
import "./OrganizerPages.css"
import "./StaffPages.css"

const TABS = [
  { id: "registrations", label: "Registrations" },
  { id: "form", label: "Registration form" },
  { id: "attendance", label: "Attendance" },
  { id: "messages", label: "Messages" },
]

const STATUS_FILTERS = [
  { status: "ALL", label: "All" },
  { status: "PENDING", label: "Awaiting approval" },
  { status: "APPROVED", label: "Approved" },
  { status: "REJECTED", label: "Rejected" },
]

const REJECT_REASONS = [
  "This event is only open to students of the university.",
  "Your registration details were incomplete.",
  "The event is full.",
]

const CANCEL_REASONS = [
  "The venue is no longer available.",
  "Not enough people registered.",
  "The event is postponed. A new date will be announced.",
]

const STATUS_NOTES = {
  DRAFT: "This event is a draft. Only you can see it. Submit it for review when it is ready.",
  PENDING_REVIEW: "An admin is reviewing this event. You can't edit it until they decide.",
  PUBLISHED: "This event is live. Participants can find it and register.",
  COMPLETED: "This event has ended. You can still see who registered and who attended.",
  CANCELLED: "This event was cancelled.",
}

const PAGE_SIZE = 12

function initials(name) {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function downloadText(filename, text) {
  const url = URL.createObjectURL(new Blob(["﻿", text], { type: "text/csv;charset=utf-8" }))
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/* ---------- Event details and actions ---------- */

function EventOverview({ event, status, publicUrl, onSubmit, onCancel, onCopy }) {
  const feedback = (status === "REJECTED" || status === "REVISION_REQUIRED") && event.rejectionReason

  return (
    <section className="organizer-panel staff-overview" aria-label="Event details">
      <div className="staff-overview__poster">
        {event.imageUrl ? (
          <img src={event.imageUrl} alt="" />
        ) : (
          <span aria-hidden="true">{initials(event.title || "Event")}</span>
        )}
      </div>

      <div className="staff-overview__body">
        {feedback ? (
          <p className="staff-note staff-note--danger">
            <strong>{status === "REJECTED" ? "Rejected by the admin:" : "The admin asked for changes:"}</strong> {feedback}
          </p>
        ) : (
          <p className="staff-note">
            {STATUS_NOTES[status]}
            {status === "CANCELLED" && event.cancelReason && ` Reason: ${event.cancelReason}`}
          </p>
        )}

        <dl className="staff-facts">
          <div>
            <dt>Starts</dt>
            <dd>{event.startDate ? formatEventDate(event.startDate) : "Not set"}</dd>
          </div>
          <div>
            <dt>Ends</dt>
            <dd>{event.endDate ? formatEventDate(event.endDate) : "Not set"}</dd>
          </div>
          <div>
            <dt>Venue</dt>
            <dd>
              {event.location || "Not set"}
              {event.address && <small>{event.address}</small>}
            </dd>
          </div>
          <div>
            <dt>Registration closes</dt>
            <dd>{event.registrationDeadline ? formatEventDate(event.registrationDeadline) : "Not set"}</dd>
          </div>
          <div>
            <dt>Approval</dt>
            <dd>
              {event.approvalMode === "MANUAL" ? "Manual" : "Automatic"}
              <small>
                {event.approvalMode === "MANUAL" ? "You approve each participant" : "Participants are approved instantly"}
              </small>
            </dd>
          </div>
          <div>
            <dt>Tickets</dt>
            <dd>
              {(event.ticketCategories ?? []).map((ticket) => (
                <small key={ticket.name} className="staff-facts__ticket">
                  {ticket.name}: {ticket.price > 0 ? formatPrice(ticket.price) : "Free"} · {ticket.capacity} seats
                </small>
              ))}
            </dd>
          </div>
        </dl>

        <div className="staff-actions">
          {canEditEvent(event) && (
            <a className="organizer-btn organizer-btn--primary" href={pageUrl("create-event", { id: event.id })}>
              Edit event
            </a>
          )}
          {canSubmitForReview(event) && (
            <button type="button" className="organizer-btn organizer-btn--outline" onClick={onSubmit}>
              Submit for review
            </button>
          )}
          {canCheckIn(event) && (
            <a className="organizer-btn organizer-btn--primary" href={pageUrl("check-in", { id: event.id })}>
              Open check-in
            </a>
          )}
          {publicUrl && (
            <>
              <a className="organizer-btn" href={publicUrl}>
                View public page
              </a>
              <button type="button" className="organizer-btn" onClick={onCopy}>
                Copy link
              </button>
            </>
          )}
          {canCancelEvent(event) && (
            <button type="button" className="organizer-btn staff-btn--danger-outline" onClick={onCancel}>
              Cancel event
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

/* ---------- Registrations: search, filter, approve, reject ---------- */

function RegistrationDetails({ row, fields, onResend }) {
  return (
    <div className="staff-details">
      <dl className="staff-facts staff-facts--compact">
        <div>
          <dt>Tickets</dt>
          <dd>
            {row.quantity} × {row.ticketName}
            <small>{row.total > 0 ? formatPrice(row.total) : "Free"}</small>
          </dd>
        </div>
        {fields.map((field) => (
          <div key={field.id}>
            <dt>{field.label}</dt>
            <dd>
              {field.type === "checkbox"
                ? row.answers?.[field.id]
                  ? "Yes"
                  : "No"
                : row.answers?.[field.id] || <span className="organizer-muted">No answer</span>}
            </dd>
          </div>
        ))}
        {row.rejectionReason && (
          <div>
            <dt>Reason for rejection</dt>
            <dd>{row.rejectionReason}</dd>
          </div>
        )}
        {row.status === "APPROVED" && (
          <div>
            <dt>Check-in</dt>
            <dd>{row.checkedInAt ? `Arrived ${formatEventDate(row.checkedInAt)}` : "Not arrived yet"}</dd>
          </div>
        )}
      </dl>

      {row.status === "APPROVED" && row.ticketCode && (
        <div className="staff-ticket">
          <QRCode value={row.ticketCode} label={`QR code for ticket ${row.ticketCode}`} />
          <p className="staff-ticket__code">{row.ticketCode}</p>
          <button type="button" className="organizer-btn" onClick={() => onResend(row)}>
            Send ticket again
          </button>
        </div>
      )}
    </div>
  )
}

function RegistrationsTab({ event, status, registrations, fields, busy, onApprove, onReject, onResend }) {
  const [filter, setFilter] = useState(() => (registrations.some((row) => row.status === "PENDING") ? "PENDING" : "ALL"))
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState("newest")
  const [selected, setSelected] = useState(() => new Set())
  const [open, setOpen] = useState(null)
  const [shown, setShown] = useState(PAGE_SIZE)

  const counts = useMemo(() => {
    const result = { ALL: registrations.length }
    for (const row of registrations) result[row.status] = (result[row.status] ?? 0) + 1
    return result
  }, [registrations])

  const visible = useMemo(() => {
    const words = query.trim().toLowerCase()
    const rows = registrations
      .filter((row) => filter === "ALL" || row.status === filter)
      .filter((row) => !words || `${row.name} ${row.email} ${row.ticketCode ?? ""}`.toLowerCase().includes(words))
    if (sort === "name") rows.sort((a, b) => a.name.localeCompare(b.name))
    return rows
  }, [registrations, filter, query, sort])

  const page = visible.slice(0, shown)
  // Only rows that are still on screen stay selected.
  const chosen = visible.filter((row) => selected.has(row.id))
  const canApprove = chosen.filter((row) => row.status === "PENDING" || row.status === "REJECTED")
  const canReject = chosen.filter((row) => row.status === "PENDING" || row.status === "APPROVED")
  const allOnPage = page.length > 0 && page.every((row) => selected.has(row.id))

  function toggle(id) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current)
      for (const row of page) {
        if (allOnPage) next.delete(row.id)
        else next.add(row.id)
      }
      return next
    })
  }

  function changeFilter(next) {
    setFilter(next)
    setShown(PAGE_SIZE)
    setSelected(new Set())
  }

  if (registrations.length === 0) {
    return (
      <div className="organizer-empty">
        <p>
          {status === "PUBLISHED"
            ? "Nobody has registered yet. Share your event link to get the first sign-ups."
            : "Registrations open once the event is published."}
        </p>
      </div>
    )
  }

  return (
    <>
      <p className="organizer-muted staff-tab-intro">
        {event.approvalMode === "MANUAL"
          ? "Manual approval is on: new registrations wait here until you approve or reject them."
          : "Automatic approval is on: new registrations are approved straight away. You can still reject someone."}
      </p>

      <div className="organizer-toolbar">
        <label className="organizer-search">
          <span className="visually-hidden">Search registrations</span>
          <input
            type="search"
            value={query}
            placeholder="Search by name, email or ticket code…"
            onChange={(e) => {
              setQuery(e.target.value)
              setShown(PAGE_SIZE)
            }}
          />
        </label>
        <label className="organizer-select">
          <span>Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Newest first</option>
            <option value="name">Name (A–Z)</option>
          </select>
        </label>
        <button
          type="button"
          className="organizer-btn"
          onClick={() => downloadText(`registrations-event-${event.id}.csv`, registrationsToCsv(visible, fields))}
        >
          Download list (CSV)
        </button>
      </div>

      <div className="organizer-filters" role="group" aria-label="Filter registrations by status">
        {STATUS_FILTERS.map((item) => (
          <button
            key={item.status}
            type="button"
            aria-pressed={filter === item.status}
            onClick={() => changeFilter(item.status)}
          >
            {item.label}
            <span className="organizer-filters__count">{counts[item.status] ?? 0}</span>
          </button>
        ))}
      </div>

      {chosen.length > 0 && (
        <div className="staff-bulk" role="region" aria-label="Actions for selected registrations">
          <strong>{chosen.length} selected</strong>
          <button
            type="button"
            className="organizer-btn organizer-btn--primary"
            disabled={busy || canApprove.length === 0}
            onClick={() => onApprove(canApprove, () => setSelected(new Set()))}
          >
            Approve {canApprove.length > 0 && `(${canApprove.length})`}
          </button>
          <button
            type="button"
            className="organizer-btn staff-btn--danger-outline"
            disabled={busy || canReject.length === 0}
            onClick={() => onReject(canReject, () => setSelected(new Set()))}
          >
            Reject {canReject.length > 0 && `(${canReject.length})`}
          </button>
          <button type="button" className="staff-link" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      <p className="visually-hidden" aria-live="polite">
        Showing {visible.length} {visible.length === 1 ? "registration" : "registrations"}
      </p>

      {visible.length === 0 ? (
        <div className="organizer-empty">
          <p>No registrations match.</p>
          <button
            type="button"
            className="organizer-btn"
            onClick={() => {
              changeFilter("ALL")
              setQuery("")
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="organizer-table-wrap">
          <table className="organizer-table staff-table">
            <thead>
              <tr>
                <th scope="col" className="staff-table__check">
                  <input type="checkbox" checked={allOnPage} onChange={toggleAll} aria-label="Select all shown" />
                </th>
                <th scope="col">Participant</th>
                <th scope="col">Tickets</th>
                <th scope="col">Registered</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {page.map((row) => (
                <RegistrationRow
                  key={row.id}
                  row={row}
                  fields={fields}
                  busy={busy}
                  selected={selected.has(row.id)}
                  open={open === row.id}
                  onToggle={() => toggle(row.id)}
                  onOpen={() => setOpen(open === row.id ? null : row.id)}
                  onApprove={() => onApprove([row])}
                  onReject={() => onReject([row])}
                  onResend={onResend}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {visible.length > shown && (
        <div className="staff-more">
          <button type="button" className="organizer-btn" onClick={() => setShown(shown + PAGE_SIZE)}>
            Show more ({visible.length - shown} left)
          </button>
        </div>
      )}
    </>
  )
}

function RegistrationRow({ row, fields, busy, selected, open, onToggle, onOpen, onApprove, onReject, onResend }) {
  return (
    <>
      <tr className={selected ? "is-selected" : undefined}>
        <td className="staff-table__check">
          <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select ${row.name}`} />
        </td>
        <th scope="row">
          <span className="staff-person">
            <span className="staff-person__avatar" aria-hidden="true">
              {initials(row.name)}
            </span>
            <span>
              {row.name}
              <span className="organizer-muted">{row.email}</span>
            </span>
          </span>
        </th>
        <td>
          {row.quantity} × {row.ticketName}
        </td>
        <td>{formatShortDate(row.createdAt)}</td>
        <td>
          <StatusBadge status={row.status} />
          {row.checkedInAt && <span className="staff-tag">Checked in</span>}
        </td>
        <td>
          <div className="organizer-event__actions">
            {row.status !== "APPROVED" && row.status !== "CANCELLED" && (
              <button type="button" className="organizer-btn organizer-btn--primary" disabled={busy} onClick={onApprove}>
                Approve
              </button>
            )}
            {row.status !== "REJECTED" && row.status !== "CANCELLED" && !row.checkedInAt && (
              <button type="button" className="organizer-btn staff-btn--danger-outline" disabled={busy} onClick={onReject}>
                Reject
              </button>
            )}
            <button type="button" className="organizer-btn" aria-expanded={open} onClick={onOpen}>
              {open ? "Hide" : "Details"}
            </button>
          </div>
        </td>
      </tr>
      {open && (
        <tr className="staff-table__details">
          <td colSpan={6}>
            <RegistrationDetails row={row} fields={fields} onResend={onResend} />
          </td>
        </tr>
      )}
    </>
  )
}

/* ---------- Registration form builder (addField, removeField, validateAnswers) ---------- */

function FormTab({ event, locked, onSaved }) {
  const [fields, setFields] = useState(() => getFormFields(event))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [answers, setAnswers] = useState({})
  const [answerErrors, setAnswerErrors] = useState(null)

  function change(next) {
    setFields(next)
    setDirty(true)
    setError("")
    setAnswerErrors(null)
  }

  function addField(type) {
    change([
      ...fields,
      {
        id: `f-${crypto.randomUUID().slice(0, 8)}`,
        label: "",
        type,
        required: false,
        options: type === "select" ? ["Option 1", "Option 2"] : [],
      },
    ])
  }

  function update(id, patch) {
    change(fields.map((field) => (field.id === id ? { ...field, ...patch } : field)))
  }

  function move(index, step) {
    const next = [...fields]
    const [field] = next.splice(index, 1)
    next.splice(index + step, 0, field)
    change(next)
  }

  async function save() {
    const problem = validateFormFields(fields)
    if (problem) return setError(problem)
    setSaving(true)
    try {
      setFields(await saveFormFields(event.id, fields))
      setDirty(false)
      onSaved("Registration form saved.")
    } catch (caught) {
      setError(caught.message)
    } finally {
      setSaving(false)
    }
  }

  const answerErrorCount = answerErrors ? Object.keys(answerErrors).length : 0

  return (
    <div className="staff-form-builder">
      <div>
        <p className="organizer-muted staff-tab-intro">
          Name and email are always collected. Add the extra questions participants answer when they register.
          {locked && " This event is closed, so the form can't be changed."}
        </p>

        {fields.length === 0 && (
          <div className="organizer-empty">
            <p>No extra questions yet.</p>
          </div>
        )}

        <ol className="staff-fields">
          {fields.map((field, index) => (
            <li key={field.id} className="staff-fields__item">
              <div className="staff-fields__row">
                <label className="staff-field">
                  <span>Question {index + 1}</span>
                  <input
                    type="text"
                    value={field.label}
                    maxLength={60}
                    placeholder="For example: Phone number"
                    disabled={locked}
                    onChange={(e) => update(field.id, { label: e.target.value })}
                  />
                </label>
                <label className="staff-field staff-field--narrow">
                  <span>Answer type</span>
                  <select
                    value={field.type}
                    disabled={locked}
                    onChange={(e) =>
                      update(field.id, {
                        type: e.target.value,
                        options: e.target.value === "select" && field.options.length === 0 ? ["Option 1", "Option 2"] : field.options,
                      })
                    }
                  >
                    {FIELD_TYPES.map((item) => (
                      <option key={item.type} value={item.type}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {field.type === "select" && (
                <label className="staff-field">
                  <span>
                    Choices <small>(separate with commas)</small>
                  </span>
                  <input
                    type="text"
                    value={field.optionsText ?? field.options.join(", ")}
                    disabled={locked}
                    onChange={(e) =>
                      update(field.id, {
                        optionsText: e.target.value,
                        options: e.target.value.split(",").map((option) => option.trim()).filter(Boolean),
                      })
                    }
                  />
                </label>
              )}

              <div className="staff-fields__controls">
                <label className="staff-check">
                  <input
                    type="checkbox"
                    checked={field.required}
                    disabled={locked}
                    onChange={(e) => update(field.id, { required: e.target.checked })}
                  />
                  Required
                </label>
                <span className="staff-fields__buttons">
                  <button
                    type="button"
                    className="staff-icon-btn"
                    aria-label={`Move question ${index + 1} up`}
                    disabled={locked || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="staff-icon-btn"
                    aria-label={`Move question ${index + 1} down`}
                    disabled={locked || index === fields.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="staff-link staff-link--danger"
                    disabled={locked}
                    onClick={() => change(fields.filter((item) => item.id !== field.id))}
                  >
                    Remove
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ol>

        {!locked && (
          <>
            <div className="staff-chips" role="group" aria-label="Add a question">
              {FIELD_TYPES.map((item) => (
                <button key={item.type} type="button" onClick={() => addField(item.type)}>
                  + {item.label}
                </button>
              ))}
            </div>

            {error && (
              <p className="staff-error" role="alert">
                {error}
              </p>
            )}

            <div className="staff-actions">
              <button type="button" className="organizer-btn organizer-btn--primary" disabled={!dirty || saving} onClick={save}>
                {saving ? "Saving…" : "Save form"}
              </button>
              {dirty && (
                <button
                  type="button"
                  className="organizer-btn"
                  onClick={() => {
                    setFields(getFormFields(event))
                    setDirty(false)
                    setError("")
                  }}
                >
                  Discard changes
                </button>
              )}
              <span className="organizer-muted" aria-live="polite">
                {dirty ? "You have unsaved changes" : "All changes saved"}
              </span>
            </div>
          </>
        )}
      </div>

      <form
        className="staff-preview"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          setAnswerErrors(validateAnswers(fields, answers))
        }}
      >
        <p className="staff-preview__title">Preview: what participants see</p>
        <label className="staff-field">
          <span>Full name</span>
          <input type="text" value="Taken from their account" disabled />
        </label>

        {fields.map((field) => (
          <label key={field.id} className={field.type === "checkbox" ? "staff-check" : "staff-field"}>
            {field.type !== "checkbox" && (
              <span>
                {field.label || "Untitled question"} {field.required && <b aria-label="required">*</b>}
              </span>
            )}
            {field.type === "select" ? (
              <select
                value={answers[field.id] ?? ""}
                onChange={(e) => setAnswers({ ...answers, [field.id]: e.target.value })}
              >
                <option value="">Choose…</option>
                {field.options.filter(Boolean).map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            ) : field.type === "checkbox" ? (
              <>
                <input
                  type="checkbox"
                  checked={Boolean(answers[field.id])}
                  onChange={(e) => setAnswers({ ...answers, [field.id]: e.target.checked })}
                />
                {field.label || "Untitled question"} {field.required && <b aria-label="required">*</b>}
              </>
            ) : (
              <input
                type="text"
                inputMode={field.type === "number" ? "numeric" : undefined}
                value={answers[field.id] ?? ""}
                onChange={(e) => setAnswers({ ...answers, [field.id]: e.target.value })}
              />
            )}
            {answerErrors?.[field.id] && <span className="staff-error">{answerErrors[field.id]}</span>}
          </label>
        ))}

        <button type="submit" className="organizer-btn organizer-btn--outline">
          Test the form
        </button>
        {answerErrors && (
          <p className={answerErrorCount ? "staff-error" : "staff-success"} role="status">
            {answerErrorCount
              ? `${answerErrorCount} ${answerErrorCount === 1 ? "answer needs" : "answers need"} fixing.`
              : "All answers are valid. This registration would be accepted."}
          </p>
        )}
      </form>
    </div>
  )
}

/* ---------- Attendance ---------- */

function AttendanceTab({ event, registrations, totals }) {
  const arrived = registrations
    .filter((row) => row.status === "APPROVED" && row.checkedInAt)
    .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt))
  const percent = totals.approved > 0 ? Math.round((totals.checkedIn / totals.approved) * 100) : 0

  return (
    <div className="staff-attendance">
      <div>
        <p className="organizer-panel__big">
          {totals.checkedIn} <span>of {totals.approved} approved seats checked in · {percent}%</span>
        </p>
        <div className="seats-list__track" role="img" aria-label={`${percent}% checked in`}>
          <span className="seats-list__fill seats-list__fill--full" style={{ width: `${percent}%` }} />
        </div>
        <p className="organizer-muted staff-tab-intro">
          {totals.approved - totals.checkedIn} still to arrive.
          {totals.pending > 0 && ` ${totals.pending} seats are waiting for your approval and can't check in yet.`}
        </p>
        {canCheckIn(event) ? (
          <a className="organizer-btn organizer-btn--primary" href={pageUrl("check-in", { id: event.id })}>
            Open check-in
          </a>
        ) : (
          <p className="organizer-muted">Check-in opens once the event is published.</p>
        )}
      </div>

      <div>
        <h3 className="staff-subtitle">Latest arrivals</h3>
        {arrived.length === 0 ? (
          <p className="organizer-muted">Nobody has checked in yet.</p>
        ) : (
          <ul className="staff-feed">
            {arrived.slice(0, 8).map((row) => (
              <li key={row.id}>
                <span className="staff-person__avatar" aria-hidden="true">
                  {initials(row.name)}
                </span>
                <span>
                  <strong>{row.name}</strong>
                  <span className="organizer-muted">
                    {row.quantity} × {row.ticketName} · {formatEventDate(row.checkedInAt)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/* ---------- Messages (Notification.sendEmail) ---------- */

const AUDIENCES = [
  { id: "APPROVED", label: "Approved participants" },
  { id: "PENDING", label: "Awaiting approval" },
  { id: "EVERYONE", label: "Everyone registered" },
]

function MessagesTab({ event, registrations, notifications, onSent }) {
  const [audience, setAudience] = useState("APPROVED")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [sending, setSending] = useState(false)

  const people = registrations.filter((row) =>
    audience === "EVERYONE" ? row.status === "APPROVED" || row.status === "PENDING" : row.status === audience
  )

  async function send(e) {
    e.preventDefault()
    if (!subject.trim() || message.trim().length < 10) return setError("Add a subject and a message of at least 10 characters.")
    if (people.length === 0) return setError("Nobody is in this group yet.")
    setSending(true)
    try {
      await sendEmail({
        eventId: event.id,
        to: AUDIENCES.find((item) => item.id === audience).label,
        recipients: people.length,
        subject: subject.trim(),
        message: message.trim(),
      })
      setSubject("")
      setMessage("")
      setError("")
      onSent(`Message sent to ${people.length} ${people.length === 1 ? "person" : "people"}.`)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="staff-attendance">
      <form className="staff-compose" onSubmit={send} noValidate>
        <h3 className="staff-subtitle">Email your participants</h3>
        <div className="segmented" role="group" aria-label="Who gets this message">
          {AUDIENCES.map((item) => (
            <button key={item.id} type="button" aria-pressed={audience === item.id} onClick={() => setAudience(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <p className="organizer-muted" aria-live="polite">
          {people.length} {people.length === 1 ? "person" : "people"} will get this message.
        </p>
        <label className="staff-field">
          <span>Subject</span>
          <input type="text" value={subject} maxLength={80} onChange={(e) => setSubject(e.target.value)} />
        </label>
        <label className="staff-field">
          <span>Message</span>
          <textarea rows={4} value={message} maxLength={600} onChange={(e) => setMessage(e.target.value)} />
        </label>
        <div className="staff-chips" role="group" aria-label="Quick messages">
          <button
            type="button"
            onClick={() => {
              setSubject(`Reminder: ${event.title}`)
              setMessage(`See you at ${event.location} on ${formatEventDate(event.startDate)}. Bring your ticket QR code.`)
            }}
          >
            Reminder
          </button>
          <button
            type="button"
            onClick={() => {
              setSubject(`Update about ${event.title}`)
              setMessage("There is a change to the event. Please read the details below: ")
            }}
          >
            Change of plan
          </button>
        </div>
        {error && (
          <p className="staff-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="organizer-btn organizer-btn--primary" disabled={sending}>
          {sending ? "Sending…" : "Send message"}
        </button>
        <p className="organizer-muted">Demo: messages are saved in this list. No real email is sent yet.</p>
      </form>

      <div>
        <h3 className="staff-subtitle">Sent ({notifications.length})</h3>
        {notifications.length === 0 ? (
          <p className="organizer-muted">Nothing sent yet. Tickets are emailed here when you approve someone.</p>
        ) : (
          <ul className="staff-feed staff-feed--plain">
            {notifications.slice(0, 10).map((item) => (
              <li key={item.id}>
                <span>
                  <strong>
                    <span className="staff-tag">{item.kind === "TICKET" ? "Ticket" : "Email"}</span> {item.subject}
                  </strong>
                  <span className="organizer-muted">
                    To {item.to}
                    {item.recipients > 1 && ` (${item.recipients})`} · {formatEventDate(item.createdAt)}
                  </span>
                  <span className="organizer-muted">{item.message}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/* ---------- The page ---------- */

function ManageEvent({ eventId }) {
  const [event, setEvent] = useState(null)
  const [registrations, setRegistrations] = useState([])
  const [notifications, setNotifications] = useState([])
  const [publicUrl, setPublicUrl] = useState("")
  const [status, setStatus] = useState("loading")
  const [tab, setTab] = useState("registrations")
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState(null)
  const [toast, setToast] = useToast()

  const load = useCallback(async () => {
    try {
      const found = eventId ? await getOrganizerEvent(eventId) : null
      if (!found) return setStatus("missing")
      const [rows, sent, publicEvents] = await Promise.all([
        listRegistrations(found.id),
        listNotifications(found.id),
        getEvents(),
      ])
      setEvent(found)
      setRegistrations(rows)
      setNotifications(sent)
      const isPublic = found.status === "PUBLISHED" && publicEvents.some((item) => String(item.id) === String(found.id))
      setPublicUrl(isPublic ? `/?event=${encodeURIComponent(found.id)}` : "")
      setStatus("ready")
    } catch {
      setStatus("error")
    }
  }, [eventId])

  useEffect(() => {
    async function start() {
      await load()
    }
    start()
  }, [load])

  /** Runs an action, reloads the page data, then shows a message. */
  async function run(action, done) {
    setBusy(true)
    try {
      const message = await action()
      await load()
      if (message) setToast(message)
      done?.()
    } catch (caught) {
      setToast(caught.message)
    } finally {
      setBusy(false)
      setDialog(null)
    }
  }

  if (status === "loading") return <p role="status">Loading the event…</p>
  if (status === "error") return <p role="alert">We couldn&apos;t load this event. Please refresh.</p>
  if (status === "missing") {
    return (
      <div className="organizer-panel">
        <h1 className="staff-title">Event not found</h1>
        <p className="organizer-muted">This event doesn&apos;t exist or was removed.</p>
        <a className="organizer-btn organizer-btn--primary staff-top-gap" href={pageUrl("organizer")}>
          Back to dashboard
        </a>
      </div>
    )
  }

  const shownStatus = effectiveStatus(event)
  const totals = summarize(registrations, event.capacity)
  const fields = getFormFields(event)
  const pendingCount = registrations.filter((row) => row.status === "PENDING").length
  const people = (rows) => (rows.length === 1 ? rows[0].name : `${rows.length} people`)

  function approve(rows, done) {
    run(async () => {
      const count = await approveRegistrations(event.id, rows.map((row) => row.id))
      return `Approved ${people(rows)}. ${count === 1 ? "Their ticket was" : "Their tickets were"} emailed.`
    }, done)
  }

  return (
    <>
      <StaffHeader eyebrow="Manage event" title={event.title || "Untitled event"} badge={<StatusBadge status={shownStatus} />}>
        <p className="organizer-muted staff-header-note">
          {event.category} · organised by {event.organizerName}
        </p>
      </StaffHeader>

      <EventOverview
        event={event}
        status={shownStatus}
        publicUrl={publicUrl}
        onSubmit={() => setDialog({ type: "submit" })}
        onCancel={() => setDialog({ type: "cancel" })}
        onCopy={async () => {
          try {
            await navigator.clipboard.writeText(new URL(publicUrl, window.location.origin).href)
            setToast("Link copied.")
          } catch {
            setToast("Couldn't copy the link. Copy it from the address bar instead.")
          }
        }}
      />

      <section className="dashboard-cards" aria-label="Registration summary">
        <DashboardCard
          label="Seats taken"
          value={totals.registered}
          note={`of ${event.capacity} · ${Math.max(0, event.capacity - totals.registered)} left`}
        />
        <DashboardCard
          label="Awaiting approval"
          value={pendingCount}
          note={pendingCount > 0 ? "Needs your decision" : "All caught up"}
          onClick={() => setTab("registrations")}
        />
        <DashboardCard label="Approved seats" value={totals.approved} note="Have a ticket" onClick={() => setTab("registrations")} />
        <DashboardCard label="Checked in" value={totals.checkedIn} note="See attendance" onClick={() => setTab("attendance")} />
      </section>

      <section className="organizer-panel" aria-label="Manage this event">
        <div className="staff-tabs" role="tablist" aria-label="Sections">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              aria-selected={tab === item.id}
              aria-controls="manage-panel"
              onClick={() => setTab(item.id)}
            >
              {item.label}
              {item.id === "registrations" && pendingCount > 0 && <span className="staff-count">{pendingCount}</span>}
            </button>
          ))}
        </div>

        <div id="manage-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {tab === "registrations" && (
            <RegistrationsTab
              event={event}
              status={shownStatus}
              registrations={registrations}
              fields={fields}
              busy={busy}
              onApprove={approve}
              onReject={(rows, done) => setDialog({ type: "reject", rows, done })}
              onResend={(row) =>
                run(async () => {
                  await resendTicket(event.id, row.id)
                  return `Ticket sent again to ${row.email || row.name}.`
                })
              }
            />
          )}
          {tab === "form" && (
            <FormTab
              key={event.updatedAt ?? "form"}
              event={event}
              locked={shownStatus === "CANCELLED" || shownStatus === "COMPLETED"}
              onSaved={(message) => run(async () => message)}
            />
          )}
          {tab === "attendance" && <AttendanceTab event={event} registrations={registrations} totals={totals} />}
          {tab === "messages" && (
            <MessagesTab
              event={event}
              registrations={registrations}
              notifications={notifications}
              onSent={(message) => run(async () => message)}
            />
          )}
        </div>
      </section>

      {dialog?.type === "submit" && (
        <ConfirmationModal
          title="Submit for review?"
          message={`"${event.title}" will be sent to an admin. You can't edit it while it is being reviewed.`}
          confirmLabel="Submit"
          busy={busy}
          onConfirm={() =>
            run(async () => {
              await submitForReview(event.id)
              return "Sent to the admin for review."
            })
          }
          onCancel={() => setDialog(null)}
        />
      )}

      {dialog?.type === "reject" && (
        <ReasonModal
          title={`Reject ${people(dialog.rows)}?`}
          message="Their ticket stops working and they are told the reason."
          label="Reason"
          confirmLabel="Reject"
          suggestions={REJECT_REASONS}
          busy={busy}
          onConfirm={(reason) =>
            run(async () => {
              await rejectRegistrations(event.id, dialog.rows.map((row) => row.id), reason)
              return `Rejected ${people(dialog.rows)}.`
            }, dialog.done)
          }
          onCancel={() => setDialog(null)}
        />
      )}

      {dialog?.type === "cancel" && (
        <ReasonModal
          title="Cancel this event?"
          message={`This can't be undone. ${totals.registered} registered seats will be told the event is off.`}
          label="Reason shown to participants"
          confirmLabel="Cancel event"
          suggestions={CANCEL_REASONS}
          minLength={10}
          busy={busy}
          onConfirm={(reason) =>
            run(async () => {
              await cancelEvent(event.id, reason)
              if (totals.registered > 0) {
                await sendEmail({
                  eventId: event.id,
                  to: "Everyone registered",
                  recipients: registrations.filter((row) => row.status === "APPROVED" || row.status === "PENDING").length,
                  subject: `Cancelled: ${event.title}`,
                  message: reason,
                })
              }
              return "The event was cancelled and participants were told."
            })
          }
          onCancel={() => setDialog(null)}
        />
      )}

      <Toast message={toast} onDismiss={() => setToast("")} />
    </>
  )
}

function ManageEventPage({ eventId }) {
  return (
    <StaffLayout roles={["ORGANIZER"]} active="events">
      <ManageEvent eventId={eventId} />
    </StaffLayout>
  )
}

export default ManageEventPage
