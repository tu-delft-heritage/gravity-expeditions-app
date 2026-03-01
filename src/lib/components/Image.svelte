<script lang="ts">
  import type { HTMLImgAttributes } from "svelte/elements";

  let { src, alt }: HTMLImgAttributes = $props();
</script>

<figure>
  <img {src} {alt} />
  <figcaption>{alt}</figcaption>
</figure>
