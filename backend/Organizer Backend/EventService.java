package com.eventsapp.organizer.service;

import com.eventsapp.organizer.dto.EventMapper;
import com.eventsapp.organizer.dto.EventRequest;
import com.eventsapp.organizer.dto.EventResponse;
import com.eventsapp.organizer.dto.TicketRequest;
import com.eventsapp.organizer.exception.BadRequestException;
import com.eventsapp.organizer.exception.ResourceNotFoundException;
import com.eventsapp.organizer.model.Event;
import com.eventsapp.organizer.model.TicketCategory;
import com.eventsapp.organizer.model.Venue;
import com.eventsapp.organizer.repository.EventRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** All the organizer's event logic lives here. */
@Service
public class EventService {

    private final EventRepository repository;

    public EventService(EventRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public EventResponse create(Long organizerId, EventRequest request) {
        if (request.startDateTime().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("The event cannot start in the past.");
        }
        Event event = new Event();
        event.setOrganizerId(organizerId);
        apply(event, request);
        return EventMapper.toResponse(repository.save(event));
    }

    @Transactional(readOnly = true)
    public List<EventResponse> list(Long organizerId) {
        return repository.findByOrganizerIdOrderByStartDateTimeAsc(organizerId).stream()
                .map(EventMapper::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public EventResponse get(Long organizerId, Long eventId) {
        return EventMapper.toResponse(find(organizerId, eventId));
    }

    @Transactional
    public EventResponse update(Long organizerId, Long eventId, EventRequest request) {
        Event event = find(organizerId, eventId);
        apply(event, request);
        return EventMapper.toResponse(repository.save(event));
    }

    @Transactional
    public void delete(Long organizerId, Long eventId) {
        repository.delete(find(organizerId, eventId));
    }

    // ---------- helpers ----------

    /** An organizer can only see and change his own events. */
    private Event find(Long organizerId, Long eventId) {
        return repository.findByIdAndOrganizerId(eventId, organizerId)
                .orElseThrow(() -> new ResourceNotFoundException("Event " + eventId + " was not found."));
    }

    /** Checks the business rules and copies the request data into the event. */
    private void apply(Event event, EventRequest request) {
        if (!request.endDateTime().isAfter(request.startDateTime())) {
            throw new BadRequestException("The event must end after it starts.");
        }

        Set<String> seenNames = new HashSet<>();
        for (TicketRequest ticket : request.tickets()) {
            if (!seenNames.add(ticket.name().trim().toLowerCase())) {
                throw new BadRequestException("Ticket category \"" + ticket.name().trim() + "\" is used more than once.");
            }
        }

        event.setName(request.name().trim());
        event.setImagePath(request.imagePath());
        event.setStartDateTime(request.startDateTime());
        event.setEndDateTime(request.endDateTime());
        event.setAbout(request.about().trim());
        event.setVenue(new Venue(
                request.venue().name().trim(),
                request.venue().location().trim(),
                request.venue().imagePath()));

        event.getTickets().clear();
        for (TicketRequest t : request.tickets()) {
            TicketCategory category = new TicketCategory(t.name().trim(), t.price(), t.capacity());
            category.setEvent(event);
            event.getTickets().add(category);
        }

        event.getFacilities().clear();
        if (request.facilities() != null) {
            for (String facility : request.facilities()) {
                if (facility != null && !facility.isBlank()) {
                    event.getFacilities().add(facility.trim());
                }
            }
        }
    }
}
