# Cinescope: Mobile-First Defensive Bug Hunt & Code Audit
*Prepared by: Principal Staff-Level Mobile Architect*

## Executive Summary
This document provides a comprehensive analysis of the existing features in the "Cinescope" mobile workspace. An aggressive mobile-first code audit has identified critical architectural flaws, race conditions, memory management issues, and mobile-specific UX bottlenecks. 

Below is the feature-wise matrix breaking down identified bugs, the mobile-specific problem anticipated, and reproduction test cases.

---

## 1. Feature: Data & Background Layer (`StorageService` & `TmdbSearchService`)
**Implemented Scope:** Caching, Offline Preferences Storage, Automated TMDB Background Hydration.

### 🐛 Bug 1.1: Concurrency & Race Conditions in Storage
- **Severity:** High
- **Vulnerability:** `StorageService` methods (`addToInbox`, `removeFromInbox`) use asynchronous read-modify-write patterns (`await getList() -> modify -> await setList()`) without mutex locks or operation queuing.
- **Mobile Anticipation:** Touchscreens frequently register unintentional "double taps", or users swipe multiple cards violently. Rapid consecutive actions will overwrite parallel disk-write operations, resulting in silent, permanent data loss.
- **Test Case:** 
  1. Create a script or repeatedly mash the "Add to Watchlist" button 5 times in 100ms.
  2. Await all promises.
  3. Assert `watchlist.length` equals 5. (Result: It will likely equal 1, proving data loss).

### 🐛 Bug 1.2: Persistent API Spam Loop in Background Hydration
- **Severity:** Medium
- **Vulnerability:** Under `hydrateListInBackground`, items missing `title` trigger a TMDB API call. If TMDB returns a 404, the `catch` block swallows the error but doesn't flag the item as "attempted".
- **Mobile Anticipation:** Users leaving the app open in the background will drain device battery and consume hidden cellular data allowances trying to rapidly fetch a dead media ID infinitely.
- **Test Case:**
  1. Inject an invalid mock `contentId` (e.g., `-999`) into Local Preferences.
  2. Launch the app and open the network inspector.
  3. Observe continuous failing network requests looping indefinitely.

### 🐛 Bug 1.3: Total Lack of Offline Retry & Timeout Architecture
- **Severity:** High
- **Vulnerability:** `TmdbSearchService` issues raw HTTP calls (e.g., `searchMovies`). If the observable errors out, it just throws. No `retryWhen`, no timeout fallbacks.
- **Mobile Anticipation:** Mobile networks drop frequently (entering subway, switching Wi-Fi to Cellular). The UI will instantly crash or display a blank "Something went wrong" without attempting a graceful self-heal (e.g., retry 3 times with exponential backoff).
- **Test Case:**
  1. Trigger a Search via `SearchPage`.
  2. Exactly as the loader spins, toggle the network emulator to "Offline".
  3. Observe the app failing to recover or retry.

---

## 2. Feature: Media Grids (`MoviePage` & `TvPage`)
**Implemented Scope:** Watchlist and Watched categorization tabs, Custom filtering (Sort, Genre), Infinite grids.

### 🐛 Bug 2.1: DOM Bloat & Missing Virtual Scrolling
- **Severity:** Critical
- **Vulnerability:** `movie.page.html` uses a standard Anglar `*ngFor` over `getCurrentMedia()` to render image posters, titles, and checkboxes. There is no pagination and no usage of `<ion-virtual-scroll>` or `@angular/cdk/scrolling`. 
- **Mobile Anticipation:** Over months of usage, a user's Watchlist can grow to 500+ items. Rendering 500 heavy DOM nodes with CSS transitions on an older Android device (e.g., 3GB RAM) will cause out-of-memory (OOM) crashes and scrolling jank (FPS drops < 15 fps).
- **Test Case:**
  1. Seed Capacitor Preferences with an array of 1,000 mock movie items.
  2. Navigate to the "Movies" tab.
  3. Open Chrome DevTools -> Performance -> Measure "Time to Interactive" (TTI). Observe lag spikes > 2 seconds.

