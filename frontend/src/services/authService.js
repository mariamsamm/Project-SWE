// DEMO AUTH. There is no backend yet, so accounts live in this browser only.
// Passwords are never stored: only a salted SHA-256 digest is kept. When the
// Spring Boot API exists, replace the bodies of signup/login/logout with fetch
// calls and keep the same function signatures so no page has to change.

const USERS_KEY = "eventhub.users"
const SESSION_KEY = "eventhub.session"

// Public throwaway account so the app can be demoed immediately.
export const DEMO_ACCOUNT = { email: "sara@eventhub.demo", password: "Demo1234!" }
export const DEMO_ORGANIZER = { email: "organizer@eventhub.demo", password: "Organizer123!" }

function readJson(storage, key, fallback) {
  try {
    const raw = storage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJson(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value))
  } catch {
    throw new Error("Your browser blocked storage, so the demo cannot save data.")
  }
}

async function digest(salt, password) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Secure hashing needs https or localhost.")
  }
  const bytes = new TextEncoder().encode(`${salt}:${password}`)
  const hash = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("")
}

function randomId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("")
}

// Demo accounts that always exist. They match the users table in
// backend/database/eventhub_database.sql. The role decides which page opens after login.
const DEMO_USERS = [
  { id: "u-demo", name: "Sara Participant", ...DEMO_ACCOUNT, dateOfBirth: "2000-05-14", role: "PARTICIPANT" },
  { id: "u-organizer", name: "Omar Organizer", ...DEMO_ORGANIZER, dateOfBirth: "1995-07-21", role: "ORGANIZER" },
]

async function seedDemoUser() {
  const users = readJson(localStorage, USERS_KEY, [])
  let changed = false
  for (const demo of DEMO_USERS) {
    if (users.some((user) => user.email === demo.email)) continue
    const salt = randomId()
    const { password, ...profile } = demo
    users.push({ ...profile, salt, hash: await digest(salt, password) })
    changed = true
  }
  if (changed) writeJson(localStorage, USERS_KEY, users)
  return users
}

/* ---------- validation (also used by the forms) ---------- */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase()
}

export function validateSignup({ name, email, dateOfBirth, password, confirmPassword }) {
  const errors = {}
  if (!String(name ?? "").trim()) errors.name = "Enter your full name."
  if (!EMAIL_PATTERN.test(normalizeEmail(email))) errors.email = "Enter a valid email address."

  if (!dateOfBirth) {
    errors.dateOfBirth = "Enter your date of birth."
  } else {
    const born = new Date(`${dateOfBirth}T00:00:00`)
    if (Number.isNaN(born.getTime()) || born > new Date() || born.getFullYear() < 1900) {
      errors.dateOfBirth = "Enter a real date of birth in the past."
    }
  }

  if (!password || password.length < 8) {
    errors.password = "Use at least 8 characters."
  } else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errors.password = "Include at least one letter and one number."
  }
  if (confirmPassword !== password) errors.confirmPassword = "Passwords do not match."
  return errors
}

/* ---------- session (sessionStorage: cleared when the tab closes) ---------- */

let cachedRaw = null
let cachedSession = null
const listeners = new Set()

export function getSession() {
  let raw = null
  try {
    raw = sessionStorage.getItem(SESSION_KEY)
  } catch {
    raw = null
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    try {
      cachedSession = raw ? JSON.parse(raw) : null
    } catch {
      cachedSession = null
    }
  }
  return cachedSession
}

export function subscribeSession(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setSession(user) {
  const session = user
    ? {
        id: user.id,
        name: user.name,
        email: user.email,
        dateOfBirth: user.dateOfBirth,
        role: user.role ?? "PARTICIPANT",
      }
    : null
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* storage blocked: the session just will not persist */
  }
  listeners.forEach((listener) => listener())
  return session
}

/* ---------- actions ---------- */

export async function signup(values) {
  const errors = validateSignup(values)
  if (Object.keys(errors).length > 0) {
    const error = new Error("Please fix the highlighted fields.")
    error.fieldErrors = errors
    throw error
  }
  const users = await seedDemoUser()
  const email = normalizeEmail(values.email)
  if (users.some((user) => user.email === email)) {
    const error = new Error("An account with this email already exists.")
    error.fieldErrors = { email: "An account with this email already exists." }
    throw error
  }
  const salt = randomId()
  const user = {
    id: `u-${randomId()}`,
    name: values.name.trim(),
    email,
    dateOfBirth: values.dateOfBirth,
    role: "PARTICIPANT",
    salt,
    hash: await digest(salt, values.password),
  }
  writeJson(localStorage, USERS_KEY, [...users, user])
  return setSession(user)
}

export async function login(emailInput, password) {
  const users = await seedDemoUser()
  const email = normalizeEmail(emailInput)
  const user = users.find((item) => item.email === email)
  // Same message for "no such user" and "wrong password" on purpose.
  const failure = new Error("Incorrect email or password.")
  if (!user) throw failure
  if ((await digest(user.salt, password)) !== user.hash) throw failure
  return setSession(user)
}

export function logout() {
  setSession(null)
}
