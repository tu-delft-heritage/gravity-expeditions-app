<script lang="ts">
  import Map from "$lib/components/Map.svelte";
  import chapters from "$lib/shared/chapters";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { DEFAULT_SOURCES } from "$lib/shared/settings";
  import { getGeoJsonLayers } from "$lib/shared/geojson";

  let initialHash: string | undefined = $state(undefined);
  let index: number = $state(0);
  let loaded: boolean = $state(false);
  let offset;
  let progress;
  let scrollContainer: HTMLDivElement;
  let innerWidth: number = $state(0);
  let offsetHeight: number = $state(0);
  let clientWidth: number = $state(0);
  let passage = $derived(initialHash ? true : false);
  let destination: string | undefined = $derived(initialHash || undefined);
  let visibleElements: string[] = $state(new Array());
  let isDarkMode: boolean | undefined = $state(undefined);

  // WIP!
  let layers = Object.keys(DEFAULT_SOURCES).flatMap((sourceId) =>
    getGeoJsonLayers(sourceId, "visible"),
  );

  const padding = $derived({
    top: 25,
    bottom: 25,
    left: 25,
    // left: innerWidth > clientWidth ? clientWidth : 25,
    right: 25,
  });

  // Currently unused
  let init: boolean = $state(false);
  let highlight: string | undefined = $state(undefined);

  const currentChapter = $derived(chapters[index]);
  const currentSlug = $derived(currentChapter.slug);
  const currentWarpedMaps = $derived(currentChapter?.warpedMaps);
  const currentLocation = $derived({ ...currentChapter?.location, padding });

  const firstChapter = $derived(chapters[0]);
  const lastChapter = $derived(chapters[chapters.length - 1]);
  const previousChapter = $derived(chapters[index - 1]);
  const nextChapter = $derived(chapters[index + 1]);

  // $inspect(currentChapter);
  // $inspect(currentLocation);
  // $inspect(visibleElements);

  const scrollIntoView = (slug: string) => {
    const elem = scrollContainer.querySelector(`[data-id=${slug}]`);
    elem?.scrollIntoView({ behavior: "smooth" });
  };

  $effect(() => {
    if (loaded) {
      window.location.hash = currentSlug;
    }
  });

  onMount(() => {
    try {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      isDarkMode = media.matches;
      media.addEventListener("change", (event) => {
        isDarkMode = event.matches;
      });
    } catch {
      isDarkMode = false;
    }

    const initialHash = window.location.hash.slice(1);
    if (initialHash) {
      scrollIntoView(initialHash);
    }
    // IntersectionObserver
    const options = {
      root: scrollContainer,
      rootMargin: "-50%",
      // scrollMargin: "0px",
      threshold: 0,
    };
    const callback = (
      entries: IntersectionObserverEntry[],
      observer: IntersectionObserver,
    ) => {
      visibleElements = [];
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const elem = entry.target as HTMLElement;
          const currentIndex = Number(elem.dataset.index);
          const slug = elem.getAttribute("id");
          if (slug) {
            visibleElements.push(slug);
          }
          index = currentIndex;
        }
      });
    };
    const observer = new IntersectionObserver(callback, options);
    const sections = scrollContainer.querySelectorAll("section");
    sections.forEach((element) => {
      observer.observe(element);
    });
    loaded = true;
  });
</script>

<svelte:window bind:innerWidth />

<svelte:head>
  <title>{firstChapter.title}</title>
  <meta name="description" content={firstChapter.description} />
</svelte:head>

<div
  class="h-app-screen w-screen grid grid-cols-1 grid-rows-2 md:grid-rows-1 md:grid-cols-[1fr_480px] xl:grid-cols-[1fr_600px]"
>
  <div class="min-h-0 md:row-span-full">
    {#if isDarkMode !== undefined}
      {#key isDarkMode}
        <Map
          {chapters}
          {index}
          {isDarkMode}
          sources={DEFAULT_SOURCES}
          {layers}
          anticipate
        />
      {/key}
    {/if}
  </div>

  <div
    bind:clientWidth
    bind:offsetHeight
    bind:this={scrollContainer}
    class="row-start-2 min-h-0 bg-white/80 dark:bg-black/80 text-black dark:text-white pl-5 pr-5 overflow-auto md:row-start-1"
  >
    {#each chapters as chapter, index}
      {@const Component = chapter.Component}
      {@const isTop = index === 0}
      {@const isActive = currentSlug === chapter.slug}
      <section
        class="pt-5 pb-5 min-h-[60%] {isActive
          ? 'opacity-100'
          : 'opacity-40'} transition-opacity"
        data-index={index}
        data-id={chapter.slug}
      >
        <Component />
        {#if index === 0}
          <div class="pt-10">
            <h2>Chapters</h2>
            {#each chapters as chapter, index}
              <button
                onclick={() => scrollIntoView(chapter.slug)}
                class="p-1 mr-5 font-medium cursor-pointer hover:bg-blue-300 inline-block whitespace-nowrap"
                >{index + 1}. {chapter.title}</button
              >
            {/each}
          </div>
        {/if}
      </section>
    {/each}
  </div>
</div>
