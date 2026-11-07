package eventsystem;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

// PLACEHOLDER: Member 1 owns Event and EventService.
class Event {

    private final int eventId;
    private final int organizerId;
    private String title;
    private String category;
    private String description;
    private LocalDate eventDate;
    private String location;
    private int capacity;
    private EventStatus status = EventStatus.DRAFT;
    private String adminFeedback = "";

    public Event(int eventId, int organizerId, String title, String category,
                 String description, LocalDate eventDate, String location, int capacity) {
        this.eventId = eventId;
        this.organizerId = organizerId;
        this.title = title;
        this.category = category;
        this.description = description;
        this.eventDate = eventDate;
        this.location = location;
        this.capacity = capacity;
    }

    public void update(String title, String category, String description,
                       LocalDate eventDate, String location, int capacity) {
        if (status != EventStatus.DRAFT && status != EventStatus.REVISION_REQUIRED) {
            throw new IllegalStateException("Only DRAFT or REVISION_REQUIRED events can be edited.");
        }
        this.title = title;
        this.category = category;
        this.description = description;
        this.eventDate = eventDate;
        this.location = location;
        this.capacity = capacity;
    }

    public void submit() {
        if (status != EventStatus.DRAFT && status != EventStatus.REVISION_REQUIRED) {
            throw new IllegalStateException("Only DRAFT or REVISION_REQUIRED events can be submitted.");
        }
        status = EventStatus.PENDING;
    }

    public void publish() {
        status = EventStatus.PUBLISHED;
    }

    public int getEventId() { return eventId; }
    public int getOrganizerId() { return organizerId; }
    public String getTitle() { return title; }
    public String getCategory() { return category; }
    public String getDescription() { return description; }
    public LocalDate getEventDate() { return eventDate; }
    public String getLocation() { return location; }
    public int getCapacity() { return capacity; }
    public EventStatus getStatus() { return status; }
    public void setStatus(EventStatus status) { this.status = status; }
    public String getAdminFeedback() { return adminFeedback; }
    public void setAdminFeedback(String adminFeedback) { this.adminFeedback = adminFeedback; }

    public String details() {
        return "Event #" + eventId + " [" + status + "]\n"
                + "  Title:       " + title + "\n"
                + "  Category:    " + category + "\n"
                + "  Description: " + description + "\n"
                + "  Date:        " + eventDate + "\n"
                + "  Location:    " + location + "\n"
                + "  Capacity:    " + capacity
                + (adminFeedback.isEmpty() ? "" : "\n  Admin note:  " + adminFeedback);
    }

    @Override
    public String toString() {
        return "#" + eventId + " | " + title + " | " + eventDate + " | " + status;
    }
}

// PLACEHOLDER: Member 1 owns this.
class EventService {

    private final DataStore store;
    private final NotificationService notifications;

    public EventService(DataStore store, NotificationService notifications) {
        this.store = store;
        this.notifications = notifications;
    }

    public Event createEvent(EventOrganizer organizer, String title, String category,
                             String description, LocalDate date, String location, int capacity) {
        Event event = new Event(store.nextEventId(), organizer.getUserId(), title,
                category, description, date, location, capacity);
        store.getEvents().add(event);
        return event;
    }

    /** Submit for admin approval: DRAFT/REVISION_REQUIRED -> PENDING, and admins are notified (item 3). */
    public void submitEvent(Event event, String organizerName) {
        event.submit();
        notifications.sendToAllAdmins("New event request from " + organizerName
                + ": \"" + event.getTitle() + "\" (Event #" + event.getEventId() + ")");
    }

    public List<Event> getEventsByOrganizer(int organizerId) {
        List<Event> result = new ArrayList<>();
        for (Event e : store.getEvents()) {
            if (e.getOrganizerId() == organizerId) result.add(e);
        }
        return result;
    }
}
