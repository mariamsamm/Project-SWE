package eventsystem;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

class registrationservice {

    private final DataStore store;
    private final registrationstore regs;
    private final NotificationService notifications;
    private final ticketgenerator tickets;

    public registrationservice(DataStore store, registrationstore regs,NotificationService notifications, ticketgenerator tickets) {
        this.store = store;
        this.regs = regs;
        this.notifications = notifications;
        this.tickets = tickets;
    }

    //lists for the menus 

    // published events that have not happened yet 
    public List<Event> publishedevents() {
        List<Event> result = new ArrayList<>();
        for (Event e : store.getEvents()) {
            if (e.getStatus() == EventStatus.PUBLISHED && !e.getEventDate().isBefore(LocalDate.now())) {
                result.add(e);
            }
        }
        return result;
    }

    public List<Event> eventsof(EventOrganizer organizer) {
        List<Event> result = new ArrayList<>();
        for (Event e : store.getEvents()) {
            if (e.getOrganizerId() == organizer.getUserId()) result.add(e);
        }
        return result;
    }

    public String participantname(int participantid) {
        User user = store.findUserById(participantid);
        return user == null ? "unknown user" : user.getUsername();
    }

    public int approvedcount(int eventid) {
        return regs.countapproved(eventid);
    }

    public int seatsleft(int eventid) {
        Event event = store.findEventById(eventid);
        if (event == null) return 0;
        return Math.max(0, event.getCapacity() - regs.countapproved(eventid));
    }

    // the organizer's form 

    // null when the organizer did not build a form for this event 
    public registrationform getform(int eventid) {
        return regs.findformbyevent(eventid);
    }

    public formfield addfield(EventOrganizer organizer, int eventid, String label, fieldtype type, boolean required, List<String> options) {
        ownedevent(organizer, eventid);
        requireformunlocked(eventid);

        registrationform form = regs.findformbyevent(eventid);
        if (form == null) {
            form = new registrationform(regs.nextformid(), eventid);
            regs.forms().add(form);
        }
        formfield field = new formfield(regs.nextfieldid(), label, type, required, options);
        form.addfield(field);
        return field;
    }

    public void removefield(EventOrganizer organizer, int eventid, int fieldid) {
        ownedevent(organizer, eventid);
        requireformunlocked(eventid);

        registrationform form = regs.findformbyevent(eventid);
        if (form == null || !form.removefield(fieldid)) {
            throw new IllegalArgumentException("field not found.");
        }
    }

    public boolean isautoapprove(int eventid) {
        return regs.isautoapprove(eventid);
    }

    public void setautoapprove(EventOrganizer organizer, int eventid, boolean on) {
        ownedevent(organizer, eventid);
        regs.setautoapprove(eventid, on);
    }

    //  participant 

    
    public registration register(Participant participant, int eventid, Map<Integer, String> answers) {
        Event event = store.findEventById(eventid);
        if (event == null) {
            throw new IllegalArgumentException("event not found.");
        }
        if (event.getStatus() != EventStatus.PUBLISHED) {
            throw new IllegalStateException("this event is not open for registration.");
        }
        if (event.getEventDate().isBefore(LocalDate.now())) {
            throw new IllegalStateException("this event already took place.");
        }
        if (regs.findactive(participant.getUserId(), eventid) != null) {
            throw new IllegalStateException("you already have a registration for this event.");
        }
        if (regs.countapproved(eventid) >= event.getCapacity()) {
            throw new IllegalStateException("this event is full.");
        }

        registrationform form = regs.findformbyevent(eventid);
        List<registrationanswer> saved = new ArrayList<>();
        if (form != null) {
            List<String> errors = form.validateanswers(answers);
            if (!errors.isEmpty()) {
                throw new IllegalArgumentException(String.join("\n", errors));
            }
            for (formfield field : form.fields()) {
                String value = answers.get(field.id());
                if (value != null && !value.isBlank()) {
                    saved.add(new registrationanswer(regs.nextanswerid(), field.id(), value.trim()));
                }
            }
        }

        registration reg = new registration(regs.nextregistrationid(), eventid, participant.getUserId(), saved);
        regs.registrations().add(reg);

        notifications.send(event.getOrganizerId(), "new registration #" + reg.id() + " from "
                + participant.getUsername() + " for \"" + event.getTitle() + "\".");

        if (regs.isautoapprove(eventid)) {
            finishapproval(reg, event);
        }
        return reg;
    }

    public List<registration> myregistrations(Participant participant) {
        return regs.findbyparticipant(participant.getUserId());
    }

    public void cancel(Participant participant, int registrationid) {
        registration reg = regs.findregistration(registrationid);
        if (reg == null || reg.participantid() != participant.getUserId()) {
            throw new IllegalArgumentException("registration not found.");
        }
        reg.cancel();
        if (reg.ticketcode() != null) {
            tickets.invalidateticket(reg.ticketcode());
        }
        Event event = store.findEventById(reg.eventid());
        if (event != null) {
            notifications.send(event.getOrganizerId(), participant.getUsername()
                    + " cancelled registration #" + reg.id() + " for \"" + event.getTitle() + "\".");
        }
    }

    //  organizer 

    public List<registration> registrationsforevent(EventOrganizer organizer, int eventid) {
        ownedevent(organizer, eventid);
        return regs.findbyevent(eventid);
    }

    public void approve(EventOrganizer organizer, int registrationid) {
        registration reg = ownedregistration(organizer, registrationid);
        Event event = store.findEventById(reg.eventid());
        if (reg.status() != registrationstatus.pending) {
            throw new IllegalStateException("only pending registrations can be approved, this one is "
                    + reg.status());
        }
        if (regs.countapproved(reg.eventid()) >= event.getCapacity()) {
            throw new IllegalStateException("cannot approve: the event is full.");
        }
        finishapproval(reg, event);
    }

    public void reject(EventOrganizer organizer, int registrationid, String reason) {
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("a rejection reason is required.");
        }
        registration reg = ownedregistration(organizer, registrationid);
        Event event = store.findEventById(reg.eventid());
        reg.reject(reason.trim());
        notifications.send(reg.participantid(), "your registration for \"" + event.getTitle()
                + "\" was REJECTED. reason: " + reason.trim());
    }

    //  helpers 

    // makes the ticket, saves the approval and tells the participant 
    private void finishapproval(registration reg, Event event) {
        String code = tickets.createticket(reg);
        reg.approve();
        reg.setticketcode(code);
        notifications.send(reg.participantid(), "your registration for \"" + event.getTitle()
                + "\" was APPROVED. your ticket code: " + code);
    }

    // the event must exist and belong to this organizer 
    private Event ownedevent(EventOrganizer organizer, int eventid) {
        Event event = store.findEventById(eventid);
        if (event == null || event.getOrganizerId() != organizer.getUserId()) {
            throw new IllegalArgumentException("event not found.");
        }
        return event;
    }

    private registration ownedregistration(EventOrganizer organizer, int registrationid) {
        registration reg = regs.findregistration(registrationid);
        if (reg == null) {
            throw new IllegalArgumentException("registration not found.");
        }
        ownedevent(organizer, reg.eventid());
        return reg;
    }

    // the form cannot change once someone registered, old answers would not match it 
    private void requireformunlocked(int eventid) {
        if (!regs.findbyevent(eventid).isEmpty()) {
            throw new IllegalStateException("the form cannot be changed after the first registration.");
        }
    }
}
