package eventsystem;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Scanner;

/** Reads input from the user (this is the "input from the user" instead of a database). */
class Console {

    private final Scanner in = new Scanner(System.in);

    public String readLine(String prompt) {
        System.out.print(prompt);
        return in.nextLine().trim();
    }

    /** Hides the typing in a real terminal. In an IDE it falls back to normal input. */
    public String readPassword(String prompt) {
        java.io.Console systemConsole = System.console();
        if (systemConsole != null) {
            char[] chars = systemConsole.readPassword(prompt);
            return chars == null ? "" : new String(chars);
        }
        return readLine(prompt);
    }

    public int readInt(String prompt) {
        while (true) {
            try {
                return Integer.parseInt(readLine(prompt));
            } catch (NumberFormatException e) {
                System.out.println("Please enter a valid number.");
            }
        }
    }

    /**
     * Asks for an event NAME (no ID) and returns the chosen event, or null if nothing was chosen.
     * "candidates" is the list of events the user is allowed to pick from.
     * One match -> picked automatically. Several matches -> numbered list, the user picks a number.
     */
    public Event readEvent(String prompt, List<Event> candidates) {
        String text = readLine(prompt + ": ").toLowerCase();
        if (text.isEmpty()) {
            System.out.println("Please enter an event name.");
            return null;
        }

        List<Event> exact = new ArrayList<>();
        List<Event> found = new ArrayList<>();
        for (Event e : candidates) {
            String title = e.getTitle().toLowerCase();
            if (title.equals(text)) exact.add(e);
            if (title.contains(text)) found.add(e);
        }

        if (exact.size() == 1) {
            System.out.println("Found: " + exact.get(0));
            return exact.get(0);
        }
        if (found.isEmpty()) {
            System.out.println("No event found with that name.");
            return null;
        }
        if (found.size() == 1) {
            System.out.println("Found: " + found.get(0));
            return found.get(0);
        }

        System.out.println("Events found:");
        for (int i = 0; i < found.size(); i++) {
            System.out.println("  " + (i + 1) + ") " + found.get(i));
        }
        while (true) {
            int choice = readInt("Choose a number from the list (0 to cancel): ");
            if (choice == 0) return null;
            if (choice >= 1 && choice <= found.size()) return found.get(choice - 1);
            System.out.println("Please choose a number from the list.");
        }
    }

    public LocalDate readDate(String prompt) {
        while (true) {
            try {
                return LocalDate.parse(readLine(prompt + " (yyyy-MM-dd): "));
            } catch (DateTimeParseException e) {
                System.out.println("Invalid date. Example: 2026-12-25");
            }
        }
    }
}

/** Actions the roles share: see notifications, update profile. */
class CommonActions {

    private final Console console;
    private final AuthService auth;
    private final NotificationService notifications;

    public CommonActions(Console console, AuthService auth, NotificationService notifications) {
        this.console = console;
        this.auth = auth;
        this.notifications = notifications;
    }

    public void showNotifications(User user) {
        List<Notification> list = notifications.getFor(user.getUserId());
        System.out.println("\n--- Notifications ---");
        if (list.isEmpty()) {
            System.out.println("No notifications.");
            return;
        }
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
        for (int i = list.size() - 1; i >= 0; i--) {
            Notification n = list.get(i);
            System.out.println((n.isRead() ? "   " : "[NEW] ")
                    + n.getCreatedAt().format(fmt) + " - " + n.getMessage());
        }
        notifications.markAllRead(user.getUserId());
    }

    public void updateProfile(User user) {
        System.out.println("\n--- Update Profile ---");
        System.out.println("Current full name: " + user.getName());
        System.out.println("Current email:     " + user.getEmail());
        String name = console.readLine("New full name (press Enter to keep): ");
        String email = console.readLine("New email (press Enter to keep): ");
        if (name.isEmpty()) name = user.getName();
        if (email.isEmpty()) email = user.getEmail();
        try {
            auth.updateProfile(user, name, email);
            System.out.println("Profile updated.");
        } catch (RuntimeException e) {
            System.out.println("Error: " + e.getMessage());
        }
    }
}

/**
 * The Login and Sign up screens used by the HomePage (same fields as the website).
 *  - Login:   Email + Password. An admin email asks for the static password.
 *             An email with NO account is sent straight to Sign up.
 *  - Sign up: Full name, Email, Date of birth, Password, Confirm password.
 */
class AuthMenu {

    private static final int MAX_ADMIN_ATTEMPTS = 3;

    private final Console console;
    private final AuthService auth;

    public AuthMenu(Console console, AuthService auth) {
        this.console = console;
        this.auth = auth;
    }

    /**
     * Entry point used by the HomePage (unchanged for Member 5).
     * Shows Log in / Sign up, and returns the logged-in user, or null if nobody logged in.
     */
    public User enter() {
        System.out.println("\n--- Log in / Sign up ---");
        System.out.println("1. Log in");
        System.out.println("2. Sign up");
        System.out.println("0. Back");
        switch (console.readLine("Choose: ")) {
            case "1": return login();
            case "2": return signUp();
            default:  return null;
        }
    }

