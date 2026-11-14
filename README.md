# EventHub – Event Management System

Software Engineering course project. Students discover and book university events,
organizers create and manage events, and admins review events before they are published.

## Project structure

```
Project-SWE/
├── backend/
│   └── database/eventhub_database.sql   MySQL schema + demo data
├── frontend/                            React + Vite website
└── pom.xml                              Spring Boot backend (in progress)
```

## Run the website

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Create the database

Open `backend/database/eventhub_database.sql` in MySQL Workbench and click **Execute all** (⚡).
It creates the `eventhub` database with all tables and demo data.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | layla@eventhub.demo | Admin123! |
| Organizer | samir@eventhub.demo | Organizer123! |
| Participant | mariam@eventhub.demo | Demo1234! |

Logging in as the organizer opens the organizer dashboard (`/?page=organizer`).
Until the Spring Boot API is connected, the website keeps its data in the browser (localStorage).

## Team workflow

- Never commit to `main` directly. Create a branch: `feature/...`, `fix/...` or `chore/...`.
- Open a pull request into `main`, get it reviewed, then merge and delete the branch.
- Write clear commit messages that start with a verb, e.g. `Add rejection reason to review page`.
