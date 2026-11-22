// Turns backend answers into the shapes the pages already use,
// so the pages did not have to change.
import { imageUrl } from "./api"

/** EventResponse -> event used by every page. */
export function toEvent(e) {
  if (!e) return null
  const tickets = e.tickets ?? []
  const capacity = e.capacity ?? tickets.reduce((sum, t) => sum + t.capacity, 0)
  return {
    id: e.id,
    organizerId: e.organizerId,
    title: e.name,
    categoryId: e.categoryId,
    category: e.categoryName ?? "",
    description: e.about ?? "",
    imageUrl: imageUrl(e.imagePath),
    imagePath: e.imagePath,
    startDate: e.startDateTime,
    endDate: e.endDateTime,
    registrationDeadline: e.registrationDeadline,
    location: e.venue?.name ?? "",
    address: e.venue?.location ?? "",
    capacity,
    seatsLeft: e.seatsLeft,
    // Seats taken by pending + confirmed bookings.
    registrations: Math.max(0, capacity - (e.seatsLeft ?? capacity)),
    approvalMode: e.approvalMode,
    status: e.status,
    rejectionReason: e.adminFeedback ?? undefined,
    cancelReason: e.adminFeedback ?? undefined,
    submittedAt: e.submittedAt,
    publishedAt: e.publishedAt,
    updatedAt: e.publishedAt ?? e.submittedAt ?? e.startDateTime,
    registrationOpen: e.registrationOpen,
    facilities: e.facilities ?? [],
    // Organizer pages use capacity, the booking box uses available.
    ticketCategories: tickets.map((t) => ({
      id: t.id,
      name: t.name,
      price: Number(t.price),
      capacity: t.capacity,
      available: t.seatsLeft,
    })),
  }
}

/** RegistrationResponse -> participant booking (My registrations / My ticket). */
export function toBooking(r) {
  const items = (r.items ?? []).map((item) => ({
    categoryId: item.ticketCategoryId,
    name: item.ticketName,
    price: Number(item.unitPrice),
    quantity: item.quantity,
  }))
  return {
    id: r.id,
    eventId: r.eventId,
    eventName: r.eventName,
    userId: r.userId,
    items,
    quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    total: Number(r.totalAmount ?? 0),
    status: r.status,
    ticketCode: r.ticketCode,
    checkedInAt: r.checkedInAt,
    createdAt: r.createdAt,
  }
}

/** RegistrationResponse -> row of the organizer's registrations table. */
export function toRow(r) {
  const booking = toBooking(r)
  return {
    id: r.id,
    eventId: String(r.eventId),
    live: true,
    name: r.participantName ?? "Participant",
    email: r.participantEmail ?? "",
    ticketName: booking.items.map((item) => item.name).join(", ") || "Ticket",
    quantity: booking.quantity,
    total: booking.total,
    // The organizer pages say APPROVED where the backend says CONFIRMED.
    status: r.status === "CONFIRMED" ? "APPROVED" : r.status,
    ticketCode: r.ticketCode ?? null,
    checkedInAt: r.checkedInAt ?? null,
    answers: {},
    createdAt: r.createdAt,
    decidedAt: r.decidedAt,
  }
}

/** UserResponse -> user / session. */
export function toUser(u) {
  return {
    id: u.id,
    name: u.fullName,
    email: u.email,
    phone: u.phone,
    dateOfBirth: u.dateOfBirth,
    role: u.role ?? "PARTICIPANT",
    suspended: u.active === false,
    organizationName: u.organizationName,
  }
}
