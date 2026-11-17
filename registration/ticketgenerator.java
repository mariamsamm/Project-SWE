package eventsystem;

import java.util.UUID;


// what the registration system needs from the ticket part (ahmed khaled) writes a real class that implements this and it replaces the placeholder below.

interface ticketgenerator {

    // makes a unique qr text for an approved registration and returns it 
    String createticket(registration reg);

    // makes the qr text invalid (used when a registration is cancelled) 
    void invalidateticket(String code);
}

// PLACEHOLDER: ahmed khaled owns the real tickets and the check-in
class placeholderticketgenerator implements ticketgenerator {

    @Override
    public String createticket(registration reg) {
        return "tkt-" + reg.eventid() + "-" + reg.id() + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    @Override
    public void invalidateticket(String code) {
        // nothing to do until ahmed khaled has a real ticket list
    }
}
