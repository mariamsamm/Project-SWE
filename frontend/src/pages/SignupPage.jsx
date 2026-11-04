import { useState } from "react"
import { signup, validateSignup } from "../services/authService"
import { goTo, pageUrl, safeNext } from "../utils/navigation"
import "./AccountPages.css"

const initial = { name: "", email: "", dateOfBirth: "", password: "", confirmPassword: "" }

function SignupPage() {
  const next = safeNext(new URLSearchParams(window.location.search).get("next"), "/")
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState("")
  const [busy, setBusy] = useState(false)
  const [today] = useState(() => new Date().toISOString().slice(0, 10))

  function update(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
    setFormError("")
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const found = validateSignup(values)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      setFormError("Please fix the highlighted fields.")
      document.querySelector("[aria-invalid='true']")?.focus()
      return
    }
    setBusy(true)
    try {
      await signup(values)
      goTo(next)
    } catch (caught) {
      setErrors(caught.fieldErrors ?? {})
      setFormError(caught.message)
      setBusy(false)
    }
  }

  function field(name, label, type, autoComplete, extra = {}) {
    const errorId = `signup-${name}-error`
    return (
      <>
        <label htmlFor={`signup-${name}`}>{label}</label>
        <input
          id={`signup-${name}`}
          name={name}
          type={type}
          autoComplete={autoComplete}
          value={values[name]}
          onChange={update}
          aria-invalid={errors[name] ? "true" : undefined}
          aria-describedby={errors[name] ? errorId : undefined}
          {...extra}
        />
        {errors[name] && (
          <p className="field-error" id={errorId}>
            {errors[name]}
          </p>
        )}
      </>
    )
  }

  return (
    <main className="account-page">
      <h1>Create your account</h1>
      <p className="account-page__intro">Your date of birth is used to check age limits on events.</p>

      <form className="account-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <p className="form-alert" role="alert">
            {formError}
          </p>
        )}
        {field("name", "Full name", "text", "name")}
        {field("email", "Email", "email", "email")}
        {field("dateOfBirth", "Date of birth", "date", "bday", { max: today })}
        {field("password", "Password", "password", "new-password")}
        <p className="field-hint">At least 8 characters with a letter and a number.</p>
        {field("confirmPassword", "Confirm password", "password", "new-password")}

        <div className="account-form__actions">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Creating account…" : "Sign up"}
          </button>
        </div>
      </form>

      <p className="account-page__switch">
        Already have an account? <a href={pageUrl("login", next !== "/" ? { next } : {})}>Log in</a>
      </p>
    </main>
  )
}

export default SignupPage
