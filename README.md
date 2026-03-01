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

This app uses [SvelteKit](https://svelte.dev/tutorial/kit/introducing-sveltekit) as application framework.

Install dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
