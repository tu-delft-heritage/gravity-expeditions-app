<script lang="ts" module>
  export { default as a } from "$lib/components/Link.svelte";
  export { default as img } from "$lib/components/Image.svelte";
</script>

<script lang="ts">
  let {
    title,
    description,
    children,
  }: {
    title: string;
    description: string;
    children: any;
  } = $props();
</script>

<div class="clear-both prose">
  <h1>{title}</h1>
  <p class="italic">{description}</p>
  {@render children?.()}
</div>
