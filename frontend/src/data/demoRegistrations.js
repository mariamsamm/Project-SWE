// DEMO DATA. Builds sample participants for an event so the organizer pages
// have something to show before the Spring Boot API is connected.

// RegistrationForm: the extra questions a participant answers when registering.
// FormField types: "text", "number", "select" (dropdown) and "checkbox".
export const DEFAULT_FORM_FIELDS = [
  { id: "phone", label: "Phone number", type: "text", required: true, options: [] },
  { id: "studentId", label: "University ID", type: "text", required: false, options: [] },
  {
    id: "diet",
    label: "Dietary needs",
    type: "select",
    required: false,
    options: ["None", "Vegetarian", "Vegan", "Gluten-free"],
  },
]

export const FIELD_TYPES = [
  { type: "text", label: "Short text" },
  { type: "number", label: "Number" },
  { type: "select", label: "Dropdown" },
  { type: "checkbox", label: "Checkbox" },
]

const FIRST_NAMES = [
  "Ahmed", "Mariam", "Omar", "Layla", "Youssef", "Nour", "Khaled", "Salma", "Hassan", "Farida",
  "Mostafa", "Habiba", "Karim", "Jana", "Ali", "Malak", "Tarek", "Hana", "Ziad", "Rana",
  "Mahmoud", "Yasmin", "Seif", "Dina", "Adham", "Nada", "Hazem", "Sara", "Amr", "Lina",
]

const LAST_NAMES = [
  "Hassan", "Ibrahim", "Mostafa", "Elsayed", "Farouk", "Nabil", "Adel", "Fathy", "Samy", "Kamal",
  "Zaki", "Mansour", "Gamal", "Sherif", "Ashraf", "Helmy", "Tawfik", "Ramadan", "Saleh", "Younis",
]

const DAY = 24 * 60 * 60 * 1000

/** Small seeded random generator, so each event always gets the same people. */
function seededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick(random, list) {
  return list[Math.floor(random() * list.length)]
}

function ticketCode(random) {
  const part = () =>
    Math.floor(random() * 0x10000)
      .toString(16)
      .toUpperCase()
      .padStart(4, "0")
  return `EH-${part()}-${part()}`
}

/**
 * Sample registrations whose seats add up to `event.registrations`.
 * Events with MANUAL approval also get a few PENDING and REJECTED people.
 */
export function buildDemoRegistrations(event) {
  const target = Number(event.registrations) || 0
  if (target === 0) return []

  const random = seededRandom(Number(event.id) * 7919 + 17)
  const manual = event.approvalMode === "MANUAL"
  const pendingSeats = manual ? Math.min(9, Math.max(2, Math.floor(target * 0.1))) : 0
  const tickets = event.ticketCategories?.length ? event.ticketCategories : [{ name: "General Admission", price: 0 }]
  const rows = []
  let seats = 0

  const person = (index, status) => {
    const first = pick(random, FIRST_NAMES)
    const last = pick(random, LAST_NAMES)
    const ticket = random() < 0.75 ? tickets[0] : pick(random, tickets)
    const quantity = status !== "REJECTED" && random() < 0.2 && target - seats >= 2 ? 2 : 1
    return {
      id: `d-${event.id}-${index}`,
      eventId: String(event.id),
      name: `${first} ${last}`,
      email: `${first}.${last}${index}@student.eventhub.demo`.toLowerCase(),
      ticketName: ticket.name,
      quantity,
      total: (Number(ticket.price) || 0) * quantity,
      status,
      ticketCode: status === "APPROVED" ? ticketCode(random) : null,
      checkedInAt: null,
      answers: {
        phone: `01${Math.floor(random() * 3)}${String(Math.floor(random() * 1e8)).padStart(8, "0")}`,
        studentId: random() < 0.7 ? `2023${String(Math.floor(random() * 1e4)).padStart(4, "0")}` : "",
        diet: random() < 0.7 ? "None" : pick(random, ["Vegetarian", "Vegan", "Gluten-free"]),
      },
    }
  }

  while (seats < target) {
    const row = person(rows.length, seats >= target - pendingSeats ? "PENDING" : "APPROVED")
    seats += row.quantity
    rows.push(row)
  }

  if (manual) {
    for (let extra = 0; extra < 3; extra += 1) {
      rows.push({ ...person(rows.length, "REJECTED"), rejectionReason: "Registration did not meet the event requirements." })
    }
  }

  // Spread sign-up times over the last 30 days, oldest first.
  const now = Date.now()
  const step = (30 * DAY) / rows.length
  return rows.map((row, index) => ({
    ...row,
    createdAt: new Date(now - (rows.length - index) * step - 2 * 60 * 60 * 1000).toISOString(),
  }))
}