    /** Login screen. Returns the logged-in user, or null if nobody logged in. */
    public User login() {
        System.out.println("\n--- Log in ---");
        String entry = console.readLine("Email: ");

        if (auth.isAdminEmail(entry)) {
            return adminLogin(entry);
        }

        String email;
        try {
            email = InputValidator.requireValidEmail(entry);
        } catch (IllegalArgumentException e) {
            System.out.println("Error: " + e.getMessage());
            return null;
        }

        if (auth.emailExists(email)) {
            return userLogin(email);
        }

        // New to EventHub? -> go to Sign up with the email already typed.
        System.out.println("No account found with the email \"" + email + "\". Taking you to Sign up...");
        return createAccount(null, email);
    }

    /** Sign up screen. Returns the new logged-in user, or null if the account was not created. */
    public User signUp() {
        System.out.println("\n--- Sign up ---");
        System.out.println("Your date of birth is used to check age limits on events.");

        String fullName = readFullName();
        if (fullName == null) return null;

        String entry = console.readLine("Email: ");

        if (auth.isAdminEmail(entry)) {
            System.out.println("This email belongs to an admin account. Please use Log in.");
            return null;
        }

        String email;
        try {
            email = InputValidator.requireValidEmail(entry);
        } catch (IllegalArgumentException e) {
            System.out.println("Error: " + e.getMessage());
            return null;
        }

        if (auth.emailExists(email)) {
            System.out.println("This email is already registered. Already have an account? Use Log in.");
            return null;
        }
        return createAccount(fullName, email);
    }

    private User adminLogin(String email) {
        for (int attempt = 1; attempt <= MAX_ADMIN_ATTEMPTS; attempt++) {
            String password = console.readPassword("Admin password: ");
            try {
                Admin admin = auth.adminLogin(email, password);
                System.out.println("Welcome, " + admin.getName() + " (ADMIN)");
                return admin;
            } catch (RuntimeException e) {
                System.out.println("Error: " + e.getMessage()
                        + " (" + attempt + "/" + MAX_ADMIN_ATTEMPTS + ")");
            }
        }
        System.out.println("Too many wrong attempts. Back to the homepage.");
        return null;
    }

    private User userLogin(String email) {
        String password = console.readPassword("Password: ");
        try {
            User user = auth.login(email, password);
            System.out.println("Welcome back, " + user.getName() + " (" + user.getRole() + ")");
            return user;
        } catch (RuntimeException e) {
            System.out.println("Error: " + e.getMessage());
            return null;
        }
    }

    /** Asks for the full name until it is valid. Returns null if the person cancels (Enter). */
    private String readFullName() {
        while (true) {
            String name = console.readLine("Full name (press Enter to cancel): ");
            if (name.isEmpty()) {
                System.out.println("Account creation cancelled.");
                return null;
            }
            if (InputValidator.isValidFullName(name)) return name;
            System.out.println(InputValidator.FULL_NAME_RULES);
        }
    }

    /**
     * Create account steps. Used by Sign up, and by Log in when the email has no account.
     * fullName is null when it has not been asked yet (the Log in path).
     */
    private User createAccount(String fullName, String email) {
        if (fullName == null) {
            System.out.println("\n--- Create your account ---");
            System.out.println("Your date of birth is used to check age limits on events.");
            fullName = readFullName();
            if (fullName == null) return null;
        }
        System.out.println("Your email will be: " + email);

        LocalDate dateOfBirth;
        while (true) {
            dateOfBirth = console.readDate("Date of birth");
            if (InputValidator.isValidBirthDate(dateOfBirth)) break;
            System.out.println(InputValidator.BIRTH_DATE_RULES);
        }

        System.out.println("Password rules: at least " + PasswordValidator.MIN_LENGTH
                + " characters, uppercase, lowercase, a number, and a symbol from "
                + PasswordValidator.SPECIAL_SYMBOLS);

        // Ask for the password again until it is strong enough and confirmed.
        String password;
        while (true) {
            password = console.readPassword("Password (press Enter to cancel): ");
            if (password.isEmpty()) {
                System.out.println("Account creation cancelled.");
                return null;
            }

            List<String> problems = PasswordValidator.validate(password);
            if (!problems.isEmpty()) {
                System.out.println("This password is not strong enough:");
                for (String problem : problems) System.out.println("  - " + problem);
                System.out.println("Please try again.");
                continue;
            }

            String confirm = console.readPassword("Confirm password: ");
            if (!password.equals(confirm)) {
                System.out.println("Passwords do not match. Please try again.");
                continue;
            }
            break;
        }

        try {
            auth.register(fullName, email, dateOfBirth, password, password);
            User user = auth.login(email, password);
            System.out.println("Account created. Welcome, " + user.getName() + " (" + user.getRole() + ")");
            return user;
        } catch (RuntimeException e) {
            System.out.println("Could not create account:\n" + e.getMessage());
            return null;
        }
    }
}
