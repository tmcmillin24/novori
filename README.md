# Novori

**Read. Discuss. Belong.**

Novori is a social reading app focused on helping people discover books, organize their reading life, share reviews, and eventually build communities around the books they care about.

The project is currently in **alpha development**. Core account, discovery, library, profile, rating, and book-detail flows are functional, while the broader social/community layer is still being built.

## Current Features

- Email/password authentication with Supabase
- Email confirmation and password recovery flows
- Editable user profiles with avatar, display name, username, and bio
- Dark and light themes
- Live Google Books search while typing
- Book detail pages with metadata, descriptions, covers, and series information
- Hardcover-powered series metadata through a Supabase Edge Function
- Reading statuses:
  - Want to Read
  - Reading
  - Read
  - DNF
- Ratings in 0.5-star increments
- Optional written reviews
- Library filtering by reading status
- Library sorting by recently updated, title, or author
- Library status changes and book removal
- Profile reading history in a compact cover grid
- Currently Reading profile preview and dedicated view
- Source-aware navigation between Discover, Library, Profile, and Book Details

## Product Direction

Novori is designed to become more than a personal book tracker. The long-term goal is a community-first reading platform where discovery, discussion, reading activity, clubs, and local reader connections live in one place.

Planned areas include:

- Social Home feed
- Reader following and activity
- Book discussions and spoiler-aware conversations
- Clubs and reading groups
- Group events and virtual meetups
- Reader discovery and recommendations
- Nearby public reading groups with privacy controls
- Private reading notes
- Custom shelves
- Goodreads import
- Novori Match based on rating similarity
- Premium features while keeping the core social experience free

## Tech Stack

| Area | Technology |
| --- | --- |
| Mobile app | React Native |
| Framework | Expo SDK 57 |
| Language | TypeScript |
| Navigation | Expo Router |
| Backend | Supabase |
| Authentication | Supabase Auth |
| Database | PostgreSQL via Supabase |
| Book catalog | Google Books API |
| Series metadata | Hardcover API |
| Server-side integration | Supabase Edge Functions |
| Local persistence | AsyncStorage |
| Icons | Expo Vector Icons |
| Fonts | Playfair Display + Inter |

## Project Structure

```text
src/
  app/
    (tabs)/
      index.tsx
      discover.tsx
      post.tsx
      library.tsx
      profile.tsx
      notifications.tsx

    book/
      [id]/
        index.tsx

    auth.tsx
    auth-confirm.tsx
    confirm-email.tsx
    currently-reading.tsx
    edit-profile.tsx
    rate-review.tsx
    reset-password.tsx
    settings.tsx
    ...

  components/
    tab-screen.tsx

  constants/
    novori-theme.ts

  context/
    theme-context.tsx

  lib/
    supabase.ts
    user-books.ts

assets/
  images/
```

## Local Development

Clone the repository and install dependencies:

```bash
git clone https://github.com/tmcmillin24/novori.git
cd novori
npm install
```

Start Expo:

```bash
npx expo start
```

For the local iOS development build:

```bash
npx expo run:ios
```

When adding Expo-compatible packages, prefer:

```bash
npx expo install <package>
```

This project currently targets **iOS 16.4+** for native development.

## Environment Variables

Create a local `.env` file in the project root.

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY=your_google_books_api_key
```

Do not commit `.env` files, service-role keys, private API tokens, or other secrets.

The Hardcover API token is stored server-side in Supabase and is used by the `hardcover-series` Edge Function. It should never be exposed in the mobile client.

## Reading Data

User reading data is stored in the Supabase `user_books` table and is scoped to the authenticated user through Row Level Security.

Each saved book can include:

```text
Google Books ID
Title
Authors
Cover
ISBN
Published date
Reading status
Rating
Review
Started timestamp
Finished timestamp
```

The supported statuses are:

```text
want_to_read
reading
read
dnf
```

## Book Data Strategy

Novori uses **Google Books** as the primary searchable catalog.

**Hardcover** supplements Google Books with series information that is not consistently available through Google Books. Hardcover requests are handled server-side through Supabase rather than exposing the API token in the client.

This separation allows Novori to keep Google Books as the primary book identity while enriching individual book pages with series context.

## Design

The current visual system uses a dark charcoal / warm cream foundation with champagne-gold accents.

Typography:

- **Playfair Display** for prominent editorial headings
- **Inter** for interface text and controls

The app supports both dark and light appearance modes.

## Alpha Status

Novori is not production-ready yet.

Current development is focused on stabilizing the core reading experience before expanding the social layer. The next major phase includes the Home feed, posting, discussions, following, clubs, and community discovery.

## Development Notes

The app uses Expo Router's file-based routing.

The main navigation structure is:

```text
Home | Discover | + | Library | Profile
```

Book Details is shared across Discover, Library, Profile, and Currently Reading. Navigation passes source context so the back action returns the reader to the correct part of the app.

The `user_books` table is intentionally private. Future public activity and social features should use purpose-built public-facing data models instead of making personal library rows broadly readable.

## Repository

GitHub:

```text
https://github.com/tmcmillin24/novori
```

---

**Novori**  
*Read. Discuss. Belong.*
