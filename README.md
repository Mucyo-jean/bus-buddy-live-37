# Bus Buddy

Build a complete web-based software engineering project called:

"Intelligent GPS-Based Bus Stop Announcement and Context-Aware Passenger Information System"

The system is designed for public bus transportation. Its main purpose is to use GPS location data from a smartphone used by the bus driver to track the bus, determine its current and upcoming bus stops, and provide passengers with timely information and announcements.

IMPORTANT SYSTEM CONCEPT:

Do NOT assume that GPS hardware is physically installed in the bus.

A smartphone carried/used by the driver acts as the GPS device. The driver's smartphone obtains its GPS coordinates using its built-in location service and sends the coordinates through the internet to the Node.js backend. The backend processes and stores the latest bus location. The passenger application retrieves the latest location from the backend and displays the bus on a map.

TECHNOLOGY STACK:

Frontend:

- React.js

- React Router

- JavaScript or TypeScript

- Tailwind CSS

- Responsive design

- Map integration using Leaflet and OpenStreetMap, avoiding paid map services where possible

Backend:

- Node.js

- Express.js

- REST API

- Socket.IO for real-time bus location updates

- JWT authentication

Database:

- PostgreSQL

- Use a clear relational database structure

GPS:

- Browser/device Geolocation API for the driver's smartphone

- GPS coordinates represented as latitude and longitude

- The system must periodically send the driver's current coordinates to the backend

VOICE:

- Use the browser Web Speech API / SpeechSynthesis API for bus-stop voice announcements

- Example:

  "Next stop: Remera."

  "You have arrived at Remera."

USER ROLES:

1. ADMINISTRATOR

2. DRIVER

3. PASSENGER

==================================================

ADMINISTRATOR FEATURES

==================================================

Create an administrator dashboard where the administrator can:

- Log in securely

- View dashboard statistics

- Add, edit and delete buses

- Add, edit and delete routes

- Add, edit and delete bus stops

- Assign buses to routes

- Manage driver accounts

- View active trips

- View buses currently being tracked

- View bus locations on a map

- View trip history

- Manage system announcements

- View system activity

Dashboard statistics should include:

- Total buses

- Active buses

- Total routes

- Total bus stops

- Active trips

- Registered passengers

- Registered drivers

==================================================

DRIVER FEATURES

==================================================

Create a dedicated driver dashboard.

The driver should be able to:

- Log in

- View assigned buses

- Select a bus

- Select an assigned route

- Start a trip

- Stop/end a trip

- Allow the application to access the smartphone's GPS

- Send GPS coordinates to the backend periodically

- View current GPS coordinates

- View current route

- View current bus stop

- View next bus stop

- View distance to next bus stop

- View trip status

When the driver starts a trip:

1. The browser/mobile device requests GPS permission.

2. The application obtains the current latitude and longitude.

3. The application sends the coordinates to the Node.js backend.

4. The backend stores/updates the latest bus location.

5. Socket.IO broadcasts the updated location to connected passenger clients.

6. The passenger application updates the bus position on the map.

Use realistic location update intervals, such as every 5–10 seconds, but make the interval configurable.

When the driver ends a trip:

- Stop GPS tracking

- Stop sending location updates

- Mark the trip as completed

==================================================

PASSENGER FEATURES

==================================================

Create a passenger-facing interface that is simple and easy to use.

Passengers should be able to:

- Register and log in

- View available buses

- Search for a bus

- Select a bus

- View the selected bus on a live map

- View the route of the bus

- View current bus stop

- View next bus stop

- View distance to next stop

- View estimated arrival time

- View all stops on the route

- Select a destination stop

- Receive a notification when their destination is approaching

- Receive voice announcements for upcoming stops

- View bus status

Passenger dashboard example:

Bus #12

Route: Nyabugogo → Kimironko

Current location:

Near Remera

Current stop:

Remera

Next stop:

Kimironko

Distance:

1.4 km

Estimated arrival:

5 minutes

Status:

Approaching next stop

==================================================

GPS BUS TRACKING

==================================================

Implement real GPS tracking using the driver's smartphone/browser Geolocation API.

Example GPS data:

{

  "busId": 12,

  "latitude": -1.956,

  "longitude": 30.112,

  "timestamp": "2026-08-19T09:30:00"

}

