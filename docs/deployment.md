# Deploy Gravity at Sea

Select **GitHub Actions** under repository **Settings → Pages**. Pushes to `main`
then build and deploy the site. The workflow reads the configured Pages URL,
installs the exact Slides version in `package.json` using `pnpm-lock.yaml`, and
builds under Xvfb after installing the renderer's Ubuntu libraries.

Run locally with Node.js 24 and pnpm 10.22.0:

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm validate
pnpm build
```

To upgrade Slides, run `pnpm add -D -E @allmaps/slides@<version>`, check the build,
and commit `package.json` and `pnpm-lock.yaml`. The `SLIDES_REF` variable is no
longer used. The Pages workflow offers independent cache reset options for IIIF,
annotations and thumbnails. It saves completed cache work even if the build fails.

See [Slides deployment](https://github.com/allmaps/slides/blob/main/docs/deployment.md)
for URL settings and hosting outside GitHub Pages.
