package registration.model;
 
import java.util.ArrayList;
import java.util.List;
 
public class formfield {
 
    private final int id;
    private final String label;
    private final fieldtype type;
    private final boolean required;
    private final List<String> options;
 
    public formfield(int id, String label, fieldtype type, boolean required, List<String> options) {
        if (label == null || label.isBlank()) {
            throw new IllegalArgumentException("label is required");
        }
        if (type == fieldtype.dropdown && (options == null || options.isEmpty())) {
            throw new IllegalArgumentException("dropdown needs at least one option");
        }
        this.id = id;
        this.label = label.trim();
        this.type = type;
        this.required = required;
        this.options = options == null ? new ArrayList<>() : new ArrayList<>(options);
    }
 
    public int id() {
        return id;
    }
 
    public String label() {
        return label;
    }
 
    public fieldtype type() {
        return type;
    }
 
    public boolean required() {
        return required;
    }
 
    public List<String> options() {
        return List.copyOf(options);
    }
 
    // returns null when the value is ok, else gives error msg
    public String validatevalue(String value) {
        boolean empty = value == null || value.isBlank();
        if (empty) {
            return required ? label + " is required" : null;
        }
        String trimmed = value.trim();
        switch (type) {
            case number:
                try {
                    Double.parseDouble(trimmed);
                } catch (NumberFormatException e) {
                    return label + " must be a number";
                }
                return null;
            case email:
                if (!trimmed.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
                    return label + " must be a valid email";
                }
                return null;
            case dropdown:
                if (!options.contains(trimmed)) {
                    return label + " must be one of " + options;
                }
                return null;
            case yesno:
                if (!trimmed.equalsIgnoreCase("yes") && !trimmed.equalsIgnoreCase("no")) {
                    return label + " must be yes or no";
                }
                return null;
            default:
                return null;
        }
    }
}
