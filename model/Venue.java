package com.eventsapp.organizer.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/** Stored inside the events table (columns venue_name, venue_location, venue_image_path). */
@Embeddable
public class Venue {

    @Column(name = "venue_name", nullable = false)
    private String name;

    @Column(name = "venue_location", nullable = false)
    private String location;

    @Column(name = "venue_image_path")
    private String imagePath;

    public Venue() {
    }

    public Venue(String name, String location, String imagePath) {
        this.name = name;
        this.location = location;
        this.imagePath = imagePath;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public String getImagePath() { return imagePath; }
    public void setImagePath(String imagePath) { this.imagePath = imagePath; }
}
