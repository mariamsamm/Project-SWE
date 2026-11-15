import { useEffect, useState } from "react"

/** A short message at the bottom of the page that hides itself after a few seconds. */
export function useToast(duration = 4000) {
  const [toast, setToast] = useState("")

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(""), duration)
    return () => clearTimeout(timer)
  }, [toast, duration])

  return [toast, setToast]
}
