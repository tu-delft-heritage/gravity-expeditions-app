# Gravity Expeditions at Sea

Application presenting the expeditions of Dutch geophysicist and geodesist Felix Andries Vening Meinesz (1887-1966). Originally published in 2014 as part of [Expeditie Wikipedia](https://expeditiewikipedia.nl/).

Links:

- [Stichting Academisch Erfgoed](https://www.academischerfgoed.nl/projecten/de-grote-wikipedia-expeditie/)
- [Wikipedia](https://nl.wikipedia.org/wiki/Wikipedia:GLAM/Expedities)

## Todo

- [ ] Create Protomaps version of bathymetric chart:
  - https://github.com/shiwaku/gebco-2025-grid-tile-on-maplibre/tree/main?tab=readme-ov-file
  - https://www.gebco.net/data-products/gridded-bathymetry-data
  - https://www.gebco.net/data-products/gebco-web-services/web-map-service
- [ ] Add maps to IIIF server, georeference and add to chapters
- [ ] Trace sources for images, add full documents to academic heritage website, and link to them
- [ ] Add support for more configurations (based on [this format](https://github.com/digidem/maplibre-storymap/blob/main/config.js.example))
- [ ] Add mode to interact with map
- [ ] Add credits
- [ ] Improve styling
- [ ] Add progress bar
- [ ] Add menu

## Inspired by

- [Reuzenarbeid](https://tu-delft-heritage.github.io/reuzenarbeid/)
- [City Atlas](https://cityatlas.theberlage.nl/)
- [Interactive Storytelling with MapLibre](https://github.com/digidem/maplibre-storymap/)

## Developing

Content for [Allmaps Slides](https://github.com/allmaps/slides). Use Node 24 and pnpm 10; run these commands from the Slides repository:

```sh
git clone --recurse-submodules https://github.com/allmaps/slides.git
cd slides
pnpm install
pnpm exec slides iiif ./content/gravity-at-sea
pnpm exec slides thumbnails ./content/gravity-at-sea
pnpm exec slides dev ./content/gravity-at-sea
```

Edit `content/gravity-at-sea/slideshows/` and `slides.config.yml`. Repeat the image commands when their sources change.

The expedition route is a shared `sources.route` in `slides.config.yml`. Edit
`assets/geojson/route.geojson` for its geometry and SimpleStyle properties
(`stroke`, `stroke-width`, `stroke-opacity`); these also appear in slide thumbnails.

## Building

```sh
pnpm exec slides build ./content/gravity-at-sea
pnpm exec slides preview ./content/gravity-at-sea
```

Pushes to `main` deploy to GitHub Pages using the shared Slides app. The workflow caches IIIF images and thumbnails; `SLIDES_REF` can select a framework revision.
