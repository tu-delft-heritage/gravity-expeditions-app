# Gravity Expeditions at Sea

Follow the expeditions of Dutch geophysicist and geodesist Felix Andries Vening
Meinesz (1887–1966) through maps, images and stories.
Originally published in 2014 as part of [Expeditie Wikipedia](https://expeditiewikipedia.nl/),
the site now uses [Allmaps Slides](https://github.com/allmaps/slides).

## Edit the story

- [slideshows](slideshows): chapter text and map views.
- [slides.config.yml](slides.config.yml): title, shared maps and interface settings.
- [assets/geojson/route.geojson](assets/geojson/route.geojson): expedition route.
- [credits.md](credits.md): acknowledgements.

See the [Slides authoring guide](https://github.com/allmaps/slides/blob/main/docs/authoring.md)
for formatting, and [content notes](docs/content.md) for route styling, background
and earlier development ideas.

## Preview and build

Use Node.js 24 or later and pnpm 10. Run from this repository:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

After editing, run `pnpm validate` and `pnpm build`. Builds generate local IIIF
images and map previews automatically. Use `pnpm exec slides iiif .` to refresh
local images during development.

Pushes to `main` run the [GitHub Pages workflow](.github/workflows/deploy-pages.yml).
The Slides version is pinned in `package.json` and `pnpm-lock.yaml`.
See [deployment](docs/deployment.md) for setup, upgrades and cache controls.
