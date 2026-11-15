package eventsystem;

import java.time.LocalDateTime;

/** An in-app message for a user (replaces email). */
class Notification {

    private final int notificationId;
    private final int recipientId;
    private final String message;
    private final LocalDateTime createdAt;
    private boolean read = false;

    public Notification(int notificationId, int recipientId, String message) {
        this.notificationId = notificationId;
        this.recipientId = recipientId;
        this.message = message;
        this.createdAt = LocalDateTime.now();
    }

    public void markRead() { read = true; }

    public int getNotificationId() { return notificationId; }
    public int getRecipientId() { return recipientId; }
    public String getMessage() { return message; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public boolean isRead() { return read; }
}

/** One admin decision about one event (approve, reject, or request changes). */
class EventReview {

    private final int reviewId;
    private final int eventId;
    private final int adminId;
    private final Decision decision;
    private final String feedback;
    private final LocalDateTime reviewedAt;

    public EventReview(int reviewId, int eventId, int adminId, Decision decision, String feedback) {
        this.reviewId = reviewId;
        this.eventId = eventId;
        this.adminId = adminId;
        this.decision = decision;
        this.feedback = feedback;
        this.reviewedAt = LocalDateTime.now();
    }

    public int getReviewId() { return reviewId; }
    public int getEventId() { return eventId; }
    public int getAdminId() { return adminId; }
    public Decision getDecision() { return decision; }
    public String getFeedback() { return feedback; }
    public LocalDateTime getReviewedAt() { return reviewedAt; }
}
