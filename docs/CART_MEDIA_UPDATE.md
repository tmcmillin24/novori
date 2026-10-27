# Cart access and uploaded-media caching

This beta update does not change catalog resolution, canonical book covers, provider caches, backend schemas, or edge functions.

- Discover, Library, and book-detail headers open the existing Book Cart. They share a per-account in-memory count, coalesce concurrent requests, and reuse it for 60 seconds. Mutations recheck an exact database count rather than blindly incrementing, so upserts cannot inflate the badge. Failed reads can retry; sign-out/account changes discard old results.
- Book pages receive confirmed cart mutations, including removal while another page is open. Confirmed library writes also update Owned and reading status on mounted book pages, scoped to the signed-in reader. Successful additions animate an existing cover toward the cart and confirm the save. Reduce Motion skips the flight/bounce; blur/unmount cancels it.
- Amazon links search the Books department by title and author so regional ISBNs do not hide available editions. ISBN is used only when title and author are unavailable. They are searches, not guaranteed product pages; no affiliate tag or provider request is added.
- Reader-uploaded public avatars, club covers, and post images use expo-image's shared memory/disk cache and consistent moderation URLs. Existing upload filenames already include a timestamp/random suffix. New photos therefore have new keys. The wrapper uses no persistent cache for signed/private or unrecognized URLs and does not strip query parameters or alter access controls. Public files remain public cached assets after logout; account-specific cart state is cleared. Feed-photo aspect ratios are bounded to 200 memory entries to avoid repeated layout shifts.

## Device checks before TestFlight

1. Open Cart from Discover, Library, and books entered through search, series, and library. Counts and navigation should agree.
2. Add a book: confirm a single save, flight/bounce, confirmation, and updated badge. Try Reduce Motion, rapid taps, navigation during the save, and a failed/offline save (no success animation).
3. Remove it in Cart, return to an already-open book, and confirm Add to Cart is restored. Add it twice; the count must not inflate.
4. Open Amazon from book details and a cart row. Verify Alchemised searches for its title and author even with a regional ISBN. Test an ISBN-only record and a link-opening failure.
5. Switch between feed, profile, reader profile, club, and enlarged photos after warming images. Repeat offline. Replace profile/club photos and confirm the new image appears; existing catalog artwork must remain identical.
6. Sign out, sign into another account, and confirm no previous cart count is shown. Signed/private photos must still require access and must not use disk caching.

Automated checks cover confirmed ownership updates across pages, account isolation, count coalescing, duplicate-safe mutations, logout/in-flight races, retry behavior, ISBN fallback, cache keys, private-media policy, image event compatibility, navigation, animation completion, and Reduce Motion. Native animation feel and offline image reuse still require device testing.

## Book-detail and search polish

- Cart, report, and share actions use matching 44-point circular controls.
- The Amazon link sits below reading controls, with a smaller gap above the reading-status section. It no longer separates series metadata from status controls.
- Recent searches remain device-local and appear only while the empty Books search field is focused. A quiet header and compact, wrapping search chips with accessible remove controls replace the cramped presentation; search/clear/remove behavior is unchanged.
- Apple guideline 3.1.3(e) permits external payment for physical goods consumed outside the app. The link is an ordinary Amazon Books search, not a promise of availability or Apple approval for digital purchase flows.

## Ownership-only library entries

Library lists exclude rows with no ownership, reading status, rating/review, or reading dates. A cart-only book disappears when Owned is cleared, including when toggled directly in Library; tracked/reviewed books remain. Filtering happens before the existing cover lookup and is shared by private library list consumers. The database row and any related history are retained, avoiding destructive cleanup or cascading deletions. Regression coverage reproduces the cart ownership save, subsequent unowning, and library read.

Book-search text input now uses sentence capitalization so the keyboard begins with a capital letter. Reader/username search retains no automatic capitalization. This is a keyboard preference, not forced title casing; existing query text, ISBNs, history storage, and cache keys are unchanged.
