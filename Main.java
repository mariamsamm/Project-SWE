package eventsystem;

public class Main {

    public static void main(String[] args) {
        // Storage (no real database yet)
        DataStore store = new DataStore();

        // Services
        NotificationService notifications = new NotificationService(store);
        AuthService auth = new AuthService(store);
        AdminService adminService = new AdminService(store, notifications);
        EventService eventService = new EventService(store, notifications);

        // The known admins (edit them in KnownAdmins, in UserServices.java)
        auth.seedKnownAdmins();

        // UI
        Console console = new Console();
        CommonActions common = new CommonActions(console, auth, notifications);
        AuthMenu authMenu = new AuthMenu(console, auth);
        AdminMenu adminMenu = new AdminMenu(console, adminService, notifications, common);
        OrganizerMenu organizerMenu = new OrganizerMenu(console, eventService, notifications, common);
        HomePage homePage = new HomePage(console, adminService, authMenu, notifications, common);

        while (true) {
            // The homepage is the first screen. It returns a user once someone logs in.
            User user = homePage.show();
            if (user == null) {
                System.out.println("Goodbye!");
                break;
            }

            // Item 2: the system identifies the user's role
            switch (user.getRole()) {
                case ADMIN:
                    adminMenu.run((Admin) user);
                    break;
                case ORGANIZER:
                    organizerMenu.run((EventOrganizer) user);
                    break;
                default:
                    homePage.showForParticipant((Participant) user);
                    break;
            }
            auth.logout(user);
            System.out.println("Logged out.");
        }
    }
}