The driver's application sends this information to the backend.

The backend must:

- Validate the coordinates

- Associate the coordinates with the active bus and trip

- Save/update the latest location

- Broadcast the location using Socket.IO

The passenger application listens for the real-time location update and moves the bus marker on the map.

IMPORTANT:

The passenger must NOT directly access the driver's phone GPS.

The architecture must be:

Driver Smartphone

       ↓

GPS Location

       ↓

React Driver Application

       ↓

Internet

       ↓

Node.js/Express Backend

       ↓

PostgreSQL Database

       ↓

Socket.IO

       ↓

React Passenger Application

       ↓

Live Bus Location

==================================================

BUS ROUTE AND BUS STOP LOGIC

==================================================

Create predefined routes with ordered bus stops.

Example route:

Route:

Nyabugogo → Downtown → Remera → Kimironko

Each bus stop should contain:

- ID

- Name

- Latitude

- Longitude

- Route ID

- Stop order

Example:

Nyabugogo

Latitude: -1.944

Longitude: 30.061

Order: 1

Downtown

Latitude: -1.950

Longitude: 30.058

Order: 2

Remera

Latitude: -1.956

Longitude: 30.112

Order: 3

Kimironko

Latitude: -1.953

Longitude: 30.126

Order: 4

==================================================

CONTEXT-AWARE LOGIC

==================================================

This is an important part of the project.

The system must not simply display static bus-stop information.

Use the current GPS position, route order, distance and bus movement to determine the appropriate passenger information.

Implement logic such as:

1. BUS APPROACHING STOP

If the bus is within a configurable distance, for example 300 meters, from the next stop:

Display:

"Next stop: Remera."

Trigger a voice announcement:

"Next stop: Remera."

Do not repeatedly announce the same stop.

2. BUS ARRIVES AT STOP

When the bus reaches a smaller configurable distance from the stop:

Display:

"You have arrived at Remera."

Voice:

"You have arrived at Remera."

3. AFTER ARRIVAL

Automatically update:

Current stop = Remera

Next stop = Kimironko

4. DESTINATION ALERT

If a passenger selected Kimironko as their destination and the bus is approaching Kimironko:

Display:

"Your destination, Kimironko, is approaching."

Voice:

"Your destination, Kimironko, is approaching."

5. ROUTE DEVIATION

Compare the bus's current GPS position with the expected route.

If the bus moves significantly away from the expected route:

Display:

"Warning: Bus may have deviated from the planned route."

6. BUS NOT MOVING

If the GPS position remains nearly unchanged for a configurable period:

Display:

"Bus currently stopped."

7. LOCATION UNAVAILABLE

If the backend has not received GPS updates for a certain period:

Display:

"Bus location temporarily unavailable."

==================================================

DISTANCE CALCULATION

==================================================

Implement geographical distance calculation using the Haversine formula or an appropriate geolocation library.

The system should calculate:

Current bus position → Next bus stop

Example:

Bus:

Latitude: -1.950

Longitude: 30.108

Next stop:

Remera

Distance:

1.4 km

Display the result in meters or kilometers depending on distance.

==================================================

ESTIMATED ARRIVAL TIME

==================================================

Calculate an approximate ETA using:

- Current GPS position

- Distance to next stop

- Recent bus speed

Do not present the ETA as guaranteed.

Example:

"Estimated arrival: 5 minutes"

If there is insufficient GPS data to calculate ETA:

"ETA unavailable"

==================================================

LIVE MAP

==================================================

Create an interactive map for passengers.

The map should display:

- Bus marker

- Bus route

- Bus stops

- Current bus location

- Next stop

- Passenger-selected destination

The bus marker should move when new GPS coordinates are received through Socket.IO.

==================================================

REAL-TIME COMMUNICATION

==================================================

Use Socket.IO.

When a driver sends a new location:

Driver → Node.js server → Socket.IO → Passenger clients

Passenger applications should receive updated coordinates without manually refreshing the page.

==================================================

AUTHENTICATION AND SECURITY

==================================================

Implement:

- Registration

- Login

- Password hashing

- JWT authentication

- Role-based authorization

Roles:

ADMIN

DRIVER

