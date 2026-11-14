import { useEffect, useRef } from "react"

/** A yes/no dialog used before important actions (submit, approve, reject). */
function ConfirmationModal({ title, message, confirmLabel = "Confirm", busy = false, onConfirm, onCancel }) {
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
      className="confirm-modal"
      aria-labelledby="confirm-modal-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onCancel()
      }}
    >
      <h2 id="confirm-modal-title">{title}</h2>
      <p>{message}</p>
      <div className="confirm-modal__actions">
        <button type="button" className="organizer-btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="organizer-btn organizer-btn--primary" onClick={onConfirm} disabled={busy}>
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </dialog>
  )
}

export default ConfirmationModal
