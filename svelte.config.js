import adapter from "@sveltejs/adapter-static";
import { mdsvex } from "mdsvex";
import { join } from "path";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    // adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
    // If your environment is not supported, or you settled on a specific environment, switch out the adapter.
    // See https://svelte.dev/docs/kit/adapters for more information about adapters.
    adapter: adapter({
      // default options are shown. On some platforms
      // these options are set automatically — see below
      pages: "build",
      assets: "build",
      fallback: undefined,
      precompress: false,
      strict: true,
    }),
    // router: {
    //   type: "hash",
    // },
  },
  preprocess: mdsvex({
    extensions: [".svx", ".md"],
    layout: {
      _: join(import.meta.dirname, "./src/lib/components/Section.svelte"),
    },
  }),
  extensions: [".svelte", ".svx", ".md"],
};

export default config;
