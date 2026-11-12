package com.eventsapp.organizer.controller;

import com.eventsapp.organizer.dto.EventRequest;
import com.eventsapp.organizer.dto.EventResponse;
import com.eventsapp.organizer.service.EventService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** The organizer page talks to these endpoints. */
@RestController
@RequestMapping("/api/organizers/{organizerId}/events")
public class EventController {

    private final EventService service;

    public EventController(EventService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EventResponse create(@PathVariable Long organizerId, @Valid @RequestBody EventRequest request) {
        return service.create(organizerId, request);
    }

    /** Empty list = the page shows "No events yet" with the Create event button. */
    @GetMapping
    public List<EventResponse> list(@PathVariable Long organizerId) {
        return service.list(organizerId);
    }

    @GetMapping("/{eventId}")
    public EventResponse get(@PathVariable Long organizerId, @PathVariable Long eventId) {
        return service.get(organizerId, eventId);
    }

    @PutMapping("/{eventId}")
    public EventResponse update(@PathVariable Long organizerId, @PathVariable Long eventId,
                                @Valid @RequestBody EventRequest request) {
        return service.update(organizerId, eventId, request);
    }

    @DeleteMapping("/{eventId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long organizerId, @PathVariable Long eventId) {
        service.delete(organizerId, eventId);
    }
}
