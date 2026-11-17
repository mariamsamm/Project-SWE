package eventsystem;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

// the custom form an organizer builds for one event 
class registrationform {

    private final int id;
    private final int eventid;
    private final List<formfield> fields = new ArrayList<>();

    public registrationform(int id, int eventid) {
        this.id = id;
        this.eventid = eventid;
    }

    public int id() {
        return id;
    }

    public int eventid() {
        return eventid;
    }

    public List<formfield> fields() {
        return Collections.unmodifiableList(fields);
    }

    public formfield findfield(int fieldid) {
        for (formfield f : fields) {
            if (f.id() == fieldid) return f;
        }
        return null;
    }

    public void addfield(formfield field) {
        if (findfield(field.id()) != null) {
            throw new IllegalArgumentException("field id already used: " + field.id());
        }
        fields.add(field);
    }

    public boolean removefield(int fieldid) {
        return fields.removeIf(f -> f.id() == fieldid);
    }

    // answers: field id -> value. returns a list of errors, empty when everything is valid
    public List<String> validateanswers(Map<Integer, String> answers) {
        List<String> errors = new ArrayList<>();
        for (formfield field : fields) {
            String error = field.validatevalue(answers.get(field.id()));
            if (error != null) {
                errors.add(error);
            }
        }
        for (Integer fieldid : answers.keySet()) {
            if (findfield(fieldid) == null) {
                errors.add("unknown field id: " + fieldid);
            }
        }
        return errors;
    }
}
