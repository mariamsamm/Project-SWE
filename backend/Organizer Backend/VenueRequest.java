package com.eventsapp.organizer.dto;

import jakarta.validation.constraints.NotBlank;

public record VenueRequest(
        @NotBlank(message = "venue name is required") String name,
        @NotBlank(message = "venue location is required") String location,
        String imagePath) {
}
