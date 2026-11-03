export const formatPrice = new Intl.NumberFormat("en-EG", {
  style: "currency",
  currency: "EGP",
}).format

export function formatEventDate(iso) {
  return new Date(iso).toLocaleString("en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Africa/Cairo",
  })
}

export function formatShortDate(iso) {
  return new Date(iso).toLocaleDateString("en-GB", { dateStyle: "medium", timeZone: "Africa/Cairo" })
}

export const STATUS_LABELS = {
  CONFIRMED: "Confirmed",
  PENDING: "Awaiting approval",
  REJECTED: "Rejected",
}
