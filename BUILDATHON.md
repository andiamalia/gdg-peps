# Buildathon form drafts (PEPS)

## Description of the Problem Statement

At GDG meetups, many attendees arrive alone or feel awkward starting conversations. Static icebreakers and open chat channels do not help people quickly find peers who share hobbies, majors, workplaces, cities, or tech interests. Organizers want more in-person connection, but lack a lightweight tool that works during the event itself.

## Description of the Solution

PEPS (People · Events · Proximity · Social) is an event-scoped web app. Organizers create a room with a short code and QR. Attendees join, then complete a Gemini-powered conversational interview that dynamically asks follow-up questions to build a structured profile (hobbies, interests, origin, occupation, major, city, tech stack, goals). Profiles are embedded and matched inside the same event room. Attendees shake their phone (or tap Find my circle) to get ranked matches with AI-written reasons and icebreakers, and can also search with natural language. Stack: Vite/React, Firebase Auth/Firestore/Functions/Hosting, Vertex AI Gemini.

## Uniqueness of the Solution

Instead of a long registration form or a generic social feed, PEPS combines (1) dynamic multi-turn Gemini interviewing, (2) physical shake-to-match for venue energy, and (3) explainable AI icebreakers scoped to a single community event for privacy and relevance.
