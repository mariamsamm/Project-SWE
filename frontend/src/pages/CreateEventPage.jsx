import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import ConfirmationModal from "../Components/ConfirmationModal"
import OrganizerGate from "../Components/OrganizerGate"
import OrganizerSidebar from "../Components/OrganizerSidebar"
import { EVENT_CATEGORIES, FACILITIES } from "../data/organizerEvents"
import { useSession } from "../hooks/useSession"
import { canEditEvent, getOrganizerEvent, saveEvent } from "../services/organizerService"
import { formatPrice } from "../utils/format"
import { pageUrl } from "../utils/navigation"
import "./OrganizerPages.css"
import "./CreateEventPage.css"

const STEPS = [
  { title: "Basics", hint: "Name & story" },
  { title: "Date & venue", hint: "When and where" },
  { title: "Tickets", hint: "Seats & prices" },
  { title: "Cover & review", hint: "Final check" },
]

const STEP_FIELDS = [
  ["title", "category", "description"],
  ["startDate", "endDate", "registrationDeadline", "venue", "address"],
  ["tickets"],
  [],
]

const SAMPLE_COVERS = ["/images/christmas.jpg", "/images/workshop.jpg", "/images/sports1.jpg"]
const MAX_TICKET_TYPES = 6
const HOUR = 60 * 60 * 1000

/* ---------- date helpers (the form uses <input type="datetime-local">) ---------- */

const pad = (value) => String(value).padStart(2, "0")

function toInput(iso) {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const toIso = (value) => (value ? new Date(value).toISOString() : "")
const time = (value) => (value ? new Date(value).getTime() : NaN)

function prettyDate(value) {
  return new Date(value).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function duration(start, end) {
  const hours = Math.round((time(end) - time(start)) / HOUR)
  if (!(hours > 0)) return ""
  if (hours < 24) return `Lasts ${hours} ${hours === 1 ? "hour" : "hours"}`
  const days = Math.round(hours / 24)
  return `Lasts ${days} ${days === 1 ? "day" : "days"}`
}

/* ---------- form data ---------- */

let ticketKey = 0
const newTicket = (name = "", price = "0", capacity = "50") => ({ key: `t${++ticketKey}`, name, price, capacity })

function emptyForm() {
  return {
    title: "",
    category: "",
    description: "",
    venue: "",
    address: "",
    startDate: "",
    endDate: "",
    registrationDeadline: "",
    approvalMode: "AUTOMATIC",
    tickets: [newTicket("General Admission")],
    facilities: [],
    imageUrl: "",
  }
}

function formFromEvent(event) {
  return {
    title: event.title ?? "",
    category: event.category ?? "",
    description: event.description ?? "",
    venue: event.location ?? "",
    address: event.address ?? "",
    startDate: toInput(event.startDate),
    endDate: toInput(event.endDate),
    registrationDeadline: toInput(event.registrationDeadline),
    approvalMode: event.approvalMode ?? "AUTOMATIC",
    tickets: (event.ticketCategories?.length
      ? event.ticketCategories
      : [{ name: "General Admission", price: 0, capacity: event.capacity ?? 50 }]
    ).map((ticket) => newTicket(ticket.name, String(ticket.price), String(ticket.capacity))),
    facilities: event.facilities ?? [],
    imageUrl: event.imageUrl ?? "",
  }
}

/** Returns { fieldName: "message" } for everything that still needs fixing. */
function validate(form) {
  const errors = {}
  const now = Date.now()
  const title = form.title.trim()
  const description = form.description.trim()

  if (title.length < 3) errors.title = "Give your event a title (at least 3 characters)."
  else if (title.length > 100) errors.title = "Keep the title under 100 characters."
  if (!form.category) errors.category = "Choose a category."
  if (description.length < 20) errors.description = `Describe the event in at least 20 characters (${description.length}/20).`

  const start = time(form.startDate)
  const end = time(form.endDate)
  const deadline = time(form.registrationDeadline)
  if (!form.startDate) errors.startDate = "Choose when the event starts."
  else if (start <= now) errors.startDate = "The start must be in the future."
  if (!form.endDate) errors.endDate = "Choose when the event ends."
  else if (start && end <= start) errors.endDate = "The end must be after the start."
  if (!form.registrationDeadline) errors.registrationDeadline = "Choose when registration closes."
  else if (deadline <= now) errors.registrationDeadline = "The deadline must be in the future."
  else if (start && deadline > start) errors.registrationDeadline = "Registration must close before the event starts."

  if (!form.venue.trim()) errors.venue = "Add the venue name."
  if (!form.address.trim()) errors.address = "Add the building or address."

  if (form.tickets.length === 0) errors.tickets = "Add at least one ticket type."
  const seen = new Set()
  let seats = 0
  for (const ticket of form.tickets) {
    const name = ticket.name.trim().toLowerCase()
    const price = Number(ticket.price)
    const capacity = Number(ticket.capacity)
    if (!name) errors[`${ticket.key}-name`] = "Name this ticket type."
    else if (seen.has(name)) errors[`${ticket.key}-name`] = "Use a different name for each ticket type."
    seen.add(name)
    if (ticket.price === "" || Number.isNaN(price) || price < 0) errors[`${ticket.key}-price`] = "Enter 0 or more."
    if (!Number.isInteger(capacity) || capacity < 1) errors[`${ticket.key}-capacity`] = "At least 1 seat."
    else seats += capacity
  }
  if (seats > 10000) errors.tickets = "The total can't be more than 10,000 seats."

  return errors
}

const isTicketField = (key) => /^t\d+-/.test(key)
const fieldsOfStep = (step, errors) =>
  Object.keys(errors).filter((key) => STEP_FIELDS[step].includes(key) || (step === 2 && isTicketField(key)))

/** Shrinks big photos so they fit in browser storage. */
function readImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("Please choose an image file (JPG, PNG or WebP)."))
    if (file.size > 8 * 1024 * 1024) return reject(new Error("That image is over 8 MB. Please choose a smaller one."))
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const scale = Math.min(1, 1200 / image.width)
      const canvas = document.createElement("canvas")
      canvas.width = Math.round(image.width * scale)
      canvas.height = Math.round(image.height * scale)
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL("image/jpeg", 0.8))
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("We couldn't read that image. Try another one."))
    }
    image.src = url
  })
}

