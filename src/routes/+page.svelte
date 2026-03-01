<script lang="ts">
  import Map from "$lib/components/Map.svelte";
  import Scroller from "@sveltejs/svelte-scroller";
  import chapters from "$lib/utils";
  import { goto } from "$app/navigation";

  $inspect(chapters);

  let index: number = $state(0);
  let offset;
  let progress;
  let innerWidth: number = $state(0);
  let clientWidth: number = $state(0);
  let passage = $state(false);
  let destination: string | undefined = undefined;
  const padding = $derived({
    top: 25,
    bottom: 25,
    left: innerWidth > clientWidth ? clientWidth : 25,
    right: 25,
  });

  const setPassage = (e: MouseEvent) => {
    const element = e.target as HTMLAnchorElement;
    const href = element?.getAttribute("href");
    passage = true;
    if (href) {
      destination = href.slice(1);
    }
  };

  const currentChapter = $derived(chapters[index]);
  const currentSlug = $derived(currentChapter.slug);
  const currentWarpedMaps = $derived(currentChapter?.warpedMaps);
  const currentLocation = $derived({ ...currentChapter?.location, padding });

  const firstChapter = $derived(chapters[0]);
  const lastChapter = $derived(chapters[chapters.length - 1]);
  const previousChapter = $derived(chapters[index - 1]);
  const nextChapter = $derived(chapters[index + 1]);

  $inspect(currentChapter);
  $inspect(currentLocation);

  $effect(() => {
    const arrived = currentSlug === destination;
    if (arrived) {
      passage = false;
      destination = undefined;
    }
  });

  $effect(() => {
    if (!passage) {
      goto("#" + currentChapter.slug);
    }
  });
</script>

<svelte:window bind:innerWidth />

<svelte:head>
  <title>{firstChapter.title}</title>
  <meta name="description" content={firstChapter.description} />
</svelte:head>

<Scroller top={0} bottom={0} bind:index bind:offset bind:progress>
  <div
    class="fixed top-0 left-0 h-screen w-screen pointer-events-auto"
    slot="background"
  >
    <Map warpedMaps={currentWarpedMaps} location={currentLocation} />
  </div>

  <div
    bind:clientWidth
    class="p-5 min-w-80 max-w-150 pointer-events-none"
    slot="foreground"
  >
    {#each chapters as chapter, index}
      {@const Component = chapter.Component}
      {@const isTop = index === 0}
      <div class="pb-5" id={chapter.slug}></div>
      <section
        class=" bg-white/80 rounded-xl shadow-xl p-5 pointer-events-auto"
      >
        <p class="float-right uppercase font-light pb-5">
          {#if previousChapter}
            <a href="#{previousChapter.slug}">Previous</a> |
          {/if}
          <a
            onclick={setPassage}
            href="#{isTop ? lastChapter.slug : firstChapter.slug}"
            >{isTop ? "bottom" : "top"}</a
          >
          {#if nextChapter}
            | <a href="#{nextChapter.slug}">Next</a>
          {/if}
        </p>
        <Component />
        {#if index === 0}
          <div class="prose pt-10">
            <h2>Chapters</h2>
            {#each chapters as chapter, index}
              <a
                onclick={setPassage}
                class="pr-5 inline-block whitespace-nowrap"
                href="#{chapter.slug}">{index + 1}. {chapter.title}</a
              >
            {/each}
          </div>
        {/if}
      </section>
      {#if index < chapters.length - 1}
        <div class="h-[120vh]"></div>
      {/if}
    {/each}
    <div id="bottom"></div>
  </div>
</Scroller>
