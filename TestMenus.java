package eventsystem;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

// PLACEHOLDER: Member 5 owns the real homepage.
/**
 * The only page visitors and participants see: the list of published events.
 * A logged-in participant stays on this same page with a few extra options.
 */
class HomePage {

    private final Console console;
    private final AdminService adminService;
    private final AuthMenu authMenu;
    private final NotificationService notifications;
    private final CommonActions common;

    public HomePage(Console console, AdminService adminService, AuthMenu authMenu,
                    NotificationService notifications, CommonActions common) {
        this.console = console;
        this.adminService = adminService;
        this.authMenu = authMenu;
        this.notifications = notifications;
        this.common = common;
    }

    /** Visitor view. Returns the user once someone logs in, or null if they exit. */
    public User show() {
        while (true) {
            List<Event> events = adminService.getPublishedEvents();
            printBanner(events, null);

            System.out.println("\n1. Log in");
            System.out.println("2. Sign up");
            System.out.println("3. Search for events");
            System.out.println("0. Exit");

            switch (console.readLine("Choose: ")) {
                case "1": {
                    User loggedIn = authMenu.login();
                    if (loggedIn != null) return loggedIn;
                    break;
                }
                case "2": {
                    User created = authMenu.signUp();
                    if (created != null) return created;
                    break;
                }
                case "3":
                    searchEvents(events);
                    break;
                case "0":
                    return null;
                default:
                    System.out.println("Invalid choice.");
            }
        }
    }

    /** Same homepage for a logged-in participant, with extra options. */
    public void showForParticipant(Participant participant) {
        while (true) {
            List<Event> events = adminService.getPublishedEvents();
            printBanner(events, participant);

            System.out.println("\n1. Search for events");
            System.out.println("2. Notifications (" + notifications.unreadCount(participant.getUserId()) + " new)");
            System.out.println("3. Update profile");
            System.out.println("0. Logout");

            switch (console.readLine("Choose: ")) {
                case "1": searchEvents(events); break;
                case "2": common.showNotifications(participant); break;
                case "3": common.updateProfile(participant); break;
                case "0": return;
                default: System.out.println("Invalid choice.");
            }
        }
    }

    private void printBanner(List<Event> events, User user) {
        System.out.println("\n==================================");
        System.out.println("      EVENT MANAGEMENT SYSTEM");
        System.out.println("==================================");
        if (user != null) {
            System.out.println("Welcome, " + user.getName());
        }
        System.out.println("Published events:");
        if (events.isEmpty()) {
            System.out.println("  No published events yet.");
        }
        for (Event e : events) System.out.println("  " + e);
    }

    /**
     * Search by event name. The user types the first letters (even 2),
     * sees every published event whose name STARTS with them,
     * then picks one to see its details.
     */
    private void searchEvents(List<Event> events) {
        String text = console.readLine("Search for events: ");
        if (text.isEmpty()) {
            System.out.println("Please type the beginning of the event name.");
            return;
        }

        String prefix = text.toLowerCase();
        List<Event> found = new ArrayList<>();
        for (Event e : events) {
            if (e.getTitle().toLowerCase().startsWith(prefix)) found.add(e);
        }
        if (found.isEmpty()) {
            System.out.println("No event starts with \"" + text + "\".");
            return;
        }

        System.out.println("\nEvents starting with \"" + text + "\":");
        for (int i = 0; i < found.size(); i++) {
            Event e = found.get(i);
            System.out.println("  " + (i + 1) + ". " + e.getTitle() + " | " + e.getEventDate());
        }

        while (true) {
            int choice = console.readInt("Choose an event number (0 to go back): ");
            if (choice == 0) return;
            if (choice >= 1 && choice <= found.size()) {
                System.out.println("\n" + found.get(choice - 1).details());
                return;
            }
            System.out.println("Please choose a number from the list.");
        }
    }
}

// PLACEHOLDER: Member 4 owns the real organizer frontend.
class OrganizerMenu {

    private final Console console;
    private final EventService eventService;
    private final NotificationService notifications;
    private final CommonActions common;

    public OrganizerMenu(Console console, EventService eventService,
                         NotificationService notifications, CommonActions common) {
        this.console = console;
        this.eventService = eventService;
        this.notifications = notifications;
        this.common = common;
    }

    public void run(EventOrganizer organizer) {
        while (true) {
            System.out.println("\n===== ORGANIZER MENU (" + organizer.getName() + ") =====");
            System.out.println("1. Create event and submit for approval");
            System.out.println("2. My events");
            System.out.println("3. Edit & resubmit an event (after admin feedback)");
            System.out.println("4. Notifications (" + notifications.unreadCount(organizer.getUserId()) + " new)");
            System.out.println("5. Update profile");
            System.out.println("0. Logout");

            switch (console.readLine("Choose: ")) {
                case "1": createAndSubmit(organizer); break;
                case "2": myEvents(organizer); break;
                case "3": editAndResubmit(organizer); break;
                case "4": common.showNotifications(organizer); break;
                case "5": common.updateProfile(organizer); break;
                case "0": return;
                default: System.out.println("Invalid choice.");
            }
        }
    }

    private void createAndSubmit(EventOrganizer organizer) {
        String title = console.readLine("Title: ");
        String category = console.readLine("Category: ");
        String description = console.readLine("Description: ");
        LocalDate date = console.readDate("Date");
        String location = console.readLine("Location: ");
        int capacity = console.readInt("Capacity: ");

        if (title.isEmpty() || capacity <= 0) {
            System.out.println("Title is required and capacity must be above 0.");
            return;
        }
        Event event = eventService.createEvent(organizer, title, category, description, date, location, capacity);
        eventService.submitEvent(event, organizer.getName());
        System.out.println("Event #" + event.getEventId() + " submitted. Status: " + event.getStatus());
    }

    private void myEvents(EventOrganizer organizer) {
        List<Event> events = eventService.getEventsByOrganizer(organizer.getUserId());
        System.out.println();
        if (events.isEmpty()) System.out.println("You have no events.");
        for (Event e : events) System.out.println(e.details() + "\n");
    }

    private void editAndResubmit(EventOrganizer organizer) {
        Event event = console.readEvent("Event name to edit",
                eventService.getEventsByOrganizer(organizer.getUserId()));
        if (event == null) return;
        if (event.getStatus() != EventStatus.REVISION_REQUIRED && event.getStatus() != EventStatus.DRAFT) {
            System.out.println("This event cannot be edited (status: " + event.getStatus() + ").");
            return;
        }
        System.out.println(event.details());
        String title = console.readLine("New title: ");
        String category = console.readLine("New category: ");
        String description = console.readLine("New description: ");
        LocalDate date = console.readDate("New date");
        String location = console.readLine("New location: ");
        int capacity = console.readInt("New capacity: ");

        try {
            event.update(title, category, description, date, location, capacity);
            eventService.submitEvent(event, organizer.getName());
            System.out.println("Event updated and resubmitted. Status: " + event.getStatus());
        } catch (RuntimeException e) {
            System.out.println("Error: " + e.getMessage());
        }
    }
}
