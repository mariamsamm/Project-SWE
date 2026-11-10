package com.eventsapp.organizer.dto;

import java.math.BigDecimal;

public record TicketResponse(Long id, String name, BigDecimal price, int capacity) {
}
