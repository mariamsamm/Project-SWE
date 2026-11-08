package eventsystem;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * The admins that are saved and known in advance.
 * An admin types his EMAIL, then the static password.
 * Do NOT keep a real password here if the repository is public.
 */
class KnownAdmins {

    /** Each admin: {full name, email}. Edit these with your real admins. */
    static final String[][] ADMINS = {
            {"Abdelrahman", "abdelrahman@event.com"},
            {"Admin Two", "admin2@event.com"},
            {"Admin Three", "admin3@event.com"}
    };

    /** The one static password for every admin. */
    static final String PASSWORD = "Admin@123";

    private KnownAdmins() { }
}

/** Item 1: create an account or log in. Item 2: the role comes from the User object. */
class AuthService {

    private final DataStore store;

    public AuthService(DataStore store) {
        this.store = store;
    }

    // ---------- Admins (email + static password) ----------

    /** Creates the known admins when the program starts. */
    public void seedKnownAdmins() {
        String hash = PasswordHasher.hash(KnownAdmins.PASSWORD);
        for (String[] admin : KnownAdmins.ADMINS) {
            store.getUsers().add(new Admin(store.nextUserId(), admin[0], admin[1], hash));
        }
    }

    /** True if the text is the email of a known admin. */
    public boolean isAdminEmail(String text) {
        return store.findAdminByEmail(text) != null;
    }

    public Admin adminLogin(String email, String password) {
        User user = store.findAdminByEmail(email);
        if (user == null || !user.login(password)) {
            throw new IllegalArgumentException("Wrong admin password.");
        }
        return (Admin) user;
    }

    // ---------- Normal users (full name + email + date of birth + password) ----------

    /** True if an account with this email already exists. Throws if the email is not valid. */
    public boolean emailExists(String email) {
        return store.findUserByEmail(InputValidator.requireValidEmail(email)) != null;
    }

    /**
     * First-time sign up. The role is decided automatically:
     * if the admin added this email as an organizer -> ORGANIZER, otherwise PARTICIPANT.
     */
    public User register(String fullName, String email, LocalDate dateOfBirth,
                         String password, String confirmPassword) {
        String cleanName = InputValidator.requireValidFullName(fullName);
        String cleanEmail = InputValidator.requireValidEmail(email);
        if (!InputValidator.isValidBirthDate(dateOfBirth)) {
            throw new IllegalArgumentException(InputValidator.BIRTH_DATE_RULES);
        }
        if (store.findUserByEmail(cleanEmail) != null) {
            throw new IllegalArgumentException("This email is already registered. Please log in.");
        }

        List<String> problems = PasswordValidator.validate(password);
        if (!problems.isEmpty()) {
            throw new IllegalArgumentException(String.join("\n", problems));
        }
        if (!password.equals(confirmPassword)) {
            throw new IllegalArgumentException("Passwords do not match.");
        }

        int id = store.nextUserId();
        String hash = PasswordHasher.hash(password);
        User user;
        if (store.isApprovedOrganizer(cleanEmail)) {
            user = new EventOrganizer(id, cleanName, cleanEmail, dateOfBirth, hash);
        } else {
            user = new Participant(id, cleanName, cleanEmail, dateOfBirth, hash);
        }
        store.getUsers().add(user);
        return user;
    }

    public User login(String email, String password) {
        String cleanEmail = InputValidator.requireValidEmail(email);
        User user = store.findUserByEmail(cleanEmail);
        if (user == null) {
            throw new IllegalArgumentException("Invalid email or password.");
        }
        if (!user.isActive()) {
            throw new IllegalStateException("This account has been deactivated. Contact the admin.");
        }
        if (!user.login(password)) {
            throw new IllegalArgumentException("Invalid email or password.");
        }
        return user;
    }

    public void logout(User user) {
        user.logout();
    }

    public void updateProfile(User user, String newFullName, String newEmail) {
        if (user.getRole() == Role.ADMIN) {
            throw new IllegalStateException("Admin accounts are fixed and cannot be changed.");
        }
        String cleanEmail = InputValidator.requireValidEmail(newEmail);
        User existing = store.findUserByEmail(cleanEmail);
        if (existing != null && existing.getUserId() != user.getUserId()) {
            throw new IllegalArgumentException("This email is already used by another account.");
        }
        user.updateProfile(newFullName, cleanEmail);
    }
}

/** Item 6: in-app notifications for approval, rejection, and change requests (not sent by email). */
class NotificationService {

    private final DataStore store;

    public NotificationService(DataStore store) {
        this.store = store;
    }

    public void send(int recipientId, String message) {
        store.getNotifications().add(
                new Notification(store.nextNotificationId(), recipientId, message));
    }

    public void sendToAllAdmins(String message) {
        for (User u : store.getUsers()) {
            if (u.getRole() == Role.ADMIN) {
                send(u.getUserId(), message);
            }
        }
    }

    public List<Notification> getFor(int userId) {
        List<Notification> result = new ArrayList<>();
        for (Notification n : store.getNotifications()) {
            if (n.getRecipientId() == userId) result.add(n);
        }
        return result;
    }

    public int unreadCount(int userId) {
        int count = 0;
        for (Notification n : getFor(userId)) {
            if (!n.isRead()) count++;
        }
        return count;
    }

    public void markAllRead(int userId) {
        for (Notification n : getFor(userId)) n.markRead();
    }
}
