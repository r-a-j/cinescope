---
sidebar_position: 8
title: Privacy Policy
description: Privacy Policy and Data Handling for CineScope
---

# Privacy Policy for CineScope

**Last Updated:** November 3, 2026  
**Effective Date:** November 3, 2026

Welcome to **CineScope** ("we", "our", or "us"). CineScope is designed with a **privacy-first, offline-first** philosophy. We strongly believe that your movie watching habits, private watchlists, and search preferences belong solely to you.

This Privacy Policy explains how CineScope handles information when you use our mobile application and related services.

---

## 1. Summary of Core Principles

* **No Personal Data Collected:** CineScope does not collect, harvest, sell, or rent any personally identifiable information (such as your name, email address, phone number, contacts, or precise physical location).
* **No Account Required:** You do not need to create an account, log in with social providers, or provide credentials to use CineScope.
* **Local-First Data Storage:** All your watchlists, custom collections, and watched history are stored locally on your device via an embedded reactive database (RxDB).
* **No Ad Tracking:** CineScope contains no third-party advertising SDKs, ad networks, or commercial trackers.

---

## 2. Information We Handle

### A. Data Stored Locally on Your Device
CineScope uses client-side reactive storage (RxDB backed by IndexedDB / SQLite) to maintain:
* Your saved movie and TV show watchlists
* Your watched history and media status records
* Your app preferences and UI state

This data **never leaves your device** unless you explicitly export or sync it. We do not have access to your local database.

### B. Network Requests and Search Queries
When you use online features within the app:
* **AI Semantic Search:** When you submit a conversational query (e.g., *"mind-bending sci-fi movies"*), the search text is transmitted securely over HTTPS to our serverless backend and processed by the Google Gemini API to translate your query into structured discovery filters. These queries are processed ephemerally and are **not linked to your personal identity or account**.
* **Catalog & Metadata Retrieval:** Requests for movie details, posters, cast lists, and trending feeds are retrieved from public entertainment APIs (The Movie Database – TMDB).
* **Streaming Availability:** Real-time provider availability (e.g., Netflix, Prime Video) is queried without transmitting any personal profile data.

---

## 3. Third-Party Services

To provide rich cinema discovery, CineScope interfaces with trusted third-party APIs over secure HTTPS connections:

| Third-Party Service | Purpose | Data Shared | Privacy Policy |
| :--- | :--- | :--- | :--- |
| **Google Gemini API** | Natural language query compilation | Anonymized search query string | [Google Privacy Policy](https://policies.google.com/privacy) |
| **The Movie Database (TMDB)** | Media metadata, cast, posters, and trailers | Media IDs and genre/year query filters | [TMDB Terms & Privacy](https://www.themoviedb.org/privacy-policy) |
| **Vercel** | Serverless Backend-for-Frontend (BFF) hosting | Standard web server request logs (IP address, user agent) for DDoS prevention | [Vercel Privacy Policy](https://vercel.com/legal/privacy-policy) |

---

## 4. Permissions Requested

CineScope requests minimal device permissions:
* **Internet Permission (`android.permission.INTERNET`):** Required to fetch online catalog data, streaming availability, poster images, and communicate with the Gemini AI semantic search API.

CineScope **does not** request access to your contacts, camera, microphone, GPS location, device storage, or SMS.

---

## 5. Children's Privacy (COPPA Compliance)

CineScope is not directed toward children under the age of 13. We do not knowingly collect, solicit, or maintain personal information from children under 13. Because our application does not collect any personal information from any user, no child data is ever collected or stored.

---

## 6. Data Retention and Deletion

* Because your data is stored locally on your device, you have complete control over it at all times.
* You can permanently delete all stored watchlists, history, and cached data at any time by clearing the application data in your Android **Settings > Apps > CineScope > Clear Storage** or by uninstalling the app.

---

## 7. Changes to This Privacy Policy

We may update this Privacy Policy periodically to reflect new features, architectural improvements, or legal requirements. Any updates will be posted to this page with an updated "Last Updated" date.

---

## 8. Contact Us

If you have any questions, suggestions, or concerns regarding this Privacy Policy or your data privacy while using CineScope, please contact us:

* **GitHub Issues:** [https://github.com/r-a-j/cinescope/issues](https://github.com/r-a-j/cinescope/issues)
* **Project Repository:** [https://github.com/r-a-j/cinescope](https://github.com/r-a-j/cinescope)
* **Documentation Hub:** [https://docs-ten-pi-73.vercel.app/](https://docs-ten-pi-73.vercel.app/)
