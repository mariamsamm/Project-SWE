// AUTH through the Spring Boot backend (POST /api/auth/login, /api/auth/signup).
// The backend checks the password with BCrypt. The logged-in user (id + role) is kept
// in sessionStorage, and the other services put that id in their URLs.
import { api } from "./api"
import { toUser } from "./mappers"

const SESSION_KEY = "eventhub.session"

// Demo accounts from backend/database/eventhub_database.sql (shown on the login page).
export const DEMO_ACCOUNT = { email: "mariam@eventhub.demo", password: "Demo1234!" }
export const DEMO_ORGANIZER = { email: "samir@eventhub.demo", password: "Organizer123!" }
export const DEMO_ADMIN = { email: "layla@eventhub.demo", password: "Admin123!" }

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
  try {
    const user = await api("/api/auth/signup", {
      method: "POST",
      body: {
        fullName: values.name.trim(),
        email: normalizeEmail(values.email),
        phone: values.phone?.trim() || null,
        dateOfBirth: values.dateOfBirth,
        password: values.password,
        confirmPassword: values.confirmPassword,
      },
    })
    return setSession(toUser(user))
  } catch (error) {
    if (error.status === 409) error.fieldErrors = { email: error.message }
    throw error
  }
}

export async function login(emailInput, password) {
  const user = await api("/api/auth/login", {
    method: "POST",
    body: { email: normalizeEmail(emailInput), password },
  })
  return setSession(toUser(user))
}

export function logout() {
  setSession(null)
}

/** The logged-in user, or an error if nobody is logged in. */
export function requireSession(role) {
  const session = getSession()
  if (!session) throw new Error("Please log in first.")
  if (role && session.role !== role) throw new Error("Your account can't do this.")
  return session
}

/* ---------- user management (admin) ---------- */

/** Every account (GET /api/admin/{adminId}/users). */
export async function listUsers() {
  const admin = requireSession("ADMIN")
  const users = await api(`/api/admin/${admin.id}/users`)
  return users.map(toUser)
}

/** Activates / deactivates a user (PUT /api/admin/{adminId}/users/{userId}/active). */
export async function updateUser(userId, { suspended }) {
  const admin = requireSession("ADMIN")
  if (suspended === undefined) return
  await api(`/api/admin/${admin.id}/users/${userId}/active`, {
    method: "PUT",
    body: { active: !suspended },
  })
}
