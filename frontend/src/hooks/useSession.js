import { useSyncExternalStore } from "react"
import { getSession, subscribeSession } from "../services/authService"

export function useSession() {
  return useSyncExternalStore(subscribeSession, getSession, () => null)
}
