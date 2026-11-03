package eventsystem;

import java.util.ArrayList;
import java.util.List;

class AdminService {

    private final DataStore store;
    private final NotificationService notifications;

    public AdminService(DataStore store, NotificationService notifications) {
        this.store = store;
        this.notifications = notifications;
    }

    // ---------- Viewing events ----------

    public List<Event> viewAllEvents() {
        return new ArrayList<>(store.getEvents());
    }

    /** Item 3: event requests that organizers sent and are waiting for the admin. */
    public List<Event> getPendingEvents() {
        return filterByStatus(EventStatus.PENDING);
    }

    /** Item 5: what the homepage shows (Member 5 reads this). */
    public List<Event> getPublishedEvents() {
        return filterByStatus(EventStatus.PUBLISHED);
    }

    private List<Event> filterByStatus(EventStatus status) {
        List<Event> result = new ArrayList<>();
        for (Event e : store.getEvents()) {
            if (e.getStatus() == status) result.add(e);
        }
        return result;
    }

    /** Opens one event so the admin can read it. Returns null if not found. */
    public Event reviewEvent(int eventId) {
        return store.findEventById(eventId);
    }

    // ---------- Item 4: decisions ----------

    /** Approve = approve + publish on the homepage. */
    public void approveEvent(Admin admin, int eventId, String feedback) {
        Event event = requirePending(eventId);
        saveReview(admin, event, Decision.APPROVED, feedback);
        publishEvent(event);
        event.setAdminFeedback(feedback == null ? "" : feedback);
        notifications.send(event.getOrganizerId(),
                "Your event \"" + event.getTitle() + "\" was APPROVED and is now published on the homepage."
                        + noteText(feedback));
    }

    public void rejectEvent(Admin admin, int eventId, String reason) {
        requireText(reason, "A rejection reason is required.");
        Event event = requirePending(eventId);
        saveReview(admin, event, Decision.REJECTED, reason);
        event.setStatus(EventStatus.REJECTED);
        event.setAdminFeedback(reason);
        notifications.send(event.getOrganizerId(),
                "Your event \"" + event.getTitle() + "\" was REJECTED. Reason: " + reason);
    }

    /** Send it back: the organizer must change the things listed in the feedback. */
    public void requestRevision(Admin admin, int eventId, String feedback) {
        requireText(feedback, "Please write what the organizer must change.");
        Event event = requirePending(eventId);
        saveReview(admin, event, Decision.REVISION_REQUESTED, feedback);
        event.setStatus(EventStatus.REVISION_REQUIRED);
        event.setAdminFeedback(feedback);
        notifications.send(event.getOrganizerId(),
                "Your event \"" + event.getTitle() + "\" needs changes. Admin says: " + feedback);
    }

    // ---------- Item 5: publishing ----------

    public void publishEvent(Event event) {
        event.publish();
    }

    /** Takes an event off the homepage and returns it to the organizer as DRAFT. */
    public void unpublishEvent(int eventId, String reason) {
        Event event = store.findEventById(eventId);
        if (event == null) throw new IllegalArgumentException("Event not found.");
        if (event.getStatus() != EventStatus.PUBLISHED) {
            throw new IllegalStateException("Only PUBLISHED events can be unpublished.");
        }
        event.setStatus(EventStatus.DRAFT);
        event.setAdminFeedback(reason == null ? "" : reason);
        notifications.send(event.getOrganizerId(),
                "Your event \"" + event.getTitle() + "\" was removed from the homepage."
                        + noteText(reason));
    }

    // ---------- Users ----------

    public List<User> manageUsers() {
        return new ArrayList<>(store.getUsers());
    }

    public void setUserActive(Admin admin, int userId, boolean active) {
        User target = store.findUserById(userId);
        if (target == null) throw new IllegalArgumentException("User not found.");
        if (target.getRole() == Role.ADMIN) {
            throw new IllegalStateException("Admin accounts cannot be deactivated.");
        }
        target.setActive(active);
    }

    /**
     * Add organizer: the admin writes the organizer's USERNAME and it is saved.
     * When that person signs up or logs in with this username, the organizer page opens for them.
     * If they already have a Participant account, it is upgraded to Organizer.
     */
    public void addOrganizer(Admin admin, String username) {
        String cleanUsername = InputValidator.requireValidUsername(username);

        User existing = store.findUserByUsername(cleanUsername);
        if (existing != null && existing.getRole() == Role.ADMIN) {
            throw new IllegalArgumentException("This username belongs to an admin account.");
        }
        if (!store.addApprovedOrganizer(cleanUsername)) {
            throw new IllegalArgumentException("This username is already an approved organizer.");
        }

        // Already registered as a participant -> upgrade the account (same id, username, gender, password)
        if (existing != null && existing.getRole() == Role.PARTICIPANT) {
            EventOrganizer upgraded = new EventOrganizer(existing.getUserId(), existing.getUsername(),
                    existing.getGender(), existing.getPasswordHash());
            upgraded.setActive(existing.isActive());
            store.replaceUser(existing, upgraded);
            notifications.send(upgraded.getUserId(),
                    "The admin made you an event organizer. Log out and log in again to open the organizer page.");
        }
    }

    public List<String> getApprovedOrganizerUsernames() {
        return store.getApprovedOrganizerUsernames();
    }

    // ---------- Reports ----------

    public String viewReports() {
        int draft = 0, pending = 0, revision = 0, rejected = 0, published = 0, other = 0;
        for (Event e : store.getEvents()) {
            switch (e.getStatus()) {
                case DRAFT: draft++; break;
                case PENDING: pending++; break;
                case REVISION_REQUIRED: revision++; break;
                case REJECTED: rejected++; break;
                case PUBLISHED: published++; break;
                default: other++; break;
            }
        }
        int admins = 0, organizers = 0, participants = 0;
        for (User u : store.getUsers()) {
            if (u.getRole() == Role.ADMIN) admins++;
            else if (u.getRole() == Role.ORGANIZER) organizers++;
            else participants++;
        }
        return "===== REPORT =====\n"
                + "Events total: " + store.getEvents().size() + "\n"
                + "  Draft: " + draft + " | Pending: " + pending + " | Revision required: " + revision + "\n"
                + "  Rejected: " + rejected + " | Published: " + published + " | Other: " + other + "\n"
                + "Users total: " + store.getUsers().size() + "\n"
                + "  Admins: " + admins + " | Organizers: " + organizers + " | Participants: " + participants + "\n"
                + "Reviews made: " + store.getReviews().size();
    }

    // ---------- Helpers ----------

    private Event requirePending(int eventId) {
        Event event = store.findEventById(eventId);
        if (event == null) throw new IllegalArgumentException("Event not found.");
        if (event.getStatus() != EventStatus.PENDING) {
            throw new IllegalStateException("This event is not waiting for review (status: "
                    + event.getStatus() + ").");
        }
        return event;
    }

    private void saveReview(Admin admin, Event event, Decision decision, String feedback) {
        store.getReviews().add(new EventReview(store.nextReviewId(), event.getEventId(),
                admin.getUserId(), decision, feedback == null ? "" : feedback));
    }

    private void requireText(String text, String message) {
        if (text == null || text.trim().isEmpty()) throw new IllegalArgumentException(message);
    }

    private String noteText(String note) {
        return (note == null || note.trim().isEmpty()) ? "" : " Note: " + note;
    }
}
