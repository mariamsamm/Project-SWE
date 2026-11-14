package com.eventsapp.organizer.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.List;

/** The JSON the organizer page sends to create or update an event. */
public record EventRequest(
        @NotBlank(message = "event name is required") String name,
        String imagePath,
        @NotNull(message = "start date and time is required") LocalDateTime startDateTime,
        @NotNull(message = "end date and time is required") LocalDateTime endDateTime,
        @NotBlank(message = "about is required")
        @Size(max = 4000, message = "about is too long (max 4000 characters)") String about,
        @NotEmpty(message = "at least one ticket category is required") List<@Valid TicketRequest> tickets,
        @NotNull(message = "venue is required") @Valid VenueRequest venue,
        List<String> facilities) {
}
