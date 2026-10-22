---
sidebar_position: 4
title: Discover Hub & Curated Feeds
---

# Discover Hub & Curated Feeds

CineScope provides a rich visual exploration experience through curated discovery hubs, real-time trending carousels, and dedicated regional cinema sections.

---

## Dynamic Hero Backdrops & Trending Feeds

The **Discover** tab serves as the primary gateway to current cinematic releases. It features a full-bleed hero banner showcasing top trending titles with high-definition backdrop artwork, release year, runtime, and community ratings.

<div align="center">
  <img src="/img/screenshots/02-discover-trending.jpg" width="340" alt="Discover Trending Feed" />
  <p><sub><b>Figure 1:</b> Discover hub with dynamic backdrop carousels, genre pills, and live trending swimlanes.</sub></p>
</div>

### Catalog Swimlanes

Below the hero banner, browse horizontally scrolling swimlanes organized by discovery criteria:
- **Trending Today**: Real-time viral titles gaining momentum globally.
- **Popular Movies & TV Shows**: Titles with the highest overall community engagement.
- **Top Rated of All Time**: Critically acclaimed masterpieces filtered by minimum vote thresholds.
- **In Theatres / Now Playing**: Movies currently showing in cinemas with local release dates.
- **Upcoming Releases**: Anticipated theatrical and streaming titles scheduled for future release.

---

## Regional Indian Cinema Hub

CineScope features a dedicated **Desi Hub** designed specifically for regional Indian cinema enthusiasts, spanning multilingual film industries across South Asia.

<div align="center">
  <img src="/img/screenshots/03-regional-desi-hub.jpg" width="340" alt="Regional Indian Cinema Hub" />
  <p><sub><b>Figure 2:</b> Regional cinema hub featuring dedicated swimlanes for Telugu blockbusters, Tamil cinema, and Indian OTT series.</sub></p>
</div>

### Curated Regional Sections

- **Telugu Cinema (Tollywood)**: Massive commercial blockbusters, action epics, and regional drama releases.
- **Tamil Cinema (Kollywood)**: Grounded crime thrillers, social dramas, and musical spectacles.
- **Hindi Cinema (Bollywood)**: Major mainstream releases, indie art-house films, and comedy hits.
- **Malayalam Cinema (Mollywood)**: High-concept screenwriting, realism-focused mysteries, and character studies.
- **Indian Web Series**: Premium series streaming across regional platforms.

---

## Smooth Infinite Scrolling & Caching

- **Sub-Frame Image Hydration**: Poster thumbnails are downloaded once and cached in local application storage, enabling immediate re-rendering during repeat visits.
- **Virtualized Viewports**: Infinite scrolling feeds recycle DOM elements to maintain smooth 60fps scrolling performance, even when navigating hundreds of titles.
- **Offline Fallback**: Feeds previously loaded while online remain available in local cache if network connectivity is temporarily lost.
