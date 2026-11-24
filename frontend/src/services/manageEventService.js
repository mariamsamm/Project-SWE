// Registrations and check-in of one event, through the backend:
//   GET  /api/organizers/{id}/events/{eventId}/registrations
//   POST /api/organizers/{id}/registrations/{registrationId}/approve
//   POST /api/organizers/{id}/registrations/{registrationId}/reject   { reason }
//   POST /api/organizers/{id}/events/{eventId}/check-in               { ticketCode }
import { DEFAULT_FORM_FIELDS } from "../data/demoRegistrations"
import { api } from "./api"
import { requireSession } from "./authService"
import { toRow } from "./mappers"
import { effectiveStatus, getMyEvents } from "./organizerService"

function base() {
  return `/api/organizers/${requireSession("ORGANIZER").id}`
}

/* ---------- registrations (EventOrganizer.viewRegistrations) ---------- */

/** Every registration of one event, newest first. */
export async function listRegistrations(eventId) {
  const list = await api(`${base()}/events/${eventId}/registrations`)
  return list.map(toRow).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

/** Seats counted by status, plus check-in progress. */
export function summarize(registrations, capacity) {
  const seats = (status) =>
    registrations.filter((row) => row.status === status).reduce((sum, row) => sum + row.quantity, 0)
  const approved = seats("APPROVED")
  const pending = seats("PENDING")
  const checkedIn = registrations
    .filter((row) => row.status === "APPROVED" && row.checkedInAt)
    .reduce((sum, row) => sum + row.quantity, 0)

  return {
    approved,
    pending,
    rejected: seats("REJECTED"),
    checkedIn,
    registered: approved + pending,
    seatsLeft: Math.max(0, capacity - approved - pending),
  }
}

/** Confirms pending registrations. The backend makes the ticket code and notifies the participant. */
export async function approveRegistrations(eventId, ids) {
  const rows = await listRegistrations(eventId)
  const chosen = rows.filter((row) => ids.includes(row.id) && row.status === "PENDING")
  for (const row of chosen) {
    await api(`${base()}/registrations/${row.id}/approve`, { method: "POST" })
  }
  return chosen.length
}

/** Rejects pending registrations (the reason is optional). */
export async function rejectRegistrations(eventId, ids, reason = "") {
  const rows = await listRegistrations(eventId)
  const chosen = rows.filter((row) => ids.includes(row.id) && row.status === "PENDING")
  if (chosen.length === 0 && ids.length > 0) {
    throw new Error("Only pending registrations can be rejected.")
  }
  for (const row of chosen) {
    await api(`${base()}/registrations/${row.id}/reject`, {
      method: "POST",
      body: { reason: reason.trim() || null },
    })
  }
  return chosen.length
}

/** The backend sends the ticket in a notification when it confirms a booking. */
export async function resendTicket() {
  throw new Error("The ticket was already sent to the participant's notifications when they were confirmed.")
}

/* ---------- registration form (RegistrationForm + FormField) ---------- */

// The backend has no table for extra questions yet, so they stay in this browser.
const FORM_KEY = "eventhub.registrationForms"

function readForms() {
  try {
    return JSON.parse(localStorage.getItem(FORM_KEY) ?? "{}") ?? {}
  } catch {
    return {}
  }
}

export function getFormFields(event) {
  const saved = readForms()[event.id]
  return Array.isArray(saved) ? saved : DEFAULT_FORM_FIELDS
}

/** Returns a message when the form itself is set up wrongly, otherwise "". */
export function validateFormFields(fields) {
  const labels = new Set()
  for (const field of fields) {
    const label = field.label.trim()
    if (!label) return "Every question needs a label."
    if (labels.has(label.toLowerCase())) return `Two questions are called "${label}". Rename one of them.`
    labels.add(label.toLowerCase())
    if (field.type === "select" && field.options.filter((option) => option.trim()).length < 2) {
      return `"${label}" needs at least 2 choices.`
    }
  }
  return ""
}

/** RegistrationForm.addField()/removeField(): saves the whole list of questions. */
export async function saveFormFields(eventId, fields) {
  const problem = validateFormFields(fields)
  if (problem) throw new Error(problem)
  const cleaned = fields.map((field) => ({
    id: field.id,
    label: field.label.trim(),
    type: field.type,
    required: Boolean(field.required),
    options: field.type === "select" ? field.options.map((option) => option.trim()).filter(Boolean) : [],
  }))
  try {
    localStorage.setItem(FORM_KEY, JSON.stringify({ ...readForms(), [eventId]: cleaned }))
  } catch {
    throw new Error("Your browser couldn't save this change.")
  }
  return cleaned
}

/** FormField.validateValue(): the error for one answer, or "". */
export function validateValue(field, value) {
  const text = typeof value === "string" ? value.trim() : value
  const empty = field.type === "checkbox" ? !text : text === "" || text === undefined || text === null
  if (empty) return field.required ? `${field.label} is required.` : ""
  if (field.type === "number" && Number.isNaN(Number(text))) return `${field.label} must be a number.`
  if (field.type === "select" && !field.options.includes(text)) return `Choose one of the options for ${field.label}.`
  return ""
}

/** RegistrationForm.validateAnswers(): { fieldId: error } for every wrong answer. */
export function validateAnswers(fields, answers) {
  const errors = {}
  for (const field of fields) {
    const error = validateValue(field, answers[field.id])
    if (error) errors[field.id] = error
  }
  return errors
}

/* ---------- export ---------- */

function csvCell(value) {
  let text = String(value ?? "")
  // Stop spreadsheet apps from treating a value as a formula.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

/** The registrations as CSV text (opens in Excel). */
export function registrationsToCsv(registrations, fields) {
  const header = ["Name", "Email", "Ticket", "Quantity", "Status", "Ticket code", "Registered", "Checked in"]
  const lines = [
    [...header, ...fields.map((field) => field.label)],
    ...registrations.map((row) => [
      row.name,
      row.email,
      row.ticketName,
      row.quantity,
      row.status,
      row.ticketCode ?? "",
      row.createdAt,
      row.checkedInAt ?? "",
      ...fields.map((field) => row.answers?.[field.id] ?? ""),
    ]),
  ]
  return lines.map((line) => line.map(csvCell).join(",")).join("\r\n")
}

/* ---------- check-in (Ticket.validate + CheckIn.recordEntry) ---------- */

export function normalizeCode(input) {
  const letters = String(input ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
  const body = letters.startsWith("EH") ? letters.slice(2) : letters
  if (body.length !== 8) return String(input ?? "").trim().toUpperCase()
  return `EH-${body.slice(0, 4)}-${body.slice(4)}`
}

/** Events that can check people in. */
export async function listCheckInEvents() {
  const events = await getMyEvents()
  return events.filter((event) => event.status === "PUBLISHED")
}

/**
 * Checks a ticket code at the door.
 * result: "OK" | "ALREADY" | "NOT_APPROVED" | "WRONG_EVENT" | "INVALID"
 */
export async function checkInByCode(eventId, input) {
  const code = normalizeCode(input)
  if (!code) return { result: "INVALID", code }
  try {
    const saved = await api(`${base()}/events/${eventId}/check-in`, { method: "POST", body: { ticketCode: code } })
    return { result: "OK", code, registration: toRow(saved) }
  } catch (error) {
    const text = error.message.toLowerCase()
    if (error.status === 404) return { result: "INVALID", code, message: error.message }
    if (text.includes("already used")) return { result: "ALREADY", code, message: error.message }
    if (text.includes("another event")) return { result: "WRONG_EVENT", code, message: error.message }
    if (text.includes("not confirmed")) return { result: "NOT_APPROVED", code, message: error.message }
    throw error
  }
}

/** Checks someone in from the attendee list (no typing needed). */
export async function checkInById(eventId, registrationId) {
  const row = (await listRegistrations(eventId)).find((item) => item.id === registrationId)
  if (!row?.ticketCode) throw new Error("This registration has no ticket.")
  return checkInByCode(eventId, row.ticketCode)
}

/** The backend keeps check-ins for good, so they can't be undone from here. */
export async function undoCheckIn() {
  throw new Error("Check-ins are saved for good and can't be undone.")
}

export function canCheckIn(event) {
  return effectiveStatus(event) === "PUBLISHED" || effectiveStatus(event) === "COMPLETED"
}
