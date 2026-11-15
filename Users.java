package eventsystem;

import java.time.LocalDate;
import java.time.Period;

/** Base class for every person in the system (matches the UML). */
abstract class User {

    private final int userId;
    private String fullName;
    private String email;                    // unique, used to log in
    private final LocalDate dateOfBirth;     // null for admins; used to check age limits on events
    private final String passwordHash;
    private boolean active = true;
    private boolean loggedIn = false;

    protected User(int userId, String fullName, String email, LocalDate dateOfBirth, String passwordHash) {
        this.userId = userId;
        this.fullName = InputValidator.requireValidFullName(fullName);
        this.email = InputValidator.requireValidEmail(email);
        this.dateOfBirth = dateOfBirth;
        this.passwordHash = passwordHash;
    }

    public abstract Role getRole();

    public boolean login(String rawPassword) {
        if (!active) return false;
        if (PasswordHasher.hash(rawPassword).equals(passwordHash)) {
            loggedIn = true;
            return true;
        }
        return false;
    }

    public void logout() {
        loggedIn = false;
    }

    public void updateProfile(String newFullName, String newEmail) {
        this.fullName = InputValidator.requireValidFullName(newFullName);
        this.email = InputValidator.requireValidEmail(newEmail);
    }

    /** Age in years today, or -1 if there is no date of birth (admins). For event age limits. */
    public int getAge() {
        if (dateOfBirth == null) return -1;
        return Period.between(dateOfBirth, LocalDate.now()).getYears();
    }

    public int getUserId() { return userId; }
    public String getName() { return fullName; }
    public String getEmail() { return email; }
    public LocalDate getDateOfBirth() { return dateOfBirth; }
    public String getPasswordHash() { return passwordHash; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public boolean isLoggedIn() { return loggedIn; }

    @Override
    public String toString() {
        return "#" + userId + " | " + fullName + " | " + email
                + " | " + getRole()
                + " | " + (active ? "ACTIVE" : "DEACTIVATED");
    }
}

/** Admins are known in advance and use their email + the static password. */
class Admin extends User {

    public Admin(int userId, String fullName, String email, String passwordHash) {
        super(userId, fullName, email, null, passwordHash);
    }

    @Override
    public Role getRole() {
        return Role.ADMIN;
    }
}

// Member 1 / Member 4 can add organizer-specific methods here.
class EventOrganizer extends User {

    public EventOrganizer(int userId, String fullName, String email, LocalDate dateOfBirth, String passwordHash) {
        super(userId, fullName, email, dateOfBirth, passwordHash);
    }

    @Override
    public Role getRole() {
        return Role.ORGANIZER;
    }
}

// Member 2 / Member 5 can add participant-specific methods here.
class Participant extends User {

    public Participant(int userId, String fullName, String email, LocalDate dateOfBirth, String passwordHash) {
        super(userId, fullName, email, dateOfBirth, passwordHash);
    }

    @Override
    public Role getRole() {
        return Role.PARTICIPANT;
    }
}
