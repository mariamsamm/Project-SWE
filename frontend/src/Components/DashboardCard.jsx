import { useEffect, useState } from "react"

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

/** Counts from 0 up to `target` once, so the numbers feel alive when the page opens. */
function useCountUp(target, duration = 700) {
  const [value, setValue] = useState(0)
  const reduced = prefersReducedMotion()

  useEffect(() => {
    if (reduced) return
    let frame
    const start = performance.now()
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration)
      setValue(Math.round(target * (1 - (1 - progress) ** 3)))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration, reduced])

  return reduced ? target : value
}

/**
 * One statistic box at the top of a dashboard (used by organizer and admin).
 * Pass `onClick` to make the whole card a button, and `active` to highlight it.
 */
function DashboardCard({ label, value, note, onClick, active = false }) {
  const shown = useCountUp(value)
  const content = (
    <>
      <span className="dashboard-card__label">{label}</span>
      <span className="dashboard-card__value">{shown.toLocaleString("en-GB")}</span>
      {note && <span className="dashboard-card__note">{note}</span>}
    </>
  )

  if (!onClick) return <article className="dashboard-card">{content}</article>

  return (
    <button
      type="button"
      className="dashboard-card dashboard-card--button"
      aria-pressed={active}
      onClick={onClick}
    >
      {content}
    </button>
  )
}

export default DashboardCard
