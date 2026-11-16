# Geno's Library

A visual library for books, movies and shows, and albums: genre-colored shelves, a VHS shelf, a record wall,
ratings and reviews, Bookstagram posts, and a random "what next" picker.

- **App:** `index.html` (one page, no build step). Hosted with GitHub Pages.
- **Accounts and saved data:** Supabase. `config.js` holds the project URL and the publishable key, which are meant to be public.
  Row-level security keeps each person's library private.
- **Your lists:** read from a Google Sheet published as CSV. Each person adds their own links under Settings.
- **Database setup:** paste `supabase/setup.sql` into Supabase → SQL Editor and run it once.
- **iPhone widget:** run `supabase/widget.sql` once (already included in `setup.sql` for new installs), then use Settings → iPhone widget.
  The widget script is in `widget/genos-library-widget.js`; the app fills in each person's private widget code.
