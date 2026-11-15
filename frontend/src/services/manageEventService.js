// DEMO DATA. Registrations for the organizer pages live in this browser:
//  - sample participants (data/demoRegistrations.js), saved under KEY
//  - real bookings made on this browser by participants (registrationService)
// When the Spring Boot API is ready, replace the function bodies with fetch calls
// (for example GET /api/events/{id}/registrations) and keep the same function names.
import { buildDemoRegistrations, DEFAULT_FORM_FIELDS } from "../data/demoRegistrations"
import { listUsers } from "./authService"
import { sendTicket } from "./notificationService"
import { effectiveStatus, getAllEvents, getOrganizerEvent, updateEvent } from "./organizerService"

const KEY = "eventhub.eventRegistrations"
const LIVE_KEY = "eventhub.registrations" // written by registrationService

/* ---------- storage ---------- */

function readJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "null")
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    throw new Error("Your browser couldn't save this change. Free up browser storage and try again.")
  }
}

/** Sample registrations of one event (created the first time they are needed). */
function demoRows(event) {
  const store = readJson(KEY, {})
  if (!Array.isArray(store[event.id])) {
    const canHaveRegistrations = ["PUBLISHED", "CANCELLED"].includes(event.status)
    store[event.id] = canHaveRegistrations ? buildDemoRegistrations(event) : []
    writeJson(KEY, store)
  }
  return store[event.id]
}

function saveDemoRows(eventId, rows) {
  writeJson(KEY, { ...readJson(KEY, {}), [eventId]: rows })
}

function newTicketCode() {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(4)), (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()
  return `EH-${hex.slice(0, 4)}-${hex.slice(4)}`
}

/** Real bookings use CONFIRMED where the organizer pages say APPROVED. */
async function liveRows(eventId) {
  const live = readJson(LIVE_KEY, [])
  const mine = (Array.isArray(live) ? live : []).filter((item) => String(item.eventId) === String(eventId))
  if (mine.length === 0) return []
  const users = await listUsers()

  return mine.map((item) => {
    const user = users.find((candidate) => candidate.id === item.userId)
    return {
      id: item.id,
      eventId: String(item.eventId),
      live: true,
      name: user?.name ?? "Participant",
      email: user?.email ?? "",
      ticketName: (item.items ?? []).map((ticket) => ticket.name).join(", ") || "Ticket",
      quantity: item.quantity ?? 1,
      total: item.total ?? 0,
      status: item.status === "CONFIRMED" ? "APPROVED" : item.status,
      ticketCode: item.ticketCode ?? null,
      checkedInAt: item.checkedInAt ?? null,
      rejectionReason: item.rejectionReason,
      answers: item.answers ?? {},
      createdAt: item.createdAt,
    }
  })
}

/** Saves changes to rows, each in the place it came from. */
function saveRows(event, changed) {
  const byId = new Map(changed.map((row) => [row.id, row]))

  if (changed.some((row) => !row.live)) {
    const rows = demoRows(event).map((row) => byId.get(row.id) ?? row)
    saveDemoRows(event.id, rows)
  }

  if (changed.some((row) => row.live)) {
    const live = readJson(LIVE_KEY, [])
    writeJson(
      LIVE_KEY,
      live.map((item) => {
        const row = byId.get(item.id)
        if (!row) return item
        return {
          ...item,
          status: row.status === "APPROVED" ? "CONFIRMED" : row.status,
          ticketCode: row.ticketCode ?? item.ticketCode,
          checkedInAt: row.checkedInAt,
          rejectionReason: row.rejectionReason,
        }
      })
    )
  }
}

/** Keeps the event's registration total (dashboard cards) in step with the sample rows. */
async function syncSeatCount(event) {
  const seats = demoRows(event)
    .filter((row) => row.status === "PENDING" || row.status === "APPROVED")
    .reduce((sum, row) => sum + row.quantity, 0)
  if (seats !== event.registrations) await updateEvent(event.id, { registrations: seats })
}

async function requireEvent(eventId) {
  const event = await getOrganizerEvent(eventId)
  if (!event) throw new Error("This event no longer exists.")
  return event
}

/* ---------- registrations (EventOrganizer.viewRegistrations) ---------- */

/** Every registration of one event, newest first. */
export async function listRegistrations(eventId) {
  const event = await requireEvent(eventId)
  const rows = [...demoRows(event), ...(await liveRows(eventId))]
  return rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
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
    seatsLeft: Math.max(0, capacity - approved),
  }
}

/**
 * EventOrganizer.approveParticipant(): approves one or more registrations,
 * creates their tickets and "emails" them. Stops if the event would be over capacity.
 */
