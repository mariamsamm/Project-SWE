import { useState } from "react"
import { login } from "../services/authService"

// Used by the Login page and by the "sign in to book" dialog on Event Details.
function LoginForm({ onSuccess, idPrefix = "login", onCancel }) {
  const [values, setValues] = useState({ email: "", password: "" })
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  function update(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
    setError("")
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      const session = await login(values.email, values.password)
      onSuccess(session)
    } catch (caught) {
      setError(caught.message)
      setBusy(false)
    }
  }

  return (
    <form className="account-form" onSubmit={handleSubmit} noValidate>
      {error && (
        <p className="form-alert" role="alert">
          {error}
        </p>
      )}

      <label htmlFor={`${idPrefix}-email`}>Email</label>
      <input
        id={`${idPrefix}-email`}
        name="email"
        type="email"
        autoComplete="email"
        value={values.email}
        onChange={update}
        required
      />

      <label htmlFor={`${idPrefix}-password`}>Password</label>
      <input
        id={`${idPrefix}-password`}
        name="password"
        type="password"
        autoComplete="current-password"
        value={values.password}
        onChange={update}
        required
      />

      <div className="account-form__actions">
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={busy || !values.email || !values.password}>
          {busy ? "Signing in…" : "Log in"}
        </button>
      </div>
    </form>
  )
}

export default LoginForm
