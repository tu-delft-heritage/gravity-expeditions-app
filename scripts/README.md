# Scripts

## `build-iiif.ts`

Build static IIIF Image API level 0 derivatives, IIIF Presentation manifests,
and a root IIIF collection from the images in `static/images`.

Run it with:

```sh
pnpm iiif
```

or directly:

```sh
node scripts/build-iiif.ts
```

The script writes output to `static/iiif` by default. Each image gets its own
IIIF Image API folder named after the source filename without the extension.
Each source subfolder gets a `manifest.json`, and `static/iiif/collection.json`
lists those manifests.

### Options

| Option | Default | Description |
| --- | --- | --- |
| `--force`, `-f` | off | Recreate existing image derivatives instead of skipping current ones. |
| `--id <uri>` | `PUBLIC_URL/iiif` | Public IIIF base URI used in `info.json`, manifests, and collection IDs. |
| `--input <path>` | `static/images` | Source image folder to scan recursively. |
| `--output <path>` | `static/iiif` | Output folder for IIIF derivatives and JSON files. |
| `--tile-size <pixels>` | `1024` | Tile width and height used for the image pyramid. |
| `--webp` | on | Generate WebP derivatives alongside JPEG and advertise WebP in `info.json`. |
| `--no-webp` | off | Generate JPEG derivatives only and omit WebP properties from `info.json`. |
| `--help`, `-h` | off | Print the CLI help text. |

`PUBLIC_URL` is read from the current environment first, then from `.env` if it
exists. If neither is set, IDs are rooted at `/iiif`.

### Examples

Regenerate everything, including WebP:

```sh
pnpm iiif -- --force
```

Generate JPEG-only derivatives:

```sh
pnpm iiif -- --no-webp
```

Use a deployment URL for all IIIF IDs:

```sh
PUBLIC_URL=https://tu-delft-heritage.github.io/gravity-expeditions-app pnpm iiif -- --force
```

Write to a temporary output folder:

```sh
node scripts/build-iiif.ts --input static/images/maps --output /tmp/gravity-iiif-maps
```

### Output Notes

- Full-image fixed sizes are generated under `full/<width>,<height>/0/default.jpg`
  and, when WebP is enabled, `default.webp`.
- The original image is generated under `full/max/0/default.jpg`.
- Tile pyramid outputs use explicit region folders such as
  `0,0,6335,2395/792,300/0/default.jpg`.
- `info.json` includes `tiles.width`, `tiles.height`, `sizes`, and, when WebP is
  enabled, `extraFormats` and `preferredFormats`.
- WebP has a maximum supported dimension. Oversized WebP derivatives are skipped
  per file, while supported fixed sizes and tiles are still generated as WebP.

### Performance

The generator renders each fixed size and each pyramid scale once per image,
then crops tiles from those rendered levels. This avoids repeatedly decoding and
resizing the original source image for every tile.
