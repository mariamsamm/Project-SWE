package eventsystem;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

//console screens for the registration system.member 5 calls participantmenu() from the participant homepage,member 4 calls organizermenu() from the organizer menu.

class registrationmenu {

    private final Console console;
    private final registrationservice service;

    public registrationmenu(Console console, registrationservice service) {
        this.console = console;
        this.service = service;
    }

    //  participant

    public void participantmenu(Participant participant) {
        while (true) {
            System.out.println("\n===== MY REGISTRATIONS (" + participant.getUsername() + ") =====");
            System.out.println("1. register for an event");
            System.out.println("2. my registrations and tickets");
            System.out.println("3. cancel a registration");
            System.out.println("0. back");

            switch (console.readLine("Choose: ")) {
                case "1": registerflow(participant); break;
                case "2": showmine(participant); break;
                case "3": cancelflow(participant); break;
                case "0": return;
                default: System.out.println("Invalid choice.");
            }
        }
    }

    private void registerflow(Participant participant) {
        Event event = console.readEvent("Event name to register for", service.publishedevents());
        if (event == null) return;

        registrationform form = service.getform(event.getEventId());
        Map<Integer, String> answers = new HashMap<>();
        if (form != null && !form.fields().isEmpty()) {
            System.out.println("\nRegistration form for \"" + event.getTitle() + "\":");
            for (formfield field : form.fields()) {
                answers.put(field.id(), console.readLine(prompttext(field)));
            }
        }

        try {
            registration reg = service.register(participant, event.getEventId(), answers);
            if (reg.status() == registrationstatus.approved) {
                System.out.println("Registration approved. Your ticket code: " + reg.ticketcode());
            } else {
                System.out.println("Registration #" + reg.id() + " sent. Status: " + reg.status()
                        + ". The organizer will review it.");
            }
        } catch (RuntimeException e) {
            System.out.println("Could not register:\n" + e.getMessage());
        }
    }

    private String prompttext(formfield field) {
        String hint = "";
        if (field.type() == fieldtype.dropdown) hint = " " + field.options();
        else if (field.type() == fieldtype.yesno) hint = " (yes/no)";
        else if (field.type() == fieldtype.number) hint = " (number)";
        return field.label() + hint + (field.required() ? " *" : " (optional)") + ": ";
    }

    private void showmine(Participant participant) {
        List<registration> mine = service.myregistrations(participant);
        System.out.println();
        if (mine.isEmpty()) {
            System.out.println("You have no registrations.");
            return;
        }
        for (registration reg : mine) {
            System.out.println(describe(reg, false));
        }
    }

    private void cancelflow(Participant participant) {
        showmine(participant);
        int id = console.readInt("Registration number to cancel (0 to go back): ");
        if (id == 0) return;
        try {
            service.cancel(participant, id);
            System.out.println("Registration cancelled.");
        } catch (RuntimeException e) {
            System.out.println("Error: " + e.getMessage());
        }
    }

    // organizer 

    public void organizermenu(EventOrganizer organizer) {
        while (true) {
            System.out.println("\n===== REGISTRATIONS (" + organizer.getUsername() + ") =====");
            System.out.println("1. add a field to an event's registration form");
            System.out.println("2. remove a field from a form");
            System.out.println("3. view an event's form");
            System.out.println("4. view registration requests for an event");
            System.out.println("5. approve a registration");
            System.out.println("6. reject a registration");
            System.out.println("7. automatic approval on/off for an event");
            System.out.println("0. back");

            switch (console.readLine("Choose: ")) {
                case "1": addfieldflow(organizer); break;
                case "2": removefieldflow(organizer); break;
                case "3": viewformflow(organizer); break;
                case "4": viewrequestsflow(organizer); break;
                case "5": approveflow(organizer); break;
                case "6": rejectflow(organizer); break;
                case "7": autoflow(organizer); break;
                case "0": return;
                default: System.out.println("Invalid choice.");
            }
        }
    }

    private Event pickevent(EventOrganizer organizer) {
        return console.readEvent("Event name", service.eventsof(organizer));
    }

    private void addfieldflow(EventOrganizer organizer) {
        Event event = pickevent(organizer);
        if (event == null) return;

        String label = console.readLine("Question (for example: full name): ");
        System.out.println("Type: 1) text  2) number  3) email  4) dropdown  5) yes/no");
        fieldtype type;
        switch (console.readLine("Choose type: ")) {
            case "1": type = fieldtype.text; break;
            case "2": type = fieldtype.number; break;
            case "3": type = fieldtype.email; break;
            case "4": type = fieldtype.dropdown; break;
            case "5": type = fieldtype.yesno; break;
            default:
                System.out.println("Invalid type.");
                return;
        }
        List<String> options = new ArrayList<>();
        if (type == fieldtype.dropdown) {
            for (String part : console.readLine("Options separated by commas (for example: S,M,L): ").split(",")) {
                if (!part.isBlank()) options.add(part.trim());
            }
        }
        boolean required = console.readLine("Required? 1) yes  2) no: ").equals("1");

        try {
            formfield field = service.addfield(organizer, event.getEventId(), label, type, required, options);
            System.out.println("Added: " + field);
        } catch (RuntimeException e) {
            System.out.println("Error: " + e.getMessage());
        }
    }

