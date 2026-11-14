package com.eventsapp.organizer.dto;

import com.eventsapp.organizer.model.Event;
import com.eventsapp.organizer.model.Venue;

import java.util.ArrayList;
import java.util.List;

/** Converts a database Event into the JSON response. */
public final class EventMapper {

    private EventMapper() {
    }

    public static EventResponse toResponse(Event event) {
        List<TicketResponse> tickets = event.getTickets().stream()
                .map(t -> new TicketResponse(t.getId(), t.getName(), t.getPrice(), t.getCapacity()))
                .toList();

        Venue venue = event.getVenue();
        VenueResponse venueResponse = new VenueResponse(venue.getName(), venue.getLocation(), venue.getImagePath());

        int totalCapacity = tickets.stream().mapToInt(TicketResponse::capacity).sum();

        return new EventResponse(
                event.getId(),
                event.getOrganizerId(),
                event.getName(),
                event.getImagePath(),
                event.getStartDateTime(),
                event.getEndDateTime(),
                event.getAbout(),
                tickets,
                venueResponse,
                new ArrayList<>(event.getFacilities()),
                totalCapacity);
    }
}
