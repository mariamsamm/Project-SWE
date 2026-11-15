import { useEffect, useId, useRef, useState } from "react"

/**
 * A dialog that asks for a written reason before an action (reject, cancel).
 * `suggestions` are one-click sentences; `minLength` 0 makes the reason optional.
 */
function ReasonModal({
  title,
  message,
  label = "Reason",
  confirmLabel = "Confirm",
  suggestions = [],
  minLength = 0,
  busy = false,
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null)
  const [reason, setReason] = useState("")
  const [touched, setTouched] = useState(false)
  const id = useId()
  const tooShort = reason.trim().length < minLength

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
      aria-labelledby={`${id}-title`}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onCancel()
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          setTouched(true)
          if (!tooShort) onConfirm(reason.trim())
        }}
      >
        <h2 id={`${id}-title`}>{title}</h2>
        <p>{message}</p>

        <label className="staff-field" htmlFor={`${id}-reason`}>
          <span>
            {label} {minLength === 0 && <small>(optional)</small>}
          </span>
          <textarea
            id={`${id}-reason`}
            rows={3}
            value={reason}
            aria-invalid={touched && tooShort}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        {touched && tooShort && (
          <p className="staff-error" role="alert">
            Write at least {minLength} characters so the other person understands.
          </p>
        )}

        {suggestions.length > 0 && (
          <div className="staff-chips" role="group" aria-label="Quick reasons">
            {suggestions.map((text) => (
              <button key={text} type="button" onClick={() => setReason(text)}>
                {text}
              </button>
            ))}
          </div>
        )}

        <div className="confirm-modal__actions">
          <button type="button" className="organizer-btn" onClick={onCancel} disabled={busy}>
            Back
          </button>
          <button type="submit" className="organizer-btn staff-btn--danger" disabled={busy}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  )
}

export default ReasonModal
