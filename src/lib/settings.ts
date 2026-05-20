import type { MapLibreWarpedMapLayerOptions } from "@allmaps/maplibre";
import baseUrl from "$lib/base-url";

export const DURATION = 4000;
export const PADDING = 25;
export const FLAVOR = "dark";
export const LOCALE = "en";
export const ANIMATE = true;

export const COLORS = {
  green: {
    stroke: "#64c18f",
    fill: "#c1e6d2",
  },
  purple: {
    stroke: "#c552b5",
    fill: "#e8bae1",
  },
  red: {
    stroke: "#fe5e60",
    fill: "#ffbfbf",
  },
  yellow: {
    stroke: "#ffc742",
    fill: "#ffe9b3",
  },
  orange: {
    stroke: "#ff7415",
    fill: "#ffc7a1",
  },
  pink: {
    stroke: "#ff56ba",
    fill: "#ffbbe3",
  },
  blue: {
    stroke: "#63d8e6",
    fill: "#c1eff5",
  },
};

// https://github.com/allmaps/allmaps/blob/main/packages/render/src/shared/types.ts#L39
export const DEFAULT_OPTIONS: Partial<MapLibreWarpedMapLayerOptions> = {
  applyMask: true,
  colorize: false,
  removeColor: false,
  saturation: 1,
  renderFullMask: false,
  renderMask: false,
  renderGcps: false,
  renderTransformedGcps: false,
  renderVectors: false,
  renderGrid: false,
  transformationType: undefined,
  distortionMeasure: undefined,
};

export const SOURCES = {
  route: {
    type: "geojson",
    data: "${baseUrl}/geojson/route.geojson",
  },
};

export const LAYERS = [
  {
    id: "route",
    type: "line",
    source: "route",
    layout: {
      "line-join": "round",
      "line-cap": "round",
    },
    paint: {
      "line-color": COLORS.green.stroke,
      "line-width": 8,
    },
  },
];
