# Content notes

## Expedition route

The expedition route is the shared `sources.route` in `slides.config.yml`.
Edit `assets/geojson/route.geojson` for geometry and SimpleStyle properties:
`stroke`, `stroke-width` and `stroke-opacity`. These affect both the interactive
map and generated previews.

The global `layers` entry keeps `route-line` visible by default. To hide it on
one slide, add `layers: [{layer: route-line, visibility: none}]` to that slide's
frontmatter. Other slides return to the global default.

The [Pages workflow](../.github/workflows/deploy-pages.yml) caches IIIF images,
annotations and map previews. It builds with the shared Slides source and exports
`dist/site`. See [Slides deployment](https://github.com/allmaps/slides/blob/main/docs/deployment.md)
for the framework's build requirements.

## Background

- [Stichting Academisch Erfgoed](https://www.academischerfgoed.nl/projecten/de-grote-wikipedia-expeditie/)
- [Wikipedia expeditions](https://nl.wikipedia.org/wiki/Wikipedia:GLAM/Expedities)

## Inspired by

- [Reuzenarbeid](https://tu-delft-heritage.github.io/reuzenarbeid/)
- [City Atlas](https://cityatlas.theberlage.nl/)
- [Interactive Storytelling with MapLibre](https://github.com/digidem/maplibre-storymap/)

## Earlier development ideas

These ideas were recorded in the original README. They are retained as context,
not a current task checklist; some interface features now exist in shared Slides.

- Create Protomaps version of bathymetric chart:
  - https://github.com/shiwaku/gebco-2025-grid-tile-on-maplibre/tree/main?tab=readme-ov-file
  - https://www.gebco.net/data-products/gridded-bathymetry-data
  - https://www.gebco.net/data-products/gebco-web-services/web-map-service
- Add maps to IIIF server, georeference and add to chapters
- Trace sources for images, add full documents to academic heritage website, and link to them
- Add support for more configurations (based on [this format](https://github.com/digidem/maplibre-storymap/blob/main/config.js.example))
- Add mode to interact with map
- Add credits
- Improve styling
- Add progress bar
- Add menu
