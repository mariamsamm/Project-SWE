import { DEMO_ACCOUNT } from "../services/authService"
import LoginForm from "../Components/LoginForm"
import { goTo, pageUrl, safeNext } from "../utils/navigation"
import "./AccountPages.css"

function LoginPage() {
  const next = safeNext(new URLSearchParams(window.location.search).get("next"), "/")

  return (
    <main className="account-page">
      <h1>Log in</h1>
      <p className="account-page__intro">Log in to book tickets and see your registrations.</p>

      <LoginForm onSuccess={() => goTo(next)} />

      <p className="account-page__switch">
        New to EventHub? <a href={pageUrl("signup", next !== "/" ? { next } : {})}>Create an account</a>
      </p>

      <aside className="demo-hint" aria-label="Demo account">
        <strong>Demo account</strong>
        <span>{DEMO_ACCOUNT.email}</span>
        <span>{DEMO_ACCOUNT.password}</span>
        <small>Sample data only. There is no real backend yet.</small>
      </aside>
    </main>
  )
}

export default LoginPage
