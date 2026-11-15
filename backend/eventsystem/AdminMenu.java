package eventsystem;

import java.util.List;

class AdminMenu {

    private final Console console;
    private final AdminService adminService;
    private final NotificationService notifications;
    private final CommonActions common;

    public AdminMenu(Console console, AdminService adminService,
                     NotificationService notifications, CommonActions common) {
        this.console = console;
        this.adminService = adminService;
        this.notifications = notifications;
        this.common = common;
    }

    public void run(Admin admin) {
        while (true) {
            System.out.println("\n===== ADMIN MENU (" + admin.getName() + ") =====");
            System.out.println("1. View pending event requests");
            System.out.println("2. Review an event (approve / reject / request changes)");
            System.out.println("3. View all events");
            System.out.println("4. View homepage (published events)");
            System.out.println("5. Unpublish an event");
            System.out.println("6. Manage users");
            System.out.println("7. Organizers (add organizer email / view approved)");
            System.out.println("8. View reports");
            System.out.println("9. Notifications (" + notifications.unreadCount(admin.getUserId()) + " new)");
            System.out.println("0. Logout");

            switch (console.readLine("Choose: ")) {
                case "1": printList(adminService.getPendingEvents(), "No pending requests."); break;
                case "2": reviewFlow(admin); break;
                case "3": printList(adminService.viewAllEvents(), "No events yet."); break;
                case "4": printList(adminService.getPublishedEvents(), "No published events."); break;
                case "5": unpublish(); break;
                case "6": manageUsers(admin); break;
                case "7": organizers(admin); break;
                case "8": System.out.println("\n" + adminService.viewReports()); break;
                case "9": common.showNotifications(admin); break;
                case "0": return;
                default: System.out.println("Invalid choice.");
            }
        }
    }

    private void reviewFlow(Admin admin) {
        Event chosen = console.readEvent("Event name to review", adminService.viewAllEvents());
        if (chosen == null) return;
        int id = chosen.getEventId();
        Event event = adminService.reviewEvent(id);
        if (event == null) {
            System.out.println("Event not found.");
            return;
        }
        System.out.println("\n" + event.details());

        System.out.println("\n1. Approve & publish");
        System.out.println("2. Reject");
        System.out.println("3. Request changes (send back to organizer)");
        System.out.println("0. Back");
        String choice = console.readLine("Decision: ");

        try {
            switch (choice) {
                case "1":
                    String note = console.readLine("Optional note for the organizer (press Enter to skip): ");
                    adminService.approveEvent(admin, id, note);
                    System.out.println("Event approved and published on the homepage.");
                    break;
                case "2":
                    String reason = console.readLine("Rejection reason: ");
                    adminService.rejectEvent(admin, id, reason);
                    System.out.println("Event rejected. The organizer was notified.");
                    break;
                case "3":
                    String feedback = console.readLine("What must the organizer change? ");
                    adminService.requestRevision(admin, id, feedback);
                    System.out.println("Sent back to the organizer for changes.");
                    break;
                default:
                    break;
            }
        } catch (RuntimeException e) {
            System.out.println("Error: " + e.getMessage());
        }
    }

    private void unpublish() {
        Event chosen = console.readEvent("Event name to unpublish", adminService.getPublishedEvents());
        if (chosen == null) return;
        int id = chosen.getEventId();
        String reason = console.readLine("Reason (optional): ");
        try {
            adminService.unpublishEvent(id, reason);
            System.out.println("Event removed from the homepage.");
        } catch (RuntimeException e) {
            System.out.println("Error: " + e.getMessage());
        }
    }

    private void manageUsers(Admin admin) {
        List<User> users = adminService.manageUsers();
        System.out.println("\n--- Users ---");
        for (User u : users) System.out.println(u);

        String choice = console.readLine("\n1) Deactivate  2) Activate  0) Back: ");
        if (!choice.equals("1") && !choice.equals("2")) return;

        int id = console.readInt("User ID: ");
        try {
            adminService.setUserActive(admin, id, choice.equals("2"));
            System.out.println("User updated.");
        } catch (RuntimeException e) {
            System.out.println("Error: " + e.getMessage());
        }
    }

    private void organizers(Admin admin) {
        System.out.println("\n--- Approved organizer emails ---");
        List<String> emails = adminService.getApprovedOrganizerEmails();
        if (emails.isEmpty()) {
            System.out.println("None yet.");
        }
        for (String email : emails) System.out.println("  " + email);

        String choice = console.readLine("\n1) Add organizer email  0) Back: ");
        if (!choice.equals("1")) return;

        String email = console.readLine("Organizer email: ");
        try {
            adminService.addOrganizer(admin, email);
            System.out.println("Saved. When this person signs up or logs in with this email, "
                    + "the organizer page opens for them.");
        } catch (RuntimeException e) {
            System.out.println("Error: " + e.getMessage());
        }
    }

    private void printList(List<Event> events, String emptyMessage) {
        System.out.println();
        if (events.isEmpty()) {
            System.out.println(emptyMessage);
            return;
        }
        for (Event e : events) System.out.println(e);
    }
}
