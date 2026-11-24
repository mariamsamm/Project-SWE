# EventHub backend (the final merged backend)

One Spring Boot 3.2.5 / Java 17 application with one `pom.xml` and one `main()` (`EventHubApplication`).
It reads and writes the MySQL database `eventhub` (the tables are made by `database/eventhub_database.sql`;
Hibernate never changes them: `ddl-auto=none`).

## Run it
1. Open `database/eventhub_database.sql` in MySQL Workbench and click **Execute all** (it also adds demo data; running it again resets the data).
2. In `src/main/resources/application.properties` put your MySQL user and password (or set the `DB_USERNAME` / `DB_PASSWORD` environment variables).
3. Run `EventHubApplication` in IntelliJ (or `mvn spring-boot:run`). The API is on `http://localhost:8080`.
4. Open `requests.http` and try the requests.

## Demo accounts
| Role | id | Email | Password |
|---|---|---|---|
| Admin | 1 | layla@eventhub.demo | `Admin123!` |
| Organizer | 2 | samir@eventhub.demo | `Organizer123!` |
| Participant | 3, 4, 5 | mariam@ / khaled@ / abdelrahman@eventhub.demo | `Demo1234!` |

## How the frontend works
1. `POST /api/auth/login` returns `{ id, role, ... }`. Keep `id` and `role` and open the page of that role.
2. Every other call puts that `id` in the URL: `/api/admin/{adminId}/...`, `/api/organizers/{organizerId}/...`, `/api/participants/{participantId}/...`.
   The backend checks that the user exists, is active and has the right role.
3. Event life cycle: `DRAFT -> (organizer submits) PENDING_REVIEW -> (admin) PUBLISHED | REJECTED | REVISION_REQUIRED`.
4. Registration life cycle: a participant picks ticket types and quantities and gets a ticket code.
   `AUTOMATIC` events: `CONFIRMED` at once. `MANUAL` events: `PENDING` until the organizer confirms or rejects. The participant can `CANCELLED`.
   At the door the organizer scans the ticket code (check-in).

## Packages (`com.eventsapp`)
| Package | Owner | What is inside |
|---|---|---|
| `organizer` | Member 1 | events, venue, ticket types, categories, picture upload, homepage list |
| `user` | Member 3 | users, admins, organizers, sign up, login |
| `admin` | Member 3 | review (approve / reject / request changes), users, organizers, reports |
| `notification` | Member 3 | notifications |
| `registration` | Member 2 | bookings, ticket codes, approval, cancel, check-in, organizer stats |
| `config`, `common` | shared | CORS and uploads, BCrypt, exceptions, validators |

Each package has `model`, `repository`, `service`, `controller` and `dto`.

## Notes
- Events: the capacity is the sum of the ticket type capacities (the backend keeps `events.capacity` in sync).
  Pending and confirmed bookings both reserve tickets.
- The ids in the URLs are trusted (there are no login tokens yet). Add tokens / Spring Security if the course needs real security.
- `WebConfig` allows every origin for development. Restrict it to your frontend address before going live.
