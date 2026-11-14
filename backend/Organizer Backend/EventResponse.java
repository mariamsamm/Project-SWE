package com.eventsapp.organizer.dto;

import java.time.LocalDateTime;
import java.util.List;

public record EventResponse(
        Long id,
        Long organizerId,
        String name,
        String imagePath,
        LocalDateTime startDateTime,
        LocalDateTime endDateTime,
        String about,
        List<TicketResponse> tickets,
        VenueResponse venue,
        List<String> facilities,
        int totalCapacity) {
}
