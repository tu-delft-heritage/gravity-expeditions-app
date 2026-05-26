import {
  bbox,
  transformRotate,
  multiPolygon,
  bboxPolygon,
  center,
  getCoords,
  distance,
  lineString,
  rhumbDestination,
  point,
} from "@turf/turf";
import maplibregl from "maplibre-gl";
import type { GeoreferencedMap } from "@allmaps/annotation";

type BBox = [number, number, number, number];
type Coord = [number, number];

export const fetchJson = (url: string) =>
  fetch(url).then((resp) => resp.json());

export const getValueAsArray = <T>(value: T | T[]): T[] =>
  Array.isArray(value) ? value : [value];

// Need to take into account display ratio!
export const getNarrowBbox = (mapsBbox: BBox) => {
  const [xCenter, yCenter] = getCoords(center(bboxPolygon(mapsBbox))) as Coord;
  const [xMin, yMin, xMax, yMax] = mapsBbox;
  const distanceX = distance([xMin, yMin], [xMax, yMin]);
  const distanceY = distance([xMin, yMin], [xMin, yMax]);
  if (distanceX < distanceY) {
    const line = lineString([
      [xMin, yCenter],
      [xMax, yCenter],
    ]);
    return bbox(line) as BBox;
    // return [xCenter, yMin, xCenter, yMax]
  } else {
    const line = lineString([
      [xCenter, yMin],
      [xCenter, yMax],
    ]);
    return bbox(line) as BBox;
    // return [xMin, yCenter, xMax, yCenter]
  }
};

export const getAxisAlignedBboxAndCenter = (geoMasks, bearing: number) => {
  // Use first mask coordinate as pivot
  const pivot: Coord = geoMasks[0][0];

  // Create a MultiPolygon from the masks
  const polygons = geoMasks.map((geoMask) => [geoMask.concat([geoMask[0]])]);
  const multiPolygonFeature = multiPolygon(polygons);

  // Rotate this polygon, calculate bbox and center
  const rotatedPolygon = transformRotate(multiPolygonFeature, bearing, {
    pivot,
  });
  const rotatedBbox = bbox(rotatedPolygon) as BBox;
  const rotatedCenter = center(bboxPolygon(rotatedBbox));

  // Rotate back the center
  const viewportCenter = transformRotate(rotatedCenter, -bearing, { pivot });
  const viewportCenterCoord = getCoords(viewportCenter) as Coord;

  // Return bbox and center coords
  return {
    bounds: rotatedBbox,
    center: new maplibregl.LngLat(...viewportCenterCoord),
  };
};

let wiggleAngle = 2.5;

export const createFauxGeoreferencedMap = async (
  imageId: string,
  options: {
    bounds?: [number, number, number, number];
    region?: [number, number, number, number];
    center?: [number, number];
    bearing?: number;
    wiggle?: boolean;
  },
) => {
  let { region, bounds, center } = options;
  // if (!bounds) {
  // 	bounds = [-0.1, -0.1, 0.1, 0.1]
  // }
  if (!center) {
    center = [0, 0];
  }
  const imageInfo = await fetchJson(`${imageId}/info.json`);
  const { width, height } = imageInfo;
  let gcps;
  let [resourceX, resourceY, resourceWidth, resourceHeight] = [
    0,
    0,
    width,
    height,
  ];
  if (region) {
    [resourceX, resourceY, resourceWidth, resourceHeight] = region;
  }
  const resourceMask = [
    [resourceX, resourceY],
    [resourceX + resourceWidth, resourceY],
    [resourceX + resourceWidth, resourceY + resourceHeight],
    [resourceX, resourceY + resourceHeight],
  ];
  if (bounds) {
    let [xMin, yMin, xMax, yMax] = bounds;
    gcps = [
      {
        resource: [resourceX, resourceY + resourceHeight],
        geo: [xMin, yMin],
      },
      {
        resource: [resourceX + resourceWidth, resourceY],
        geo: [xMax, yMax],
      },
    ];
  } else {
    const landscape = resourceWidth > resourceHeight;
    let bearing = landscape ? -90 : 0;
    if (options.wiggle) {
      bearing = bearing + wiggleAngle;
      wiggleAngle = wiggleAngle * -1;
    }
    const centerX = Math.round(resourceX + resourceWidth / 2);
    const centerY = Math.round(resourceY + resourceHeight / 2);
    gcps = [
      {
        resource: [centerX, centerY],
        geo: center,
      },
      {
        resource: landscape ? [resourceX, centerY] : [centerX, resourceY],
        geo: getCoords(rhumbDestination(point(center), 100, bearing)),
      },
    ];
  }
  return {
    ["@context"]: "https://schemas.allmaps.org/map/2/context.json",
    id: imageId,
    type: "GeoreferencedMap",
    resource: {
      id: imageId,
      width,
      height,
      type: "ImageService3",
    },
    gcps,
    resourceMask,
    transformation: {
      type: "helmert",
    },
  } satisfies GeoreferencedMap;
};
