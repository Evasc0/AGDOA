# Agduwa Ride-Hailing System User Manual

## Table of Contents
1. [Introduction](#introduction)
2. [System Overview](#system-overview)
3. [Getting Started](#getting-started)
4. [Driver Guide](#driver-guide)
5. [Admin Guide](#admin-guide)
6. [Current System Rules](#current-system-rules)
7. [Troubleshooting](#troubleshooting)
8. [Frequently Asked Questions](#frequently-asked-questions)

## Introduction

Welcome to **Agduwa**, a web-based queue and ride management system for drivers and admins.

This manual is updated to reflect the **current implementation** in this repository.

### Who This Manual Is For

- Drivers using the web app for queueing and ride logging
- Admins managing drivers, queue order, approvals, and reports

## System Overview

### Architecture

- **Frontend**: React + TypeScript + Vite
- **Backend**: Firebase Authentication + Firestore
- **Styling**: Tailwind CSS
- **Deployment**: Web deployment (for example, Vercel)

### User Roles

1. **Driver**
- Registers account
- Waits for admin approval
- Joins queue, starts rides, views history/analytics, updates profile

2. **Admin**
- Approves/rejects driver registrations
- Manages verified drivers and queue order
- Views operational status, logs, history, and analytics

### Main Collections Used

- `drivers`
- `queues`
- `ride_logs`
- `adminAccessLogs`
- `publicProfiles`

## Getting Started

### Prerequisites

- Modern browser (Chrome, Edge, Firefox, Safari)
- Stable internet connection
- Device with location services (important for drivers)

### Landing Page Behavior

When opening the app:

- The first screen shows the **Active Drivers Queue**
- Tap **Login** to open sign-in/sign-up form

### Account Types

- **Driver account**: created through registration form, then approved by admin
- **Admin account**: recognized by admin email (default: `agduwaadmin@gmail.com`)

## Driver Guide

### 1. Registration

From the login form, switch to **Register** and fill:

- Full Name
- Email
- Password (minimum 6 characters)
- Plate Number
- Vehicle
- Phone Number (must be 11 digits)

If validation fails, the app blocks submission and shows an error.

### 2. Account Approval

- New driver accounts are created as **unverified**
- You must wait for admin approval in the Pending list
- Unapproved accounts cannot access the driver dashboard

### 3. Login

After approval:

1. Enter email and password
2. System checks account and verification status
3. You are redirected to driver tabs (`Home`, `Analytics`, `History`, `Profile`)

### 4. Home Tab (Queue and Ride Flow)

#### What You See

- Ride Status (`Offline`, `Waiting`, `In Ride`)
- Location Status (`Inside Paradahan` / `Outside Paradahan`)
- Vehicle info
- Destination dropdown (from fare matrix)
- Queue status (position, estimated wait, queue list)

#### Going Online / Offline

- Use **Go Online** or **Go Offline** button
- Queue participation depends on being inside the geofenced area

#### Queue and Turn Logic

- You can start a ride only when your position is **1**
- Select destination first, then tap **Start Ride**

#### Ride Completion Logic (Current Behavior)

1. Tap **Start Ride** while position is 1
2. Exit the paradahan area to begin trip phase
3. Return inside paradahan to complete and log the ride

Ride logging includes destination, estimated earnings, timestamps, and wait/travel time values tracked by the app.

### 5. History Tab

Shows your ride records with:

- Destination
- Ended date/time
- Estimated distance and duration
- Earnings

Available filters:

- Quick date presets (`Today`, `Last 7 Days`, `This Month`, `All Time`)
- Start date / End date
- Dropoff location text match
- Minimum fare

### 6. Analytics Tab

Current driver analytics include:

- 7-day weather forecast cards
- Alert message for rainy/storm forecasts
- Avg wait time gauge
- Rides today gauge
- Earnings overview gauge
- Top drop-off list
- 7-day rides/earnings trend chart
- Ride and earnings breakdown (weekly, monthly, annually, custom filter modal)

Custom filter modal supports:

- Date range
- Quick presets
- Month and year selection

### 7. Profile Tab

Profile supports:

- Edit mode for age, contact, payment method, payment number, and image
- Status toggle in edit mode (for profile status field)
- Profile QR code that links to public driver profile route: `/driver/{driverId}`
- Public profile data sync to `publicProfiles`
- Logout

## Admin Guide

### 1. Admin Access

- Login with admin email account (default configured admin email: `agduwaadmin@gmail.com`)
- Non-admin users are redirected away from `/admin`

### 2. Admin Layout

Admin view has a sidebar and sections:

- Analytics
- Drivers
- Queue
- Status
- Logs
- History
- Pending

### 3. Drivers Section

Features:

- Search by name or plate
- View status and email
- **Edit** driver details (modal)
- **Delete** driver
- **Reset** password (sends reset email)
- **Add to Queue** / **Remove from Queue**

### 4. Queue Section

Features:

- View current queue order
- Drag-and-drop reorder
- Remove driver from queue
- Queue entry display includes capacity label (`6 passengers`)

### 5. Status Section

Grouped view:

- **In Queue**
- **In Ride** (includes destination and left time)
- **Offline**

### 6. Pending Section

Shows unverified registrations with actions:

- **Approve**: sets `verified: true`
- **Reject**: deletes pending driver record

### 7. History Section

Includes:

- Driver registration list and registration timestamp
- Destination history table from `ride_logs`
- Filters by driver name, plate, and start/end date
- Delete action for individual ride records

### 8. Logs Section

Shows admin activity logs with:

- Action text
- Date/time

### 9. Analytics Section

Current admin analytics provide:

- Weekly, Monthly, Annually, and Custom range filters
- Ride volume report cards (total rides, peak hour, busiest day, average rides/hour)
- Ride volume heatmap
- Top drop-off locations chart

## Current System Rules

These rules reflect current code behavior:

1. Drivers must be verified by admin before full access.
2. Driver queue behavior is geofence-aware (inside paradahan required for active queue flow).
3. A ride starts from queue position 1 after destination selection.
4. Ride completion/logging occurs when driver returns inside paradahan after leaving.
5. Admin queue-status logic marks drivers who leave queue as `in ride`, and can auto-mark `offline` after 1 minute if still out of queue.
6. Public driver profile is accessible via QR link (`/driver/{driverId}`).

## Troubleshooting

### Driver Issues

#### Cannot Access Dashboard

- Confirm account was approved by admin
- Verify correct email/password

#### Location Errors

- Enable GPS/location services
- Allow browser location permission
- Move into geofenced area for queue actions

#### Cannot Start Ride

- Ensure you are position **1** in queue
- Ensure destination is selected
- Confirm location is available

#### No Ride History Appears

- Confirm you are logged in with the same driver account that completed rides
- Trigger a refresh or reopen History tab

### Admin Issues

#### Admin Page Redirects Away

- Confirm logged-in email matches configured admin email

#### Pending Requests Not Showing

- Check `drivers` records with `verified: false`
- Confirm Firestore read permissions and connectivity

#### Queue Reorder Fails

- Check Firestore write permissions
- Retry after refresh

#### Analytics Looks Empty

- Confirm there are records in `ride_logs`
- Try switching filter range

## Frequently Asked Questions

### Q1: Is this a mobile app APK?
A: No. This project is implemented and deployed as a web app.

### Q2: How does a ride get logged?
A: Driver starts ride at queue position 1, exits paradahan, then re-enters paradahan. The system records the ride in `ride_logs`.

### Q3: Can users view driver info without login?
A: Yes. Public driver profile is available through QR link (`/driver/{driverId}`).

### Q4: Can admin manually control queue?
A: Yes. Admin can add/remove drivers and reorder queue via drag-and-drop.

### Q5: Can admin remove incorrect ride records?
A: Yes. In Admin > History > Destination History, each ride entry has a Delete action.

---

For support, contact your system administrator.

Last updated: **April 8, 2026**
Version: **2.0**
