package com.eventsapp.organizer.controller;

import com.eventsapp.organizer.service.FileStorageService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/**
 * Upload a picture first, then send the returned path as imagePath when creating the event.
 * This is used for both the event picture and the venue picture.
 */
@RestController
@RequestMapping("/api/images")
public class ImageController {

    private final FileStorageService storage;

    public ImageController(FileStorageService storage) {
        this.storage = storage;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, String> upload(@RequestParam("file") MultipartFile file) {
        return Map.of("path", storage.store(file));
    }
}
