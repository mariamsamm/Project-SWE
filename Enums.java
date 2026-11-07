package eventsystem;

enum Role {
    ADMIN,
    ORGANIZER,
    PARTICIPANT
}

enum EventStatus {
    DRAFT,
    PENDING,
    REVISION_REQUIRED,
    REJECTED,
    PUBLISHED,
    CANCELLED,
    COMPLETED
}

enum Decision {
    APPROVED,
    REJECTED,
    REVISION_REQUESTED
}
