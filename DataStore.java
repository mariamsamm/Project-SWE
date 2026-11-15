package eventsystem;

import java.util.ArrayList;
import java.util.List;

/** In-memory "database" so no real DB is needed. */
class DataStore {

    private final List<User> users = new ArrayList<>();
    private final List<Event> events = new ArrayList<>();
    private final List<EventReview> reviews = new ArrayList<>();
    private final List<Notification> notifications = new ArrayList<>();

    /** Emails the admin approved as organizers. */
    private final List<String> approvedOrganizerEmails = new ArrayList<>();

    private int userSeq = 1;
    private int eventSeq = 1;
    private int reviewSeq = 1;
    private int notificationSeq = 1;

    public List<User> getUsers() { return users; }
    public List<Event> getEvents() { return events; }
    public List<EventReview> getReviews() { return reviews; }
    public List<Notification> getNotifications() { return notifications; }

    public int nextUserId() { return userSeq++; }
    public int nextEventId() { return eventSeq++; }
    public int nextReviewId() { return reviewSeq++; }
    public int nextNotificationId() { return notificationSeq++; }

    public User findUserById(int id) {
        for (User u : users) {
            if (u.getUserId() == id) return u;
        }
        return null;
    }

    /** Finds any user (admin, organizer, participant) by email. Not case sensitive. */
    public User findUserByEmail(String email) {
        if (email == null) return null;
        String wanted = email.trim();
        for (User u : users) {
            if (u.getEmail().equalsIgnoreCase(wanted)) return u;
        }
        return null;
    }

    /** Finds an admin by his email. Returns null if it is not an admin's email. */
    public User findAdminByEmail(String email) {
        User user = findUserByEmail(email);
        return (user != null && user.getRole() == Role.ADMIN) ? user : null;
    }

    public Event findEventById(int id) {
        for (Event e : events) {
            if (e.getEventId() == id) return e;
        }
        return null;
    }

    // ---------- Approved organizer emails ----------

    public boolean isApprovedOrganizer(String email) {
        if (email == null) return false;
        for (String approved : approvedOrganizerEmails) {
            if (approved.equalsIgnoreCase(email.trim())) return true;
        }
        return false;
    }

    /** Returns false if the email was already on the list. */
    public boolean addApprovedOrganizer(String email) {
        if (isApprovedOrganizer(email)) return false;
        approvedOrganizerEmails.add(email.trim());
        return true;
    }

    public List<String> getApprovedOrganizerEmails() {
        return new ArrayList<>(approvedOrganizerEmails);
    }

    /** Swaps one user object for another (same position in the list). */
    public void replaceUser(User oldUser, User newUser) {
        int index = users.indexOf(oldUser);
        if (index < 0) throw new IllegalArgumentException("User not found.");
        users.set(index, newUser);
    }
}