export async function approveRegistrations(eventId, ids) {
  const event = await requireEvent(eventId)
  const all = await listRegistrations(eventId)
  const chosen = all.filter((row) => ids.includes(row.id) && row.status !== "APPROVED" && row.status !== "CANCELLED")
  if (chosen.length === 0) return 0

  const needed = chosen.reduce((sum, row) => sum + row.quantity, 0)
  const { seatsLeft } = summarize(all, event.capacity)
  if (needed > seatsLeft) {
    throw new Error(
      seatsLeft === 0
        ? "This event is full, so nobody else can be approved."
        : `Only ${seatsLeft} ${seatsLeft === 1 ? "seat is" : "seats are"} left, but you selected ${needed}.`
    )
  }

  const updated = chosen.map((row) => ({
    ...row,
    status: "APPROVED",
    ticketCode: row.ticketCode ?? newTicketCode(),
    rejectionReason: undefined,
    decidedAt: new Date().toISOString(),
  }))
  saveRows(event, updated)
  await syncSeatCount(event)
  await Promise.all(
    updated.map((row) =>
      sendTicket({ eventId, to: row.email, ticketCode: row.ticketCode, eventTitle: event.title })
    )
  )
  return updated.length
}

/** EventOrganizer.rejectParticipant(): rejects registrations and cancels their tickets. */
export async function rejectRegistrations(eventId, ids, reason = "") {
  const event = await requireEvent(eventId)
  const all = await listRegistrations(eventId)
  const chosen = all.filter((row) => ids.includes(row.id) && row.status !== "REJECTED" && row.status !== "CANCELLED")
  if (chosen.some((row) => row.checkedInAt)) {
    throw new Error("Someone you selected has already checked in, so they can't be rejected.")
  }

  saveRows(
    event,
    chosen.map((row) => ({
      ...row,
      status: "REJECTED",
      rejectionReason: reason.trim() || undefined,
      decidedAt: new Date().toISOString(),
    }))
  )
  await syncSeatCount(event)
  return chosen.length
}

/** Sends the ticket email again (Notification.sendTicket). */
export async function resendTicket(eventId, registrationId) {
  const event = await requireEvent(eventId)
  const row = (await listRegistrations(eventId)).find((item) => item.id === registrationId)
  if (!row || row.status !== "APPROVED") throw new Error("Only approved registrations have a ticket.")
  await sendTicket({ eventId, to: row.email, ticketCode: row.ticketCode, eventTitle: event.title })
}

/* ---------- registration form (RegistrationForm + FormField) ---------- */

export function getFormFields(event) {
  return Array.isArray(event.registrationForm) ? event.registrationForm : DEFAULT_FORM_FIELDS
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
  await updateEvent(eventId, { registrationForm: cleaned })
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
  const events = await getAllEvents()
  return events.filter((event) => event.status === "PUBLISHED")
}

/**
 * Checks a ticket code at the door.
 * result: "OK" | "ALREADY" | "NOT_APPROVED" | "WRONG_EVENT" | "INVALID"
 */
export async function checkInByCode(eventId, input) {
  const code = normalizeCode(input)
  if (!code) return { result: "INVALID", code }

  const event = await requireEvent(eventId)
  const rows = await listRegistrations(eventId)
  const row = rows.find((item) => item.ticketCode === code)

  if (!row) {
    // Maybe the ticket is real but belongs to another event.
    for (const other of await getAllEvents()) {
      if (String(other.id) === String(eventId)) continue
      const match = (await listRegistrations(other.id)).find((item) => item.ticketCode === code)
      if (match) return { result: "WRONG_EVENT", code, registration: match, otherEvent: other }
    }
    return { result: "INVALID", code }
  }

  if (row.status !== "APPROVED") return { result: "NOT_APPROVED", code, registration: row }
  if (row.checkedInAt) return { result: "ALREADY", code, registration: row }

  const updated = { ...row, checkedInAt: new Date().toISOString() }
  saveRows(event, [updated])
  return { result: "OK", code, registration: updated }
}

/** Checks someone in from the attendee list (no code needed). */
export async function checkInById(eventId, registrationId) {
  const row = (await listRegistrations(eventId)).find((item) => item.id === registrationId)
  if (!row?.ticketCode) throw new Error("This registration has no ticket.")
  return checkInByCode(eventId, row.ticketCode)
}

/** Undoes a check-in made by mistake. */
export async function undoCheckIn(eventId, registrationId) {
  const event = await requireEvent(eventId)
  const row = (await listRegistrations(eventId)).find((item) => item.id === registrationId)
  if (!row) throw new Error("This registration no longer exists.")
  saveRows(event, [{ ...row, checkedInAt: null }])
}

export function canCheckIn(event) {
  return effectiveStatus(event) === "PUBLISHED" || effectiveStatus(event) === "COMPLETED"
}
