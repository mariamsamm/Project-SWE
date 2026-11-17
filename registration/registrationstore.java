package eventsystem;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

// in-memory storage for the registration system (same idea as DataStore) 
class registrationstore {

    private final List<registrationform> forms = new ArrayList<>();
    private final List<registration> registrations = new ArrayList<>();
    private final Set<Integer> autoapproveevents = new HashSet<>();

    private int formseq = 1;
    private int fieldseq = 1;
    private int registrationseq = 1;
    private int answerseq = 1;

    public int nextformid() { return formseq++; }
    public int nextfieldid() { return fieldseq++; }
    public int nextregistrationid() { return registrationseq++; }
    public int nextanswerid() { return answerseq++; }

    public List<registrationform> forms() { return forms; }
    public List<registration> registrations() { return registrations; }

    public registrationform findformbyevent(int eventid) {
        for (registrationform f : forms) {
            if (f.eventid() == eventid) return f;
        }
        return null;
    }

    public registration findregistration(int id) {
        for (registration r : registrations) {
            if (r.id() == id) return r;
        }
        return null;
    }

    public List<registration> findbyevent(int eventid) {
        List<registration> result = new ArrayList<>();
        for (registration r : registrations) {
            if (r.eventid() == eventid) result.add(r);
        }
        return result;
    }

    public List<registration> findbyparticipant(int participantid) {
        List<registration> result = new ArrayList<>();
        for (registration r : registrations) {
            if (r.participantid() == participantid) result.add(r);
        }
        return result;
    }

    // the pending or approved registration of this participant for this event, or null
    public registration findactive(int participantid, int eventid) {
        for (registration r : registrations) {
            if (r.participantid() == participantid && r.eventid() == eventid && r.active()) return r;
        }
        return null;
    }

    public int countapproved(int eventid) {
        int count = 0;
        for (registration r : registrations) {
            if (r.eventid() == eventid && r.status() == registrationstatus.approved) count++;
        }
        return count;
    }

    public boolean isautoapprove(int eventid) {
        return autoapproveevents.contains(eventid);
    }

    public void setautoapprove(int eventid, boolean on) {
        if (on) autoapproveevents.add(eventid);
        else autoapproveevents.remove(eventid);
    }
}
