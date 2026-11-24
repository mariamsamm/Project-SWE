package eventsystem;


class registrationanswer {

    private final int id;
    private final int fieldid;
    private String value;

    public registrationanswer(int id, int fieldid, String value) {
        this.id = id;
        this.fieldid = fieldid;
        this.value = value;
    }

    public int id() {
        return id;
    }

    public int fieldid() {
        return fieldid;
    }

    public String value() {
        return value;
    }

    public void updateanswer(String newvalue) {
        this.value = newvalue;
    }
}
