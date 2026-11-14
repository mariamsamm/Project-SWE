package com.eventsapp.organizer.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record   TicketRequest(
        @NotBlank(message = "ticket name is required") String name,
        @NotNull(message = "ticket price is required")
        @DecimalMin(value = "0.0", message = "ticket price cannot be negative") BigDecimal price,
        @NotNull(message = "ticket capacity is required")
        @Min(value = 1, message = "ticket capacity must be at least 1") Integer capacity) {
}
