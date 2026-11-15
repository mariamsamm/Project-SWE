package eventsystem;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/** Checks that a password is strong enough. */
class PasswordValidator {

    public static final int MIN_LENGTH = 8;
    public static final String SPECIAL_SYMBOLS = "!@#$%^&*()_+-=?";

    private PasswordValidator() { }

    /** Returns a list of problems. An empty list means the password is valid. */
    public static List<String> validate(String password) {
        List<String> problems = new ArrayList<>();

        if (password == null) {
            problems.add("Password cannot be empty.");
            return problems;
        }
        if (password.length() < MIN_LENGTH) {
            problems.add("Password must be at least " + MIN_LENGTH + " characters long.");
        }

        boolean upper = false, lower = false, digit = false, special = false;
        for (char c : password.toCharArray()) {
            if (Character.isUpperCase(c)) upper = true;
            else if (Character.isLowerCase(c)) lower = true;
            else if (Character.isDigit(c)) digit = true;
            else if (SPECIAL_SYMBOLS.indexOf(c) >= 0) special = true;
        }

        if (!upper)   problems.add("Password must contain at least one uppercase letter.");
        if (!lower)   problems.add("Password must contain at least one lowercase letter.");
        if (!digit)   problems.add("Password must contain at least one number.");
        if (!special) problems.add("Password must contain at least one symbol from: " + SPECIAL_SYMBOLS);
        if (password.contains(" ")) problems.add("Password must not contain spaces.");

        return problems;
    }

    public static boolean isValid(String password) {
        return validate(password).isEmpty();
    }
}

/** Turns a password into a SHA-256 hash so we never store the raw password. */
class PasswordHasher {

    private PasswordHasher() { }

    public static String hash(String password) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(password.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : bytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}

/**
 * Input checks. The EMAIL is the user's identity (there is no username),
 * so every function that receives an email must call requireValidEmail() first.
 */
class InputValidator {

    private static final Pattern EMAIL =
            Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");

    public static final String EMAIL_RULES = "Invalid email format. Example: name@example.com";

    private InputValidator() { }

    public static boolean isValidEmail(String email) {
        return email != null && EMAIL.matcher(email.trim()).matches();
    }

    /** Removes spaces around the email. */
    public static String normalizeEmail(String email) {
        return email == null ? null : email.trim();
    }

    /** Returns the cleaned email, or throws if the email is not valid. */
    public static String requireValidEmail(String email) {
        if (!isValidEmail(email)) {
            throw new IllegalArgumentException(EMAIL_RULES);
        }
        return normalizeEmail(email);
    }

    // ---------- Full name ----------

    public static final String FULL_NAME_RULES =
            "Full name must be 2-60 characters, start with a letter, and use only letters, spaces, ' . -";

    public static boolean isValidFullName(String name) {
        if (name == null) return false;
        String n = name.trim();
        if (n.length() < 2 || n.length() > 60) return false;
        if (!Character.isLetter(n.charAt(0))) return false;
        for (char c : n.toCharArray()) {
            boolean allowed = Character.isLetter(c) || c == ' ' || c == '.' || c == '-' || c == '\'';
            if (!allowed) return false;
        }
        return true;
    }

    /** Returns the cleaned full name (extra spaces removed), or throws if it is not valid. */
    public static String requireValidFullName(String name) {
        if (!isValidFullName(name)) {
            throw new IllegalArgumentException(FULL_NAME_RULES);
        }
        return name.trim().replaceAll("\\s+", " ");
    }

    // ---------- Date of birth (used to check age limits on events) ----------

    public static final String BIRTH_DATE_RULES =
            "Date of birth must be a real date in the past (not more than 120 years ago).";

    public static boolean isValidBirthDate(LocalDate date) {
        if (date == null) return false;
        LocalDate today = LocalDate.now();
        return date.isBefore(today) && date.isAfter(today.minusYears(120));
    }

    public static boolean isNotBlank(String text) {
        return text != null && !text.trim().isEmpty();
    }
}