/* ---------- small building blocks ---------- */

function Field({ id, label, hint, error, counter, children }) {
  return (
    <div className={`ce-field${error ? " has-error" : ""}`}>
      <div className="ce-field__label">
        <label htmlFor={id}>{label}</label>
        {counter && <span className="ce-field__counter">{counter}</span>}
      </div>
      {children}
      {error ? (
        <p className="ce-field__error" id={`${id}-error`}>
          {error}
        </p>
      ) : (
        hint && (
          <p className="ce-field__hint" id={`${id}-hint`}>
            {hint}
          </p>
        )
      )}
    </div>
  )
}

const describe = (id, error, hint) => ({
  id,
  "aria-invalid": Boolean(error),
  "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
})

function Stepper({ step, onStep, isDone }) {
  return (
    <ol className="ce-stepper">
      {STEPS.map((item, index) => {
        const state = index === step ? "current" : isDone(index) ? "done" : "todo"
        return (
          <li key={item.title} className={`ce-stepper__item is-${state}`}>
            <button type="button" aria-current={index === step ? "step" : undefined} onClick={() => onStep(index)}>
              <span className="ce-stepper__dot" aria-hidden="true">
                {state === "done" ? "✓" : index + 1}
              </span>
              <span className="ce-stepper__text">
                <strong>{item.title}</strong>
                <small>{item.hint}</small>
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/* ---------- live preview + checklist ---------- */

function Preview({ form, errors }) {
  const seats = form.tickets.reduce((sum, ticket) => sum + (Number(ticket.capacity) || 0), 0)
  const prices = form.tickets.map((ticket) => Number(ticket.price) || 0)
  const lowest = prices.length ? Math.min(...prices) : 0
  const initials = (form.title.trim() || "New event")
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const checks = [
    { label: "Title", done: !errors.title },
    { label: "Category", done: !errors.category },
    { label: "Description", done: !errors.description },
    { label: "Dates & deadline", done: !errors.startDate && !errors.endDate && !errors.registrationDeadline },
    { label: "Venue", done: !errors.venue && !errors.address },
    { label: "Tickets", done: fieldsOfStep(2, errors).length === 0 },
  ]
  const doneCount = checks.filter((check) => check.done).length
  const percent = Math.round((doneCount / checks.length) * 100)

  return (
    <aside className="ce-preview" aria-label="Live preview">
      <p className="ce-preview__label">Live preview</p>

      <article className="ce-card">
        <div className="ce-card__poster">
          {form.imageUrl ? (
            <img src={form.imageUrl} alt="" />
          ) : (
            <span className="ce-card__placeholder" aria-hidden="true">
              {initials}
            </span>
          )}
          {form.category && <span className="ce-card__chip">{form.category}</span>}
        </div>
        <div className="ce-card__body">
          <h3 className={form.title.trim() ? "" : "is-empty"}>{form.title.trim() || "Your event title"}</h3>
          <p className="ce-card__meta">
            <span aria-hidden="true">◷</span>
            {form.startDate ? prettyDate(form.startDate) : "Date not set"}
          </p>
          <p className="ce-card__meta">
            <span aria-hidden="true">⌖</span>
            {form.venue.trim() || "Venue not set"}
          </p>
          <div className="ce-card__footer">
            <span>{lowest === 0 ? "Free" : `From ${formatPrice(lowest)}`}</span>
            <span>{seats.toLocaleString("en-GB")} seats</span>
          </div>
        </div>
      </article>

      <div className="ce-progress">
        <div className="ce-progress__top">
          <span>Ready to submit</span>
          <strong>{percent}%</strong>
        </div>
        <div className="ce-progress__track" aria-hidden="true">
          <span style={{ width: `${percent}%` }} />
        </div>
        <ul className="ce-checklist">
          {checks.map((check) => (
            <li key={check.label} className={check.done ? "is-done" : ""}>
              <span aria-hidden="true">{check.done ? "✓" : ""}</span>
              {check.label}
              <span className="visually-hidden">{check.done ? " (done)" : " (missing)"}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}

/* ---------- the page ---------- */

function CreateEventPage({ eventId: initialId }) {
  const session = useSession()
  const isOrganizer = session?.role === "ORGANIZER"

  const [eventId, setEventId] = useState(initialId || null)
  const [loadState, setLoadState] = useState(initialId ? "loading" : "ready")
  const [original, setOriginal] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(emptyForm()))
  const [step, setStep] = useState(0)
  const [touched, setTouched] = useState({})
  const [checkedSteps, setCheckedSteps] = useState([])
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [toast, setToast] = useState("")
  const [formError, setFormError] = useState("")
  const [submitted, setSubmitted] = useState(null)
  const [imageError, setImageError] = useState("")
  const [dragging, setDragging] = useState(false)
  const [minDate] = useState(() => toInput(new Date().toISOString()))
  const topRef = useRef(null)
  const fileRef = useRef(null)

  // Edit mode: load the event once.
  useEffect(() => {
    if (!initialId || !isOrganizer) return
    let active = true
    getOrganizerEvent(initialId).then((event) => {
      if (!active) return
      if (!event) return setLoadState("missing")
      if (!canEditEvent(event)) return setLoadState("locked")
      const loaded = formFromEvent(event)
      setOriginal(event)
      setForm(loaded)
      setSavedSnapshot(JSON.stringify(loaded))
      setLoadState("ready")
    })
    return () => {
      active = false
    }
  }, [initialId, isOrganizer])

  const errors = useMemo(() => validate(form), [form])
  const dirty = JSON.stringify(form) !== savedSnapshot

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty || submitted) return
    const warn = (event) => event.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty, submitted])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(""), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  const showError = (field) => (touched[field] || checkedSteps.some((index) => STEP_FIELDS[index].includes(field))) && errors[field]
  const showTicketError = (key) => (checkedSteps.includes(2) || touched[key]) && errors[key]
  const isDone = (index) => checkedSteps.includes(index) && fieldsOfStep(index, errors).length === 0 && index < 3

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setFormError("")
  }
  const blur = (field) => () => setTouched((current) => ({ ...current, [field]: true }))
  const markChecked = (...indexes) => setCheckedSteps((current) => [...new Set([...current, ...indexes])])

  function goToStep(index) {
    setStep(index)
    setFormError("")
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  function next() {
    markChecked(step)
    if (fieldsOfStep(step, errors).length > 0) {
      setFormError("Please fix the highlighted fields to continue.")
      return
    }
    goToStep(step + 1)
  }

  const saveDraft = useCallback(async () => {
    if (errors.title) {
      setTouched((current) => ({ ...current, title: true }))
      setStep(0)
      setFormError("Add a title first, so you can find your draft later.")
      return
    }
    setBusy(true)
    try {
      const saved = await saveEvent(serialize(form), { submit: false, eventId })
      setEventId(saved.id)
      setSavedSnapshot(JSON.stringify(form))
      window.history.replaceState(null, "", pageUrl("create-event", { id: saved.id }))
      setFormError("")
      setToast("Draft saved. You can come back to it any time from your dashboard.")
    } catch (caught) {
      setFormError(caught.message)
    } finally {
      setBusy(false)
    }
  }, [errors.title, form, eventId])

  // Ctrl + S (or Cmd + S) saves a draft.
  useEffect(() => {
    if (!isOrganizer || submitted) return
    function onKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault()
        if (!busy) saveDraft()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isOrganizer, submitted, busy, saveDraft])

  function trySubmit() {
    markChecked(0, 1, 2)
    const firstBad = [0, 1, 2].find((index) => fieldsOfStep(index, errors).length > 0)
    if (firstBad !== undefined) {
      const count = Object.keys(errors).length
      setFormError(`${count} ${count === 1 ? "thing needs" : "things need"} fixing before you can submit.`)
      setStep(firstBad)
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      return
    }
    setConfirming(true)
  }

  async function confirmSubmit() {
    setBusy(true)
    try {
      const saved = await saveEvent(serialize(form), { submit: true, eventId })
      setSavedSnapshot(JSON.stringify(form))
      setSubmitted(saved)
    } catch (caught) {
      setFormError(caught.message)
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  async function handleFile(file) {
    if (!file) return
    setImageError("")
    try {
      update("imageUrl", await readImage(file))
    } catch (caught) {
      setImageError(caught.message)
    }
  }

  function setDeadlineBefore(days) {
    const start = time(form.startDate)
    if (Number.isNaN(start)) return
    update("registrationDeadline", toInput(new Date(start - days * 24 * HOUR).toISOString()))
    setTouched((current) => ({ ...current, registrationDeadline: true }))
  }

  function updateTicket(key, field, value) {
    update(
      "tickets",
      form.tickets.map((ticket) => (ticket.key === key ? { ...ticket, [field]: value } : ticket))
    )
  }

  /* ----- who can see this page ----- */

  if (!isOrganizer) {
    return (
      <main className="ce-gate-page">
        <div className="ce-gate-card">
          <OrganizerGate session={session} />
        </div>
      </main>
    )
  }

  if (loadState !== "ready") {
    const messages = {
      loading: ["Loading your event…", ""],
      missing: ["Event not found", "This event doesn't exist anymore."],
      locked: ["This event can't be edited", "Only drafts and rejected events can be edited."],
    }
    const [title, text] = messages[loadState]
    return (
      <main className="organizer">
        <OrganizerSidebar active="create" />
        <div className="organizer-panel ce-message">
          <h1>{title}</h1>
          {text && <p className="organizer-muted">{text}</p>}
          {loadState !== "loading" && (
            <a className="organizer-btn organizer-btn--primary" href={pageUrl("organizer")}>
              Back to dashboard
            </a>
          )}
        </div>
      </main>
    )
  }

  /* ----- success screen after submitting ----- */

  if (submitted) {
    return (
      <main className="organizer">
        <OrganizerSidebar active="create" />
        <div className="organizer-panel ce-success" role="status">
          <span className="ce-success__icon" aria-hidden="true">
            ✓
          </span>
          <h1>Sent for review!</h1>
          <p>
            An admin will review <strong>{submitted.title}</strong>. You&apos;ll see the decision on your dashboard,
            and the event goes live as soon as it&apos;s approved.
          </p>
          <div className="ce-success__actions">
            <a className="organizer-btn organizer-btn--primary" href={pageUrl("organizer")}>
              Go to dashboard
            </a>
            <a className="organizer-btn" href={pageUrl("create-event")}>
              Create another event
            </a>
          </div>
        </div>
      </main>
    )
  }

  /* ----- the form ----- */

  const totalSeats = form.tickets.reduce((sum, ticket) => sum + (Number(ticket.capacity) || 0), 0)
  const isEdit = eventId !== null

  return (
    <main className="organizer">
      <OrganizerSidebar active="create" />

      <div className="organizer__content" ref={topRef}>
        <header className="organizer__header">
          <div>
            <p className="organizer__eyebrow">{isEdit ? "Editing" : "New event"}</p>
            <h1>{isEdit ? "Edit your event" : "Create an event"}</h1>
          </div>
          <span className={`ce-save-state${dirty ? " is-dirty" : ""}`} role="status">
            {dirty ? "Unsaved changes" : isEdit ? "All changes saved" : "Nothing saved yet"}
          </span>
        </header>

        {original?.status === "REJECTED" && original.rejectionReason && (
          <div className="ce-banner" role="note">
            <strong>Admin feedback:</strong> {original.rejectionReason} Update the event, then submit it again.
          </div>
        )}

        <Stepper step={step} onStep={goToStep} isDone={isDone} />

        <div className="ce-layout">
          <form
            className="organizer-panel ce-form"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              if (step < 3) next()
              else trySubmit()
            }}
          >
            {formError && (
              <p className="ce-form__alert" role="alert">
                {formError}
              </p>
            )}

            {/* Step 1: basics */}
            {step === 0 && (
              <fieldset className="ce-step">
                <legend>Tell people what it&apos;s about</legend>

                <Field
                  id="ce-title"
                  label="Event title"
                  error={showError("title")}
                  hint="Short and clear, e.g. “AI Hackathon 2027”."
                  counter={`${form.title.length}/100`}
                >
                  <input
                    {...describe("ce-title", showError("title"), true)}
                    type="text"
                    maxLength={100}
                    value={form.title}
                    placeholder="What's your event called?"
                    onChange={(event) => update("title", event.target.value)}
                    onBlur={blur("title")}
                  />
                </Field>

                <div className={`ce-field${showError("category") ? " has-error" : ""}`}>
                  <span className="ce-field__label" id="ce-category-label">
                    Category
                  </span>
                  <div
                    className="ce-chips"
                    role="radiogroup"
                    aria-labelledby="ce-category-label"
                    aria-describedby={showError("category") ? "ce-category-error" : undefined}
                  >
                    {EVENT_CATEGORIES.map((category) => (
                      <label key={category} className="ce-chip">
                        <input
                          type="radio"
                          name="category"
                          value={category}
                          checked={form.category === category}
                          onChange={() => update("category", category)}
                        />
                        <span>{category}</span>
                      </label>
                    ))}
                  </div>
                  {showError("category") && (
                    <p className="ce-field__error" id="ce-category-error">
                      {errors.category}
                    </p>
                  )}
                </div>

                <Field
                  id="ce-description"
                  label="Description"
                  error={showError("description")}
                  hint="What will people do, learn or enjoy? Who is it for?"
                  counter={`${form.description.length}/2000`}
                >
                  <textarea
                    {...describe("ce-description", showError("description"), true)}
                    rows={6}
                    maxLength={2000}
                    value={form.description}
                    placeholder="Describe your event…"
                    onChange={(event) => update("description", event.target.value)}
                    onBlur={blur("description")}
                  />
                </Field>
              </fieldset>
            )}

            {/* Step 2: date & venue */}
            {step === 1 && (
              <fieldset className="ce-step">
                <legend>When and where</legend>

                <div className="ce-grid-2">
                  <Field id="ce-start" label="Starts" error={showError("startDate")}>
                    <input
                      {...describe("ce-start", showError("startDate"))}
                      type="datetime-local"
                      min={minDate}
                      value={form.startDate}
                      onChange={(event) => update("startDate", event.target.value)}
                      onBlur={blur("startDate")}
                    />
                  </Field>
                  <Field
                    id="ce-end"
                    label="Ends"
                    error={showError("endDate")}
                    hint={duration(form.startDate, form.endDate)}
                  >
                    <input
                      {...describe("ce-end", showError("endDate"), duration(form.startDate, form.endDate))}
                      type="datetime-local"
                      min={form.startDate || minDate}
                      value={form.endDate}
                      onChange={(event) => update("endDate", event.target.value)}
                      onBlur={blur("endDate")}
                    />
                  </Field>
                </div>

                <Field
                  id="ce-deadline"
                  label="Registration closes"
                  error={showError("registrationDeadline")}
                  hint="After this, people can no longer book."
                >
                  <input
                    {...describe("ce-deadline", showError("registrationDeadline"), true)}
                    type="datetime-local"
                    min={minDate}
                    max={form.startDate || undefined}
                    value={form.registrationDeadline}
                    onChange={(event) => update("registrationDeadline", event.target.value)}
                    onBlur={blur("registrationDeadline")}
                  />
                </Field>
                <div className="ce-quick" role="group" aria-label="Quick deadline">
                  <span>Quick pick:</span>
                  {[
                    [1, "1 day before"],
                    [3, "3 days before"],
                    [7, "1 week before"],
                  ].map(([days, label]) => (
                    <button key={days} type="button" disabled={!form.startDate} onClick={() => setDeadlineBefore(days)}>
                      {label}
                    </button>
                  ))}
                </div>

                <div className="ce-grid-2">
                  <Field id="ce-venue" label="Venue" error={showError("venue")}>
                    <input
                      {...describe("ce-venue", showError("venue"))}
                      type="text"
                      value={form.venue}
                      placeholder="e.g. Main Hall"
                      onChange={(event) => update("venue", event.target.value)}
                      onBlur={blur("venue")}
                    />
                  </Field>
                  <Field id="ce-address" label="Building or address" error={showError("address")}>
                    <input
                      {...describe("ce-address", showError("address"))}
                      type="text"
                      value={form.address}
                      placeholder="e.g. Administration building, floor 1"
                      onChange={(event) => update("address", event.target.value)}
                      onBlur={blur("address")}
                    />
                  </Field>
                </div>

                <div className="ce-field">
                  <span className="ce-field__label" id="ce-facilities-label">
                    Facilities <small>(optional)</small>
                  </span>
                  <div className="ce-chips" role="group" aria-labelledby="ce-facilities-label">
                    {FACILITIES.map((facility) => {
                      const on = form.facilities.includes(facility)
                      return (
                        <button
                          key={facility}
                          type="button"
                          className="ce-chip ce-chip--toggle"
                          aria-pressed={on}
                          onClick={() =>
                            update(
                              "facilities",
                              on ? form.facilities.filter((item) => item !== facility) : [...form.facilities, facility]
                            )
                          }
                        >
                          <span>
                            {on ? "✓ " : "+ "}
                            {facility}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </fieldset>
            )}

            {/* Step 3: tickets */}
            {step === 2 && (
              <fieldset className="ce-step">
                <legend>Tickets and approvals</legend>

                <div className="ce-field">
                  <span className="ce-field__label" id="ce-approval-label">
                    How are registrations confirmed?
                  </span>
                  <div className="ce-options" role="radiogroup" aria-labelledby="ce-approval-label">
                    {[
                      ["AUTOMATIC", "Automatic", "People are confirmed straight away."],
                      ["MANUAL", "Manual", "You approve or reject each registration."],
                    ].map(([value, title, text]) => (
                      <label key={value} className="ce-option">
                        <input
                          type="radio"
                          name="approvalMode"
                          value={value}
                          checked={form.approvalMode === value}
                          onChange={() => update("approvalMode", value)}
                        />
                        <span className="ce-option__box">
                          <strong>{title}</strong>
                          <small>{text}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="ce-field">
                  <div className="ce-field__label">
                    <span>Ticket types</span>
                    <span className="ce-field__counter">{totalSeats.toLocaleString("en-GB")} seats in total</span>
                  </div>

                  <div className="ce-tickets">
                    <div className="ce-tickets__head" aria-hidden="true">
                      <span>Name</span>
                      <span>Price (EGP)</span>
                      <span>Seats</span>
                      <span />
                    </div>
                    {form.tickets.map((ticket, index) => (
                      <div key={ticket.key} className="ce-ticket">
                        <div>
                          <label className="visually-hidden" htmlFor={`${ticket.key}-name`}>
                            Ticket {index + 1} name
                          </label>
                          <input
                            {...describe(`${ticket.key}-name`, showTicketError(`${ticket.key}-name`))}
                            type="text"
                            value={ticket.name}
                            placeholder="e.g. VIP"
                            onChange={(event) => updateTicket(ticket.key, "name", event.target.value)}
                            onBlur={blur(`${ticket.key}-name`)}
                          />
                          {showTicketError(`${ticket.key}-name`) && (
                            <p className="ce-field__error" id={`${ticket.key}-name-error`}>
                              {errors[`${ticket.key}-name`]}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="visually-hidden" htmlFor={`${ticket.key}-price`}>
                            Ticket {index + 1} price in EGP
                          </label>
                          <input
                            {...describe(`${ticket.key}-price`, showTicketError(`${ticket.key}-price`))}
                            type="number"
                            min="0"
                            step="5"
                            inputMode="decimal"
                            value={ticket.price}
                            onChange={(event) => updateTicket(ticket.key, "price", event.target.value)}
                            onBlur={blur(`${ticket.key}-price`)}
                          />
                          {showTicketError(`${ticket.key}-price`) && (
                            <p className="ce-field__error" id={`${ticket.key}-price-error`}>
                              {errors[`${ticket.key}-price`]}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="visually-hidden" htmlFor={`${ticket.key}-capacity`}>
                            Ticket {index + 1} seats
                          </label>
                          <input
                            {...describe(`${ticket.key}-capacity`, showTicketError(`${ticket.key}-capacity`))}
                            type="number"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            value={ticket.capacity}
                            onChange={(event) => updateTicket(ticket.key, "capacity", event.target.value)}
                            onBlur={blur(`${ticket.key}-capacity`)}
                          />
                          {showTicketError(`${ticket.key}-capacity`) && (
                            <p className="ce-field__error" id={`${ticket.key}-capacity-error`}>
                              {errors[`${ticket.key}-capacity`]}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          className="ce-ticket__remove"
                          aria-label={`Remove ticket ${ticket.name || index + 1}`}
                          disabled={form.tickets.length === 1}
                          onClick={() => update("tickets", form.tickets.filter((item) => item.key !== ticket.key))}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>

                  {(checkedSteps.includes(2) || form.tickets.length === 0) && errors.tickets && (
                    <p className="ce-field__error">{errors.tickets}</p>
                  )}

                  <div className="ce-quick">
                    <button
                      type="button"
                      disabled={form.tickets.length >= MAX_TICKET_TYPES}
                      onClick={() => update("tickets", [...form.tickets, newTicket()])}
                    >
                      + Add ticket type
                    </button>
                    <button
                      type="button"
                      onClick={() => update("tickets", form.tickets.map((ticket) => ({ ...ticket, price: "0" })))}
                    >
                      Make it free
                    </button>
                  </div>
                </div>
              </fieldset>
            )}

            {/* Step 4: cover image & review */}
            {step === 3 && (
              <fieldset className="ce-step">
                <legend>Add a cover and check everything</legend>

                <div className="ce-field">
                  <span className="ce-field__label">
                    Cover image <small>(optional)</small>
                  </span>

                  {form.imageUrl ? (
                    <div className="ce-cover">
                      <img src={form.imageUrl} alt="Selected cover" />
                      <div className="ce-cover__actions">
                        <button type="button" className="organizer-btn" onClick={() => fileRef.current?.click()}>
                          Replace
                        </button>
                        <button type="button" className="organizer-btn" onClick={() => update("imageUrl", "")}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label
                      className={`ce-drop${dragging ? " is-dragging" : ""}`}
                      onDragOver={(event) => {
                        event.preventDefault()
                        setDragging(true)
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(event) => {
                        event.preventDefault()
                        setDragging(false)
                        handleFile(event.dataTransfer.files[0])
                      }}
                    >
                      <span className="ce-drop__icon" aria-hidden="true">
                        ⇪
                      </span>
                      <strong>Drag a photo here, or click to browse</strong>
                      <small>JPG, PNG or WebP · up to 8 MB · wide images look best</small>
                      <input
                        ref={fileRef}
                        className="visually-hidden"
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          handleFile(event.target.files[0])
                          event.target.value = ""
                        }}
                      />
                    </label>
                  )}
                  {form.imageUrl && (
                    <input
                      ref={fileRef}
                      className="visually-hidden"
                      type="file"
                      accept="image/*"
                      tabIndex={-1}
                      aria-hidden="true"
                      onChange={(event) => {
                        handleFile(event.target.files[0])
                        event.target.value = ""
                      }}
                    />
                  )}
                  {imageError && (
                    <p className="ce-field__error" role="alert">
                      {imageError}
                    </p>
                  )}

                  <div className="ce-samples" role="group" aria-label="Or pick a sample cover">
                    <span>Or use a sample:</span>
                    {SAMPLE_COVERS.map((src) => (
                      <button
                        key={src}
                        type="button"
                        aria-pressed={form.imageUrl === src}
                        aria-label={`Use sample cover ${src.split("/").pop()}`}
                        onClick={() => update("imageUrl", src)}
                      >
                        <img src={src} alt="" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="ce-review">
                  {[
                    {
                      step: 0,
                      title: "Basics",
                      rows: [
                        ["Title", form.title.trim()],
                        ["Category", form.category],
                        ["Description", form.description.trim()],
                      ],
                    },
                    {
                      step: 1,
                      title: "Date & venue",
                      rows: [
                        ["Starts", form.startDate && prettyDate(form.startDate)],
                        ["Ends", form.endDate && prettyDate(form.endDate)],
                        ["Registration closes", form.registrationDeadline && prettyDate(form.registrationDeadline)],
                        ["Venue", [form.venue.trim(), form.address.trim()].filter(Boolean).join(" · ")],
                        ["Facilities", form.facilities.join(", ") || "None"],
                      ],
                    },
                    {
                      step: 2,
                      title: "Tickets",
                      rows: [
                        ["Approval", form.approvalMode === "MANUAL" ? "Manual" : "Automatic"],
                        ...form.tickets.map((ticket, index) => [
                          ticket.name.trim() || `Ticket ${index + 1}`,
                          `${Number(ticket.price) ? formatPrice(Number(ticket.price)) : "Free"} · ${ticket.capacity || 0} seats`,
                        ]),
                      ],
                    },
                  ].map((group) => (
                    <section key={group.title} className="ce-review__group">
                      <div className="ce-review__head">
                        <h3>{group.title}</h3>
                        <button type="button" onClick={() => goToStep(group.step)}>
                          Edit
                        </button>
                      </div>
                      <dl>
                        {group.rows.map(([label, value]) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd className={value ? "" : "is-missing"}>{value || "Missing"}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  ))}
                </div>
              </fieldset>
            )}

            <div className="ce-actions">
              {step > 0 && (
                <button type="button" className="organizer-btn" onClick={() => goToStep(step - 1)}>
                  ← Back
                </button>
              )}
              <span className="ce-actions__spacer" />
              <button type="button" className="organizer-btn" disabled={busy} onClick={saveDraft}>
                Save as draft
              </button>
              {step < 3 ? (
                <button type="submit" className="organizer-btn organizer-btn--primary">
                  Next: {STEPS[step + 1].title} →
                </button>
              ) : (
                <button type="submit" className="organizer-btn organizer-btn--primary" disabled={busy}>
                  Submit for review
                </button>
              )}
            </div>
            <p className="ce-shortcut">
              Tip: press <kbd>Ctrl</kbd> + <kbd>S</kbd> to save a draft at any time.
            </p>
          </form>

          <Preview form={form} errors={errors} />
        </div>
      </div>

      {confirming && (
        <ConfirmationModal
          title="Submit for review?"
          message={`"${form.title.trim()}" will be sent to an admin. You can't edit it while it's being reviewed.`}
          confirmLabel="Submit"
          busy={busy}
          onConfirm={confirmSubmit}
          onCancel={() => setConfirming(false)}
        />
      )}

      {toast && (
        <div className="organizer-toast" role="status">
          {toast}
          <button type="button" aria-label="Dismiss" onClick={() => setToast("")}>
            ×
          </button>
        </div>
      )}
    </main>
  )
}

/** Converts the form's input strings into the shape saveEvent expects. */
function serialize(form) {
  return {
    ...form,
    startDate: toIso(form.startDate),
    endDate: toIso(form.endDate),
    registrationDeadline: toIso(form.registrationDeadline),
  }
}

export default CreateEventPage
