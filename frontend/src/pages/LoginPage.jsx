import { DEMO_ACCOUNT, DEMO_ORGANIZER } from "../services/authService"
import LoginForm from "../Components/LoginForm"
import { goTo, pageUrl, safeNext } from "../utils/navigation"
import "./AccountPages.css"

function LoginPage() {
  const next = safeNext(new URLSearchParams(window.location.search).get("next"), "/")

  return (
    <main className="account-page">
      <h1>Log in</h1>
      <p className="account-page__intro">Log in to book tickets and see your registrations.</p>

      <LoginForm
        onSuccess={(session) => {
          // Organizers go straight to their dashboard; everyone else goes back to where they were.
          goTo(session.role === "ORGANIZER" ? pageUrl("organizer") : next)
        }}
      />

      <p className="account-page__switch">
        New to EventHub? <a href={pageUrl("signup", next !== "/" ? { next } : {})}>Create an account</a>
      </p>

      <aside className="demo-hint" aria-label="Demo accounts">
        <strong>Demo participant</strong>
        <span>{DEMO_ACCOUNT.email}</span>
        <span>{DEMO_ACCOUNT.password}</span>
        <strong>Demo organizer</strong>
        <span>{DEMO_ORGANIZER.email}</span>
        <span>{DEMO_ORGANIZER.password}</span>
        <small>Sample data only. There is no real backend yet.</small>
      </aside>
    </main>
  )
}

export default LoginPage
