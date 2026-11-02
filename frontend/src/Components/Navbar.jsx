import "./Navbar.css"

function Navbar() {
  return (
    <header className="site-header">
      <nav className="site-nav" aria-label="Main navigation">
        <a className="site-brand" href="/">
          Event<span>Hub</span>
        </a>

        <a className="site-nav__link" href="#upcoming-events">
          Explore events
        </a>
      </nav>
    </header>
  )
}

export default Navbar