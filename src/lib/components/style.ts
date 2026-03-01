import type { StyleSpecification } from "maplibre-gl";
import baseUrl from "$lib/base-url";

const style: StyleSpecification = {
  version: 8,
  sources: {
    gebco: {
      type: "raster",
      tiles: [
        "https://wms.gebco.net/mapserv?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=gebco_latest&STYLES=&CRS=EPSG:3857&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true&BBOX={bbox-epsg-3857}",
      ],
      tileSize: 256,
    },
    route: {
      type: "geojson",
      data: `${baseUrl}/geojson/route.geojson`,
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#00131d",
      },
    },
    {
      id: "gebco-raster",
      type: "raster",
      source: "gebco",
      paint: {
        "raster-opacity": 0.95,
      },
    },
    {
      id: "route",
      type: "line",
      source: "route",
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#888",
        "line-width": 8,
      },
    },
  ],
};

export default style;
