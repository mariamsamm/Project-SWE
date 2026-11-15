/** The small dark message box used on organizer and admin pages. */
function Toast({ message, onDismiss }) {
  if (!message) return null
  return (
    <div className="organizer-toast" role="status">
      {message}
      <button type="button" aria-label="Dismiss" onClick={onDismiss}>
        ×
      </button>
    </div>
  )
}

export default Toast
