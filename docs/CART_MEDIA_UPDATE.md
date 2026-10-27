# Cart access and uploaded-media caching

This beta update does not change catalog resolution, canonical book covers, provider caches, backend schemas, or edge functions.

- Discover, Library, and book-detail headers open the existing Book Cart. They share a per-account in-memory count, coalesce concurrent requests, and reuse it for 60 seconds. Mutations recheck an exact database count rather than blindly incrementing, so upserts cannot inflate the badge. Failed reads can retry; sign-out/account changes discard old results.
- Book pages receive confirmed cart mutations, including removal while another page is open. Successful additions animate an existing cover toward the cart and confirm the save. Reduce Motion skips the flight/bounce; blur/unmount cancels it.
- Amazon links open an ISBN search for the selected edition, falling back to title and authors. They are searches, not guaranteed product pages; no affiliate tag or provider request is added.
- Reader-uploaded public avatars, club covers, and post images use expo-image's shared memory/disk cache and consistent moderation URLs. Existing upload filenames already include a timestamp/random suffix. New photos therefore have new keys. The wrapper uses no persistent cache for signed/private or unrecognized URLs and does not strip query parameters or alter access controls. Public files remain public cached assets after logout; account-specific cart state is cleared. Feed-photo aspect ratios are bounded to 200 memory entries to avoid repeated layout shifts.

## Device checks before TestFlight

1. Open Cart from Discover, Library, and books entered through search, series, and library. Counts and navigation should agree.
2. Add a book: confirm a single save, flight/bounce, confirmation, and updated badge. Try Reduce Motion, rapid taps, navigation during the save, and a failed/offline save (no success animation).
3. Remove it in Cart, return to an already-open book, and confirm Add to Cart is restored. Add it twice; the count must not inflate.
4. Open Amazon from book details and a cart row. Verify the selected ISBN appears in the query. Test a book without an ISBN and a link-opening failure.
5. Switch between feed, profile, reader profile, club, and enlarged photos after warming images. Repeat offline. Replace profile/club photos and confirm the new image appears; existing catalog artwork must remain identical.
6. Sign out, sign into another account, and confirm no previous cart count is shown. Signed/private photos must still require access and must not use disk caching.

Automated checks cover count coalescing, duplicate-safe mutations, logout/in-flight races, retry behavior, ISBN fallback, cache keys, private-media policy, image event compatibility, navigation, animation completion, and Reduce Motion. Native animation feel and offline image reuse still require device testing.
