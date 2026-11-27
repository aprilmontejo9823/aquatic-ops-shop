# Aquatic Ops shop pages

Public catalog pages for aquarium shops that use the Aquatic Ops app. Each shop is at `/<shop-id>/`, with one page per item at `/<shop-id>/p/<item-id>/`.

- `src/` — page design (HTML templates, CSS, browser script)
- `tools/build.mjs` — fills the pages with each shop's live items so search engines can read them
- `shops.json` — the shops that get their own folder
- `.github/workflows/build.yml` — builds the pages when you start it (Actions → Build shop pages → Run workflow)

Visitors always see live stock: the page loads the latest data from the shop's app when it opens.
