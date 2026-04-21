---
type: "query"
date: "2026-04-18T18:36:30.425286+00:00"
question: "Why does buildParams() connect Community 0 to Community 4, Community 6, Community 7, Community 18, Community 23?"
contributor: "graphify"
source_nodes: ["buildParams()", "TmdbPeopleService", "TmdbTrendingService", "TmdbSearchService", "TmdbFindService", "TmdbTvService", "TmdbTvEpisodesService", "TmdbTvSeasonsService", "BaseMediaService"]
---

# Q: Why does buildParams() connect Community 0 to Community 4, Community 6, Community 7, Community 18, Community 23?

## Answer

buildParams() is a protected helper method defined in the abstract BaseMediaService class. It safely converts parameter objects into Angular HttpParams by stripping undefined or null values. Because almost every domain-specific TMDB API service (like TmdbSearchService, TmdbPeopleService, TmdbDiscoverService, etc.) extends BaseMediaService to make HTTP requests, they all call this single method. This architectural inheritance pattern makes buildParams() a massive structural hub (a God Node with 46 edges) that bridges all the separate feature-specific API service communities together.

## Source Nodes

- buildParams()
- TmdbPeopleService
- TmdbTrendingService
- TmdbSearchService
- TmdbFindService
- TmdbTvService
- TmdbTvEpisodesService
- TmdbTvSeasonsService
- BaseMediaService