PASSENGER

Drivers must only access driver functions.

Passengers must only access passenger functions.

Administrators must have access to administration functions.

Protect backend API routes using authentication middleware.

==================================================

DATABASE DESIGN

==================================================

Create appropriate PostgreSQL tables/entities such as:

users

drivers

buses

routes

bus_stops

route_stops

trips

bus_locations

passenger_destinations

announcements

Use proper primary keys, foreign keys and relationships.

==================================================

API DESIGN

==================================================

Create REST APIs such as:

POST /api/auth/register

POST /api/auth/login

GET /api/buses

POST /api/buses

PUT /api/buses/:id

DELETE /api/buses/:id

GET /api/routes

POST /api/routes

PUT /api/routes/:id

DELETE /api/routes/:id

GET /api/routes/:id/stops

POST /api/stops

POST /api/trips/start

POST /api/trips/:id/end

POST /api/locations

GET /api/buses/:id/location

GET /api/buses/:id/route

GET /api/buses/:id/next-stop

Use appropriate HTTP status codes and error responses.

==================================================

USER INTERFACE

==================================================

Create a professional, modern and clean transportation dashboard.

Use:

- Responsive layout

- Sidebar navigation for dashboards

- Cards for important information

- Tables for management data

- Interactive map

- Clear status indicators

- Mobile-friendly passenger interface

Do not make the interface overly complicated.

Use a professional transport-related visual style.

==================================================

DEMO DATA

==================================================

Include realistic demo data for development.

Create example route:

Nyabugogo → Downtown → Remera → Kimironko

Create:

- 3 buses

- Several bus stops

- 2 drivers

- 1 administrator

- Several passenger accounts

The system must allow the developer to test GPS tracking.

==================================================

GPS SIMULATION / DEVELOPMENT MODE

==================================================

Because physical testing on a real bus may not always be possible, create a development/demo mode.

The demo mode should allow the developer to simulate a bus moving along a predefined route.

For example:

Nyabugogo

↓

Downtown

↓

Remera

↓

Kimironko

The simulated bus should move between coordinates and trigger the same:

- Next-stop detection

- Distance calculation

- Arrival detection

- Voice announcement

- Passenger map updates

- ETA calculation

The actual GPS mode and simulation mode should use the same backend architecture.

==================================================

IMPORTANT SOFTWARE ENGINEERING REQUIREMENTS

==================================================

Build the project with a clear separation between frontend and backend.

Recommended structure:

/frontend

  /src

    /components

    /pages

    /services

    /hooks

    /utils

    /contexts

/backend

  /src

    /controllers

    /routes

    /models

    /services

    /middleware

    /sockets

    /utils

    server.js

Use reusable React components.

Use environment variables for:

- Database credentials

- JWT secret

- API configuration

Do not hard-code sensitive credentials.

Add proper validation and error handling.

==================================================

MAIN PROJECT OBJECTIVE

==================================================

The final system should demonstrate that:

1. A driver's smartphone can provide GPS coordinates for a bus.

2. The React driver application sends the coordinates to a Node.js backend.

3. The backend processes and stores the latest bus location.

4. Socket.IO sends location updates to passengers in real time.

5. The passenger React application displays the moving bus on a map.

6. The system identifies the current and next bus stops.

7. The system calculates distance to the next stop.

8. The system provides estimated arrival information.

9. The system automatically provides context-aware bus-stop notifications.

10. The system provides voice announcements.

11. Passengers can select a destination and receive a destination alert.

12. Administrators can manage buses, routes and bus stops.

IMPORTANT:

Do not build only a static dashboard or ordinary CRUD application.

The core feature of this project is REAL-TIME GPS BUS TRACKING + BUS STOP DETECTION + CONTEXT-AWARE ANNOUNCEMENTS + PASSENGER INFORMATION.

Start by creating the complete project structure, database schema, backend API, authentication system, React interfaces, GPS tracking, Socket.IO real-time communication, route/bus-stop logic, map interface, context-aware announcement logic, and demo GPS simulation.

Make the application functional end-to-end rather than creating placeholder screens. so my project name intelligent GPS-based bus stop announcement and context- aware passenger information system

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9bbe55d8-b12b-4915-9205-2ed570dfa06b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
