<script lang="ts">
  import type { HTMLImgAttributes } from "svelte/elements";
  import baseUrl from "$lib/shared/base-url";

  let { src, alt }: HTMLImgAttributes = $props();
  src = baseUrl + src;
</script>

<figure>
  <img {src} {alt} />
  <figcaption>{@html alt}</figcaption>
</figure>
