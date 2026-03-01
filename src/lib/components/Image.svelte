<script lang="ts">
  import type { HTMLImgAttributes } from "svelte/elements";
  import baseUrl from "$lib/base-url";

  let { src, alt }: HTMLImgAttributes = $props();
  src = baseUrl + src;
</script>

<figure>
  <img {src} {alt} />
  <figcaption>{alt}</figcaption>
</figure>