### 🐛 Bug 2.2: Main Thread Blocking via Array Mapping
- **Severity:** Medium
- **Vulnerability:** Inside `MoviePage.loadMedia()`, a giant spread operator is used: `[...this.watchlist, ...this.watched].forEach(...)` to parse and deduplicate Genres into a `Set`.
- **Mobile Anticipation:** Mobile CPU architectures handle synchronous array generation poorly. This operation blocks the main UI thread immediately upon tab navigation, causing the app header navigation animation to stutter.
- **Test Case:**
  1. Inject 500 items into the Watchlist.
  2. Tap the "Movies" tab from the bottom bar.
  3. Notice the visual stutter before the page renders, as the Main Thread stops to process the Set insertion.

---

## 3. Feature: The Inbox (`InboxComponent`)
**Implemented Scope:** Swipeable Tinder-style cards, Discard/Watchlist gesture routing, Undo bulk actions logic.

### 🐛 Bug 3.1: Gesture Transition vs. Array Mutation Race Condition
- **Severity:** High
- **Vulnerability:** `discard()` utilizes a `setTimeout(..., 300)` wait to let CSS transforms finish before calling `this.inboxItems.shift()`. 
- **Mobile Anticipation:** Users swipe incredibly fast on mobile (often 2-3 cards per second). If 3 cards are swiped in 300ms, the timeout queue executes `.shift()` 3 consecutive times targeting whatever happens to be at index `0` at that precise future millisecond, visually deleting cards the user *never actually swiped*.
- **Test Case:**
  1. Load the Inbox with 5 items.
  2. Rapidly flick the top card left 3 times in quick succession.
  3. Observe the Angular array and the UI fall completely out of sync, displaying dead whitespace or wrong posters.

### 🐛 Bug 3.2: Unsafe Private Property Access (`uniqKey`)
- **Severity:** Low (but structurally fatal)
- **Vulnerability:** Code bypasses TypeScript encapsulation via bracket notation: `this.storageService['uniqKey'](item)`.
- **Mobile Anticipation:** When producing the final APK/AAB bundle, Angular's Terser optimizer aggressively mangles private variables to save bytes. `'uniqKey'` string lookup will fail at runtime on production devices, throwing `undefined is not a function`.
- **Test Case:**
  1. Build the app using `ng build --configuration production`.
  2. Run the minified bundle.
  3. Trigger the "Select All" bulk list view logic. Observe the crashed UI state.

### 🐛 Bug 3.3: DOM Tracking Collisions (`trackById`)
- **Severity:** Medium
- **Vulnerability:** `trackById` resolves to `item.contentId + '-' + item.isMovie`.
- **Mobile Anticipation:** For Person entities, generic content, or malformed JSON payloads, `isMovie` can be `undefined`. If two IDs collide, Angular's `NgForOf` instantly crashes the component lifecycle due to duplicate keys.
- **Test Case:**
  1. Mock two separate entities in the Inbox array with identical numeric IDs but missing `isMovie` flags.
  2. Navigate to the Inbox. 
  3. The component will fail to bootstrap.

### 🐛 Bug 3.4: Undo Toast Navigation Memory Leak
- **Severity:** Edge-Case
- **Vulnerability:** When utilizing bulk actions, a Toast intercepts for 5 seconds. If the user navigates to a new Tab, the component is destroyed. The Toast's pending Promise still fires, executing `this.inboxItems.shift()` and `this.updateCurrentItem()` on a destroyed heap allocation.
- **Mobile Anticipation:** Memory leaks. Slowly degrades performance as ghost UI elements stay referenced in memory preventing garbage collection.
- **Test Case:**
  1. Select a bulk action and hit "Discard" (Toast appears).
  2. Immediately tap the 'Movies' tab on the bottom bar to change views.
  3. Check console for "Cannot read properties of undefined / ViewDestroyedError" after 5 seconds.

---

## Conclusion & Architecture Recommendations
To enforce a "Defensive Mobile-First" posture:
1. **Move to Queues:** Replace synchronous read-writes in `StorageService` with a Promise queue or Mutex architecture.
2. **Implement Virtualization:** Introduce `@angular/cdk/scrolling` into all Grid and List components immediately.
3. **Decouple DOM from State:** The Inbox swipe logic must disconnect the physical DOM node from the logical array synchronously on `onEnd`, bypassing `setTimeout` entirely.
4. **Implement Global Interceptors:** Create an HTTP interceptor that automatically retries failed `TmdbSearchService` requests up to 3 times before failing to the UI.
