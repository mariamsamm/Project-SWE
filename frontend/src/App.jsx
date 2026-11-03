import Navbar from "./Components/Navbar"
import HomePage from "./pages/HomePage"
import EventDetailsPage from "./pages/EventDetailsPage"

function App() {
  const eventId = new URLSearchParams(window.location.search).get("event")

  return (
    <>
      <Navbar />
      {eventId === null ? (
        <HomePage />
      ) : (
        <EventDetailsPage eventId={eventId} />
      )}
    </>
  )
}

export default App