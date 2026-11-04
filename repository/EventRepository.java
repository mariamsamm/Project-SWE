package com.eventsapp.organizer.repository;

import com.eventsapp.organizer.model.Event;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EventRepository extends JpaRepository<Event, Long> {

    List<Event> findByOrganizerIdOrderByStartDateTimeAsc(Long organizerId);

    Optional<Event> findByIdAndOrganizerId(Long id, Long organizerId);
}
