import Navbar from "./Components/Navbar"
import HomePage from "./pages/HomePage"
import EventDetailsPage from "./pages/EventDetailsPage"
import LoginPage from "./pages/LoginPage"
import SignupPage from "./pages/SignupPage"
import MyRegistrationsPage from "./pages/MyRegistrationsPage"
import MyTicketPage from "./pages/MyTicketPage"
import OrganizerDashboard from "./pages/OrganizerDashboard"
import { useEffect, useRef } from "react"

function AccountDialog({ children, onClose, title }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog.open) dialog.showModal()

    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="account-dialog"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <button type="button" onClick={onClose}>
        Close
      </button>
      {children}
    </dialog>
  )
}

function App() {
  const params = new URLSearchParams(window.location.search)
  const eventId = params.get("event")
  const page = params.get("page")

  let content
  if (page === "login" || page === "signup") {
  const isSignup = page === "signup"

  content = (
    <>
      <HomePage />
      <AccountDialog
        title={isSignup ? "Create your account" : "Log in"}
        onClose={() => window.location.assign("/")}
      >
        {isSignup ? <SignupPage /> : <LoginPage />}
      </AccountDialog>
    </>
  )
}

  else if (page === "organizer") content = <OrganizerDashboard />
  else if (page === "registrations") content = <MyRegistrationsPage />
  else if (page === "ticket") content = <MyTicketPage registrationId={params.get("id") ?? ""} />
  else if (eventId !== null) content = <EventDetailsPage eventId={eventId} />
  else content = <HomePage />

  return (
    <>
      <Navbar />
      {(page || eventId !== null) && (
  <div className="page-back">
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          window.history.back()
        } else {
          window.location.assign("/")
        }
      }}
    >
      ← Back
    </button>
  </div>
)}

      {content}
    </>
  )
}

export default App
