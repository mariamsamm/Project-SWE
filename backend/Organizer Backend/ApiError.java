package com.eventsapp.organizer.exception;

import java.util.List;

/** Every error is returned in this same JSON shape, so the frontend can show it easily. */
public record ApiError(int status, String message, List<String> details) {
}
