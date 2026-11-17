package eventsystem;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;


class registration {

    private final int id;
    private final int eventid;
    private final int participantid;
    private final LocalDateTime registeredat;
    private final List<registrationanswer> answers;
    private registrationstatus status;
    private String rejectionreason;
    private String ticketcode;
    private LocalDateTime decidedat;

    public registration(int id, int eventid, int participantid, List<registrationanswer> answers) {
        this.id = id;
        this.eventid = eventid;
        this.participantid = participantid;
        this.answers = new ArrayList<>(answers);
        this.registeredat = LocalDateTime.now();
        this.status = registrationstatus.pending;
    }

    public int id() {
        return id;
    }

    public int eventid() {
        return eventid;
    }

    public int participantid() {
        return participantid;
    }

    public LocalDateTime registeredat() {
        return registeredat;
    }

    public List<registrationanswer> answers() {
        return Collections.unmodifiableList(answers);
    }

    public registrationstatus status() {
        return status;
    }

    public String rejectionreason() {
        return rejectionreason;
    }

    // the qr code text, only set after the registration is approved 
    public String ticketcode() {
        return ticketcode;
    }

    public void setticketcode(String code) {
        this.ticketcode = code;
    }

    public LocalDateTime decidedat() {
        return decidedat;
    }

    // only a pending registration can be approved
    public void approve() {
        if (status != registrationstatus.pending) {
            throw new IllegalStateException("only pending registrations can be approved, this one is " + status);
        }
        status = registrationstatus.approved;
        decidedat = LocalDateTime.now();
    }

    // only a pending registration can be rejected
    public void reject(String reason) {
        if (status != registrationstatus.pending) {
            throw new IllegalStateException("only pending registrations can be rejected, this one is " + status);
        }
        status = registrationstatus.rejected;
        rejectionreason = reason;
        decidedat = LocalDateTime.now();
    }

    // a participant can cancel while pending or after approval
    public void cancel() {
        if (status != registrationstatus.pending && status != registrationstatus.approved) {
            throw new IllegalStateException("cannot cancel a registration that is " + status);
        }
        status = registrationstatus.cancelled;
        decidedat = LocalDateTime.now();
    }

    // pending and approved registrations still count as "registered"
    public boolean active() {
        return status == registrationstatus.pending || status == registrationstatus.approved;
    }

    @Override
    public String toString() {
        return "registration #" + id + " | event #" + eventid + " | " + status;
    }
}