    private void removefieldflow(EventOrganizer organizer) {
        Event event = pickevent(organizer);
        if (event == null) return;
        if (!printform(event)) return;

        int fieldid = console.readInt("Field number to remove (0 to go back): ");
        if (fieldid == 0) return;
        try {
            service.removefield(organizer, event.getEventId(), fieldid);
            System.out.println("Field removed.");
        } catch (RuntimeException e) {
            System.out.println("Error: " + e.getMessage());
        }
    }

    private void viewformflow(EventOrganizer organizer) {
        Event event = pickevent(organizer);
        if (event == null) return;
        printform(event);
    }

    private boolean printform(Event event) {
        registrationform form = service.getform(event.getEventId());
        System.out.println();
        if (form == null || form.fields().isEmpty()) {
            System.out.println("This event has no registration form yet.");
            return false;
        }
        System.out.println("Form for \"" + event.getTitle() + "\":");
        for (formfield field : form.fields()) System.out.println("  " + field);
        return true;
    }

    private void viewrequestsflow(EventOrganizer organizer) {
        Event event = pickevent(organizer);
        if (event == null) return;
        try {
            List<registration> list = service.registrationsforevent(organizer, event.getEventId());
            System.out.println("\nSeats: " + service.approvedcount(event.getEventId()) + " approved of "
                    + event.getCapacity() + " (" + service.seatsleft(event.getEventId()) + " left)");
            if (list.isEmpty()) {
                System.out.println("No registrations yet.");
                return;
            }
            for (registration reg : list) {
                System.out.println(describe(reg, true));
            }
        } catch (RuntimeException e) {
            System.out.println("Error: " + e.getMessage());
        }
    }

    private void approveflow(EventOrganizer organizer) {
        int id = console.readInt("Registration number to approve (0 to go back): ");
        if (id == 0) return;
        try {
            service.approve(organizer, id);
            System.out.println("Approved. The participant was notified and got a ticket.");
        } catch (RuntimeException e) {
            System.out.println("Error: " + e.getMessage());
        }
    }

    private void rejectflow(EventOrganizer organizer) {
        int id = console.readInt("Registration number to reject (0 to go back): ");
        if (id == 0) return;
        String reason = console.readLine("Reason: ");
        try {
            service.reject(organizer, id, reason);
            System.out.println("Rejected. The participant was notified.");
        } catch (RuntimeException e) {
            System.out.println("Error: " + e.getMessage());
        }
    }

    private void autoflow(EventOrganizer organizer) {
        Event event = pickevent(organizer);
        if (event == null) return;
        System.out.println("Automatic approval is " + (service.isautoapprove(event.getEventId()) ? "ON" : "OFF")
                + " for \"" + event.getTitle() + "\".");
        String choice = console.readLine("1) turn on  2) turn off  0) back: ");
        if (!choice.equals("1") && !choice.equals("2")) return;
        try {
            service.setautoapprove(organizer, event.getEventId(), choice.equals("1"));
            System.out.println("Saved.");
        } catch (RuntimeException e) {
            System.out.println("Error: " + e.getMessage());
        }
    }

    //  printing

    
    private String describe(registration reg, boolean fororganizer) {
        StringBuilder text = new StringBuilder();
        text.append("#").append(reg.id());
        if (fororganizer) {
            text.append(" | ").append(service.participantname(reg.participantid()));
        } else {
            text.append(" | event #").append(reg.eventid());
        }
        text.append(" | ").append(reg.status());
        if (reg.status() == registrationstatus.approved && reg.ticketcode() != null) {
            text.append(" | ticket: ").append(reg.ticketcode());
        }
        if (reg.status() == registrationstatus.rejected && reg.rejectionreason() != null) {
            text.append(" | reason: ").append(reg.rejectionreason());
        }
        if (fororganizer) {
            registrationform form = service.getform(reg.eventid());
            for (registrationanswer answer : reg.answers()) {
                formfield field = form == null ? null : form.findfield(answer.fieldid());
                String label = field == null ? "field " + answer.fieldid() : field.label();
                text.append("\n      ").append(label).append(": ").append(answer.value());
            }
        }
        return text.toString();
    }
}
