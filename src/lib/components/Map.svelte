<script lang="ts">
  import { onMount } from "svelte";
  import maplibregl from "maplibre-gl";
  import { WarpedMapLayer } from "@allmaps/maplibre";
  import "maplibre-gl/dist/maplibre-gl.css";
  import style from "./style";

  const { warpedMaps, location } = $props();

  let map: maplibregl.Map;
  let container: HTMLElement;
  let loaded = $state(false);

  const warpedMapLayer = new WarpedMapLayer();

  $inspect(warpedMaps);

  $effect(() => {
    if (loaded && location) {
      map.flyTo({
        ...location,
        zoom: 6,
        duration: 5000,
      });
    }
  });

  $effect(async () => {
    if (loaded && warpedMaps && warpedMaps.length) {
      warpedMapLayer.clear();
      await Promise.all(
        warpedMaps.map((warpedMap) => {
          return warpedMapLayer.addGeoreferenceAnnotationByUrl(
            warpedMap.annotationUrl,
          );
        }),
      );
      if (location) {
        map.flyTo(location);
      } else {
        const bounds = warpedMapLayer.getBounds();

        if (bounds) {
          map.fitBounds(bounds, {
            // padding,
          });
        }
      }
    }
  });

  onMount(() => {
    map = new maplibregl.Map({
      container,
      style,
      // style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      maxPitch: 0,
      zoom: 8,
    });

    map.on("error", (event) => {
      console.error("MapLibre error", event.error);
    });

    map.on("load", () => {
      map.addLayer(warpedMapLayer);
      loaded = true;
    });
  });
</script>

<div class="h-full w-full" bind:this={container}></div>
