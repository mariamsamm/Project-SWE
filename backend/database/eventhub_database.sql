-- =====================================================================
--  EventHub - Event Management System database (MySQL 8)
--  How to use: open this file in MySQL Workbench and click the
--  lightning bolt (Execute all). It creates the database, the tables
--  and some demo data. Running it again starts from a clean copy.
--
--  Demo accounts (passwords are stored as BCrypt hashes, never as text):
--    admin@eventhub.demo      / Admin123!      -> admin dashboard
--    organizer@eventhub.demo  / Organizer123!  -> organizer dashboard
--    sara@eventhub.demo       / Demo1234!      -> participant
-- =====================================================================

DROP DATABASE IF EXISTS eventhub;
CREATE DATABASE eventhub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE eventhub;

-- ---------------------------------------------------------------------
-- 1. users: every person who can log in. The role decides which page
--    opens after login (PARTICIPANT -> homepage, ORGANIZER -> /organizer,
--    ADMIN -> /admin).
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    full_name      VARCHAR(100) NOT NULL,
    email          VARCHAR(150) NOT NULL,
    password_hash  VARCHAR(100) NOT NULL,
    role           VARCHAR(20)  NOT NULL DEFAULT 'PARTICIPANT',
    phone          VARCHAR(20),
    date_of_birth  DATE,
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_email (email),
    CONSTRAINT chk_users_role CHECK (role IN ('PARTICIPANT', 'ORGANIZER', 'ADMIN'))
);

