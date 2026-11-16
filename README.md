# Geno's Library

A visual library for books, movies and shows, and albums: genre-colored shelves, a VHS shelf, a record wall,
ratings and reviews, Bookstagram posts, and a random "what next" picker.

- **App:** `index.html` (one page, no build step). Hosted with GitHub Pages.
- **Accounts and saved data:** Supabase. `config.js` holds the project URL and the publishable key, which are meant to be public.
  Row-level security keeps each person's library private.
- **Your lists:** read from a Google Sheet published as CSV. Each person adds their own links under Settings.
- **Database setup:** paste `supabase/setup.sql` into Supabase → SQL Editor and run it once.