-- ---------------------------------------------------------------------
-- 2. admins: extra details for users whose role is ADMIN.
--    user_id is both the primary key and the link to users.
-- ---------------------------------------------------------------------
CREATE TABLE admins (
    user_id     BIGINT       NOT NULL,
    job_title   VARCHAR(100) NOT NULL DEFAULT 'Events Administrator',
    PRIMARY KEY (user_id),
    CONSTRAINT fk_admins_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 3. organizers: extra details for users whose role is ORGANIZER.
--    An admin approves a person before they can create events.
-- ---------------------------------------------------------------------
CREATE TABLE organizers (
    user_id            BIGINT       NOT NULL,
    organization_name  VARCHAR(150) NOT NULL,
    department         VARCHAR(100),
    bio                VARCHAR(500),
    approved_by        BIGINT,
    approved_at        DATETIME,
    PRIMARY KEY (user_id),
    CONSTRAINT fk_organizers_user     FOREIGN KEY (user_id)     REFERENCES users (id)        ON DELETE CASCADE,
    CONSTRAINT fk_organizers_admin    FOREIGN KEY (approved_by) REFERENCES admins (user_id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------
-- 4. categories: the choices in the "Category" dropdown.
-- ---------------------------------------------------------------------
CREATE TABLE categories (
    id    INT         NOT NULL AUTO_INCREMENT,
    name  VARCHAR(50) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_categories_name (name)
);

-- ---------------------------------------------------------------------
-- 5. events: created by an organizer, reviewed by an admin.
--    Status flow: DRAFT -> PENDING_REVIEW -> PUBLISHED
--                                         -> REJECTED / REVISION_REQUIRED
--    Column names match the teammate's Event.java entity
--    (name, about, image_path, start_date_time, venue_name ...).
-- ---------------------------------------------------------------------
CREATE TABLE events (
    id                     BIGINT        NOT NULL AUTO_INCREMENT,
    organizer_id           BIGINT        NOT NULL,
    category_id            INT,
    name                   VARCHAR(150)  NOT NULL,
    about                  VARCHAR(4000) NOT NULL,
    image_path             VARCHAR(255),
    venue_name             VARCHAR(150)  NOT NULL,
    venue_location         VARCHAR(255)  NOT NULL,
    venue_image_path       VARCHAR(255),
    start_date_time        DATETIME      NOT NULL,
    end_date_time          DATETIME      NOT NULL,
    registration_deadline  DATETIME      NOT NULL,
    capacity               INT           NOT NULL,
    approval_mode          VARCHAR(10)   NOT NULL DEFAULT 'AUTOMATIC',
    status                 VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',
    admin_feedback         VARCHAR(1000),
    submitted_at           DATETIME,
    published_at           DATETIME,
    created_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_events_status (status),
    KEY idx_events_start (start_date_time),
    CONSTRAINT fk_events_organizer FOREIGN KEY (organizer_id) REFERENCES organizers (user_id),
    CONSTRAINT fk_events_category  FOREIGN KEY (category_id)  REFERENCES categories (id) ON DELETE SET NULL,
    CONSTRAINT chk_events_dates    CHECK (end_date_time > start_date_time),
    CONSTRAINT chk_events_deadline CHECK (registration_deadline <= start_date_time),
    CONSTRAINT chk_events_capacity CHECK (capacity > 0),
    CONSTRAINT chk_events_approval CHECK (approval_mode IN ('MANUAL', 'AUTOMATIC')),
    CONSTRAINT chk_events_status   CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'REVISION_REQUIRED',
                                                     'PUBLISHED', 'REJECTED', 'CANCELLED'))
);

-- ---------------------------------------------------------------------
-- 6. event_facilities: list of facilities for an event (Wi-Fi, parking...).
--    Matches @ElementCollection "event_facilities" in Event.java.
-- ---------------------------------------------------------------------
CREATE TABLE event_facilities (
    event_id  BIGINT       NOT NULL,
    facility  VARCHAR(100) NOT NULL,
    PRIMARY KEY (event_id, facility),
    CONSTRAINT fk_facilities_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 7. ticket_categories: ticket types of an event (General, VIP ...).
--    Matches TicketCategory.java.
-- ---------------------------------------------------------------------
CREATE TABLE ticket_categories (
    id        BIGINT         NOT NULL AUTO_INCREMENT,
    event_id  BIGINT         NOT NULL,
    name      VARCHAR(100)   NOT NULL,
    price     DECIMAL(10, 2) NOT NULL DEFAULT 0,
    capacity  INT            NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_ticket_category (event_id, name),
    CONSTRAINT fk_ticket_categories_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
    CONSTRAINT chk_ticket_price    CHECK (price >= 0),
    CONSTRAINT chk_ticket_capacity CHECK (capacity > 0)
);

-- ---------------------------------------------------------------------
-- 8. event_reviews: history of every admin decision on an event.
-- ---------------------------------------------------------------------
CREATE TABLE event_reviews (
    id           BIGINT        NOT NULL AUTO_INCREMENT,
    event_id     BIGINT        NOT NULL,
    admin_id     BIGINT        NOT NULL,
    decision     VARCHAR(20)   NOT NULL,
    feedback     VARCHAR(1000),
    reviewed_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_reviews_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
    CONSTRAINT fk_reviews_admin FOREIGN KEY (admin_id) REFERENCES admins (user_id),
    CONSTRAINT chk_reviews_decision CHECK (decision IN ('APPROVED', 'REJECTED', 'REVISION_REQUESTED')),
    CONSTRAINT chk_reviews_reason   CHECK (decision = 'APPROVED' OR (feedback IS NOT NULL AND feedback <> ''))
);

-- ---------------------------------------------------------------------
-- 9. registrations: the participants of an event. One row = one booking
--    with one ticket code (shown as a QR code and scanned at check-in).
--    Status: PENDING (manual events) -> CONFIRMED or REJECTED; CANCELLED.
-- ---------------------------------------------------------------------
CREATE TABLE registrations (
    id             BIGINT         NOT NULL AUTO_INCREMENT,
    event_id       BIGINT         NOT NULL,
    user_id        BIGINT         NOT NULL,
    status         VARCHAR(20)    NOT NULL DEFAULT 'PENDING',
    ticket_code    VARCHAR(20)    NOT NULL,
    total_amount   DECIMAL(10, 2) NOT NULL DEFAULT 0,
    decided_by     BIGINT,
    decided_at     DATETIME,
    checked_in_at  DATETIME,
    checked_in_by  BIGINT,
    created_at     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_registrations_ticket (ticket_code),
    KEY idx_registrations_event (event_id, status),
    CONSTRAINT fk_registrations_event      FOREIGN KEY (event_id)      REFERENCES events (id) ON DELETE CASCADE,
    CONSTRAINT fk_registrations_user       FOREIGN KEY (user_id)       REFERENCES users (id)  ON DELETE CASCADE,
    CONSTRAINT fk_registrations_decided_by FOREIGN KEY (decided_by)    REFERENCES users (id)  ON DELETE SET NULL,
    CONSTRAINT fk_registrations_checked_by FOREIGN KEY (checked_in_by) REFERENCES users (id)  ON DELETE SET NULL,
    CONSTRAINT chk_registrations_status CHECK (status IN ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED')),
    CONSTRAINT chk_registrations_total  CHECK (total_amount >= 0)
);

-- ---------------------------------------------------------------------
-- 10. registration_items: how many tickets of each type a booking has.
-- ---------------------------------------------------------------------
CREATE TABLE registration_items (
    registration_id     BIGINT         NOT NULL,
    ticket_category_id  BIGINT         NOT NULL,
    quantity            INT            NOT NULL,
    unit_price          DECIMAL(10, 2) NOT NULL,
    PRIMARY KEY (registration_id, ticket_category_id),
    CONSTRAINT fk_items_registration FOREIGN KEY (registration_id)    REFERENCES registrations (id)     ON DELETE CASCADE,
    CONSTRAINT fk_items_category     FOREIGN KEY (ticket_category_id) REFERENCES ticket_categories (id) ON DELETE CASCADE,
    CONSTRAINT chk_items_quantity CHECK (quantity BETWEEN 1 AND 10),
    CONSTRAINT chk_items_price    CHECK (unit_price >= 0)
);

-- ---------------------------------------------------------------------
-- 11. notifications: messages to users ("Your event was approved").
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    user_id     BIGINT       NOT NULL,
    message     VARCHAR(500) NOT NULL,
    is_read     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_notifications_user (user_id, is_read),
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- View: per-event numbers used by the organizer and admin dashboards.
-- ---------------------------------------------------------------------
CREATE VIEW event_stats AS
SELECT
    e.id                AS event_id,
    e.organizer_id,
    e.name,
    e.status,
    e.capacity,
    COALESCE(SUM(CASE WHEN r.status = 'CONFIRMED' THEN i.quantity END), 0) AS confirmed_tickets,
    COUNT(DISTINCT CASE WHEN r.status = 'PENDING'   THEN r.id END)         AS pending_registrations,
    COUNT(DISTINCT CASE WHEN r.checked_in_at IS NOT NULL THEN r.id END)    AS checked_in
FROM events e
LEFT JOIN registrations r      ON r.event_id = e.id
LEFT JOIN registration_items i ON i.registration_id = r.id
GROUP BY e.id, e.organizer_id, e.name, e.status, e.capacity;


-- =====================================================================
--  DEMO DATA
-- =====================================================================

INSERT INTO users (id, full_name, email, password_hash, role, phone, date_of_birth) VALUES
 (1, 'Layla Shaheen',       'Layla@eventhub.demo',     '$2a$10$QumEnjzrX/tA91VnsSt1TemxtEeYf93XTYDDwzU6gv7p3hlc9kW3e', 'ADMIN',       '01000000001', '1990-03-10'),
 (2, 'Mariam Samir',   'samir@eventhub.demo', '$2a$10$5Hmr1w3BOD3e83JrO/L.l.bVxvfCGd4dMRo2dw3XT.HbMDgEemcXe', 'ORGANIZER',   '01000000002', '1995-07-21'),
 (3, 'Mariam Mohamed', 'mariam@eventhub.demo',      '$2a$10$vIZgXs90ruH7imxCluMcQu7E7KoSAIMgKRbS72IEOMricABzU.XHy', 'PARTICIPANT', '01000000003', '2000-05-14'),
 (4, 'Ahmed Khaled',     'Khaled@eventhub.demo',   '$2a$10$vIZgXs90ruH7imxCluMcQu7E7KoSAIMgKRbS72IEOMricABzU.XHy', 'PARTICIPANT', NULL,          '2001-11-02'),
 (5, 'Abdelrahman',        'Abdelrahman@eventhub.demo',      '$2a$10$vIZgXs90ruH7imxCluMcQu7E7KoSAIMgKRbS72IEOMricABzU.XHy', 'PARTICIPANT', NULL,          '2002-01-28');

INSERT INTO admins (user_id, job_title) VALUES
 (1, 'Student Activities Administrator');

INSERT INTO organizers (user_id, organization_name, department, bio, approved_by, approved_at) VALUES
 (2, 'Student Union', 'Student Activities', 'Runs campus celebrations, workshops and tournaments.', 1, '2026-09-01 10:00:00');

INSERT INTO categories (id, name) VALUES
 (1, 'Entertainment'), (2, 'Education'), (3, 'Sports'), (4, 'Technology'),
 (5, 'Career'), (6, 'Music'), (7, 'Culture');

INSERT INTO events (id, organizer_id, category_id, name, about, image_path, venue_name, venue_location,
                    start_date_time, end_date_time, registration_deadline, capacity, approval_mode,
                    status, admin_feedback, submitted_at, published_at) VALUES
 (1, 2, 1, 'Christmas Celebration', 'Enjoy festive activities, workshops, and a movie night.',
     '/images/christmas.jpg', 'University Campus', 'Main campus courtyard',
     '2026-12-23 12:00:00', '2026-12-23 22:00:00', '2026-12-20 23:59:00', 200, 'MANUAL',
     'PUBLISHED', NULL, '2026-10-01 09:00:00', '2026-10-02 11:00:00'),
 (2, 2, 2, 'Web Development Workshop', 'Learn the basics of building websites with React.',
     '/images/workshop.jpg', 'Computer Lab', 'Building B, floor 2',
     '2026-12-05 10:00:00', '2026-12-05 14:00:00', '2026-12-03 23:59:00', 30, 'AUTOMATIC',
     'PUBLISHED', NULL, '2026-10-05 09:00:00', '2026-10-06 12:00:00'),
 (3, 2, 3, 'Sports Tournament', 'Join a day of team competitions and sporting activities.',
     '/images/sports1.jpg', 'University Sports Courts', 'Sports complex',
     '2026-12-10 09:00:00', '2026-12-11 17:00:00', '2026-12-07 23:59:00', 100, 'AUTOMATIC',
     'PUBLISHED', NULL, '2026-10-10 09:00:00', '2026-10-11 10:00:00'),
 (4, 2, 4, 'AI Hackathon', 'A 2-day hackathon to build AI projects in teams.',
     '/images/workshop.jpg', 'Innovation Hub', 'Building C, ground floor',
     '2027-01-15 09:00:00', '2027-01-16 18:00:00', '2027-01-10 23:59:00', 120, 'MANUAL',
     'PENDING_REVIEW', NULL, '2026-11-04 15:00:00', NULL),
 (5, 2, 5, 'Career Fair', 'Meet companies hiring interns and fresh graduates.',
     NULL, 'Main Hall', 'Administration building',
     '2027-02-03 10:00:00', '2027-02-03 16:00:00', '2027-02-01 23:59:00', 300, 'AUTOMATIC',
     'DRAFT', NULL, NULL, NULL),
 (6, 2, 6, 'Spring Music Night', 'Live performances by student bands.',
     '/images/christmas.jpg', 'Open-air Theatre', 'Behind the library',
     '2027-03-20 19:00:00', '2027-03-20 23:00:00', '2027-03-15 23:59:00', 250, 'AUTOMATIC',
     'REJECTED', 'The venue is booked on that date. Please choose another day.', '2026-10-20 09:00:00', NULL);

INSERT INTO event_facilities (event_id, facility) VALUES
 (1, 'Food stalls'), (1, 'Parking'), (2, 'Wi-Fi'), (2, 'Laptops provided'),
 (3, 'Changing rooms'), (3, 'First aid'), (4, 'Wi-Fi'), (4, 'Snacks');

INSERT INTO ticket_categories (id, event_id, name, price, capacity) VALUES
 (1, 1, 'General Admission',  150.00, 160),
 (2, 1, 'VIP',                300.00,  40),
 (3, 2, 'Student Admission',   75.00,  20),
 (4, 2, 'Standard Admission', 120.00,  10),
 (5, 3, 'General Admission',   80.00,  80),
 (6, 3, 'Premium Seating',    160.00,  20),
 (7, 4, 'Team Member',          0.00, 120),
 (8, 5, 'Visitor',              0.00, 300),
 (9, 6, 'General Admission',  100.00, 250);

INSERT INTO event_reviews (event_id, admin_id, decision, feedback, reviewed_at) VALUES
 (1, 1, 'APPROVED', NULL, '2026-10-02 11:00:00'),
 (2, 1, 'APPROVED', NULL, '2026-10-06 12:00:00'),
 (3, 1, 'APPROVED', 'Looks great.', '2026-10-11 10:00:00'),
 (6, 1, 'REJECTED', 'The venue is booked on that date. Please choose another day.', '2026-10-21 14:00:00');

-- Event 1 uses MANUAL approval, so it has a pending and a rejected booking to review.
INSERT INTO registrations (id, event_id, user_id, status, ticket_code, total_amount,
                           decided_by, decided_at, checked_in_at, checked_in_by) VALUES
 (1, 1, 3, 'CONFIRMED', 'EH-3F2A-91C0', 450.00, 2, '2026-11-01 10:00:00', NULL, NULL),
 (2, 1, 4, 'PENDING',   'EH-7B10-44DE', 150.00, NULL, NULL, NULL, NULL),
 (3, 1, 5, 'REJECTED',  'EH-C0FF-EE01', 300.00, 2, '2026-11-02 09:30:00', NULL, NULL),
 (4, 2, 3, 'CONFIRMED', 'EH-1A2B-3C4D',  75.00, NULL, NULL, '2026-12-05 09:50:00', 2),
 (5, 2, 4, 'CONFIRMED', 'EH-5E6F-7A8B', 240.00, NULL, NULL, NULL, NULL),
 (6, 3, 5, 'CONFIRMED', 'EH-9C8D-7E6F', 160.00, NULL, NULL, NULL, NULL);

INSERT INTO registration_items (registration_id, ticket_category_id, quantity, unit_price) VALUES
 (1, 1, 1, 150.00), (1, 2, 1, 300.00),
 (2, 1, 1, 150.00),
 (3, 2, 1, 300.00),
 (4, 3, 1,  75.00),
 (5, 4, 2, 120.00),
 (6, 5, 2,  80.00);

INSERT INTO notifications (user_id, message, is_read) VALUES
 (2, 'Your event "Christmas Celebration" was APPROVED and is now published.', TRUE),
 (2, 'Your event "Spring Music Night" was REJECTED. Reason: The venue is booked on that date.', FALSE),
 (1, 'New event request: "AI Hackathon" is waiting for review.', FALSE),
 (3, 'Your registration for "Christmas Celebration" was confirmed.', FALSE);




-- =====================================================================
--  USEFUL QUERIES (select one and press Ctrl+Enter to try it)
-- =====================================================================

-- Login: find the account for an email; the backend then checks the
-- password against password_hash with BCrypt and opens the page by role.
-- SELECT id, full_name, role, password_hash FROM users WHERE email = 'organizer@eventhub.demo' AND is_active = TRUE;

-- Organizer dashboard: my events with their numbers.
-- SELECT * FROM event_stats WHERE organizer_id = 2;

-- Admin dashboard: events waiting for review.
-- SELECT id, name, submitted_at FROM events WHERE status = 'PENDING_REVIEW' ORDER BY submitted_at;

-- Manage event: participants of event 1.
-- SELECT r.id, u.full_name, u.email, r.status, r.ticket_code
-- FROM registrations r JOIN users u ON u.id = r.user_id WHERE r.event_id = 1;

-- Check-in: look up a scanned ticket code.
-- SELECT id, event_id, status, checked_in_at FROM registrations WHERE ticket_code = 'EH-3F2A-91C0';
