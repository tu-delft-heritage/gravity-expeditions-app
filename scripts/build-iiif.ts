#!/usr/bin/env node

import {
  access,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { IIIFBuilder } from "@iiif/builder";
import sharp from "sharp";

type CliOptions = {
  force: boolean;
  idBase: string;
  publicUrl: string;
  inputRoot: string;
  outputRoot: string;
  outputFormats: OutputFormat[];
  tileSize: number;
};

type ImageServiceInfo = {
  "@context": string;
  id: string;
  type: "ImageService3";
  profile: "level0";
  protocol: string;
  extraFormats?: string[];
  preferredFormats?: string[];
  tiles?: Array<{
    scaleFactors?: number[];
    width?: number;
    height?: number;
  }>;
  sizes?: Array<{
    width: number;
    height: number;
  }>;
  width: number;
  height: number;
};

type ImageSize = {
  width: number;
  height: number;
};

type OutputFormat = "jpg" | "webp";

type Tile = {
  region: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  outputSize: ImageSize;
};

type RawImage = ImageSize & {
  data: Uint8Array;
  channels: number;
};

type ImageFile = {
  absolutePath: string;
  relativePath: string;
  relativeDir: string;
  filename: string;
  stem: string;
  sourceId: string;
  outputDir: string;
  infoPath: string;
  serviceBaseId: string;
  expectedInfoId: string;
  mimeType: string;
};

type ProcessedImage = ImageFile & {
  info: ImageServiceInfo;
  thumbnail: {
    id: string;
    type: "Image";
    format: string;
    width: number;
    height: number;
  };
};

const DEFAULT_INPUT_ROOT = "static/images";
const DEFAULT_OUTPUT_ROOT = "static/iiif";
const DEFAULT_TILE_SIZE = 1024;
const FIRST_FIXED_SIZE = 512;
const JPEG_QUALITY = 90;
const WEBP_QUALITY = 90;
const WEBP_MAX_DIMENSION = 16_383;
const DEFAULT_OUTPUT_FORMAT: OutputFormat = "jpg";
const DEFAULT_ENABLE_WEBP = true;

const IMAGE_EXTENSIONS = new Map<string, string>([
  [".avif", "image/avif"],
  [".gif", "image/gif"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".tif", "image/tiff"],
  [".tiff", "image/tiff"],
  [".webp", "image/webp"],
]);

function showHelp() {
  console.log(`Usage: node scripts/build-iiif.ts [options]

Create static IIIF Image API level 0 derivatives for images in static/images.

Options:
  --force, -f             Recreate existing image derivatives
  --id <uri>              Public IIIF base URI (default: PUBLIC_URL/iiif)
  --input <path>          Source image folder (default: static/images)
  --output <path>         IIIF output folder (default: static/iiif)
  --tile-size <pixels>    Tile size passed to sharp (default: 1024)
  --webp                  Generate WebP derivatives alongside JPEG (default)
  --no-webp               Generate JPEG derivatives only
  --help, -h              Show this help message

PUBLIC_URL is read from the current environment, then from .env if present.`);
}

function normalizePublicBase(value: string) {
  return value.replace(/\/+$/, "") || "/";
}

function joinPublicId(base: string, ...segments: string[]) {
  const cleanBase = normalizePublicBase(base);
  const cleanSegments = segments
    .flatMap((segment) => segment.split(/[\\/]+/))
    .filter(Boolean);

  if (!cleanSegments.length) {
    return cleanBase;
  }

  if (cleanBase === "/") {
    return `/${cleanSegments.join("/")}`;
  }

  return `${cleanBase}/${cleanSegments.join("/")}`;
}

function folderLabel(relativeDir: string) {
  if (relativeDir === ".") return "Images";

  return relativeDir
    .split(/[\\/]+/)
    .at(-1)!
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function imageLabel(stem: string) {
  return stem.replace(/[-_]+/g, " ");
}

function getMimeType(filename: string) {
  const extension = path.extname(filename).toLowerCase();
  return IMAGE_EXTENSIONS.get(extension);
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received "${value}"`);
  }

  return parsed;
}

function getOutputFormats(enableWebp: boolean): OutputFormat[] {
  return enableWebp ? [DEFAULT_OUTPUT_FORMAT, "webp"] : [DEFAULT_OUTPUT_FORMAT];
}

function parseEnvValue(value: string) {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

async function getPublicUrl() {
  if (process.env.PUBLIC_URL !== undefined) {
    return normalizePublicBase(process.env.PUBLIC_URL);
  }

  try {
    const envFile = await readFile(path.resolve(".env"), "utf8");
    const publicUrlMatch = envFile
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*(?:export\s+)?PUBLIC_URL\s*=\s*(.*)\s*$/))
      .find((match) => match);

    if (publicUrlMatch) {
      return normalizePublicBase(parseEnvValue(publicUrlMatch[1] ?? ""));
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return "/";
    }

    throw error;
  }

  return "/";
}

function parseCliOptions(publicUrl: string): CliOptions {
  const args = process.argv.slice(2);
  const normalizedArgs = args[0] === "--" ? args.slice(1) : args;

  const { values } = parseArgs({
    args: normalizedArgs,
    options: {
      force: {
        type: "boolean",
        short: "f",
      },
      help: {
        type: "boolean",
        short: "h",
      },
      id: {
        type: "string",
      },
      input: {
        type: "string",
      },
      output: {
        type: "string",
      },
      "tile-size": {
        type: "string",
      },
      webp: {
        type: "boolean",
      },
      "no-webp": {
        type: "boolean",
      },
    },
  });

  if (values.help) {
    showHelp();
    process.exit(0);
  }

  if (values.webp === true && values["no-webp"] === true) {
    throw new Error('Use either "--webp" or "--no-webp", not both.');
  }

  const enableWebp = values["no-webp"]
    ? false
    : (values.webp ?? DEFAULT_ENABLE_WEBP);

  return {
    force: values.force ?? false,
    idBase: normalizePublicBase(values.id ?? joinPublicId(publicUrl, "iiif")),
    publicUrl,
    inputRoot: path.resolve(values.input ?? DEFAULT_INPUT_ROOT),
    outputRoot: path.resolve(values.output ?? DEFAULT_OUTPUT_ROOT),
    outputFormats: getOutputFormats(enableWebp),
    tileSize: parsePositiveInteger(values["tile-size"], DEFAULT_TILE_SIZE),
  };
}

async function findImageFiles(
  inputRoot: string,
  outputRoot: string,
  idBase: string,
  publicUrl: string,
) {
  const files: ImageFile[] = [];

  async function walk(directory: string) {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) continue;

      const mimeType = getMimeType(entry.name);
      if (!mimeType) continue;

      const relativePath = path.relative(inputRoot, absolutePath);
      const relativeDir = path.dirname(relativePath);
      const stem = path.parse(entry.name).name;
      const outputDir = path.join(outputRoot, relativeDir, stem);
      const publicFolderId = joinPublicId(
        idBase,
        relativeDir === "." ? "" : relativeDir,
      );
      const expectedInfoId = joinPublicId(publicFolderId, stem);

      files.push({
        absolutePath,
        relativePath,
        relativeDir,
        filename: entry.name,
        stem,
        sourceId: joinPublicId(
          publicUrl,
          "images",
          relativeDir === "." ? "" : relativeDir,
          entry.name,
        ),
        outputDir,
        infoPath: path.join(outputDir, "info.json"),
        serviceBaseId: publicFolderId,
        expectedInfoId,
        mimeType,
      });
    }
  }

  await walk(inputRoot);

  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function assertUniqueDerivativePaths(files: ImageFile[]) {
  const sourcesByOutputDir = new Map<string, string[]>();

  for (const file of files) {
    const sources = sourcesByOutputDir.get(file.outputDir) ?? [];
    sources.push(file.relativePath);
    sourcesByOutputDir.set(file.outputDir, sources);
  }

  const conflicts = [...sourcesByOutputDir.entries()].filter(
    ([, sources]) => sources.length > 1,
  );

  if (conflicts.length) {
    const details = conflicts
      .map(([, sources]) => `- ${sources.join(", ")}`)
      .join("\n");
    throw new Error(
      `Multiple source images would create the same IIIF id:\n${details}`,
    );
  }
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

async function readInfoJson(infoPath: string) {
  const contents = await readFile(infoPath, "utf8");
  return JSON.parse(contents) as ImageServiceInfo;
}

function getImageSize(metadata: sharp.Metadata): ImageSize {
  if (!metadata.width || !metadata.height) {
    throw new Error("Could not read image width and height");
  }

  return {
    width: metadata.width,
    height: metadata.height,
  };
}

function getScaleFactors({ width, height }: ImageSize, tileSize: number) {
  const scaleFactors: number[] = [];
  let scaleFactor = 1;

  while (true) {
    scaleFactors.push(scaleFactor);

    if (
      Math.ceil(width / scaleFactor) <= tileSize &&
      Math.ceil(height / scaleFactor) <= tileSize
    ) {
      break;
    }

    scaleFactor *= 2;
  }

  return scaleFactors;
}

function getScaledSize({ width, height }: ImageSize, maxDimension: number) {
  const imageMaxDimension = Math.max(width, height);
  const scale = maxDimension / imageMaxDimension;

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function getFixedSizes(size: ImageSize) {
  const maxDimension = Math.max(size.width, size.height);
  const sizes: ImageSize[] = [];

  for (
    let fixedSize = FIRST_FIXED_SIZE;
    fixedSize < maxDimension;
    fixedSize *= 2
  ) {
    sizes.push(getScaledSize(size, fixedSize));
  }

  return sizes;
}

function getTiles(size: ImageSize, tileSize: number, scaleFactor: number) {
  const tiles: Tile[] = [];
  const sourceTileSize = tileSize * scaleFactor;

  for (let top = 0; top < size.height; top += sourceTileSize) {
    for (let left = 0; left < size.width; left += sourceTileSize) {
      const width = Math.min(sourceTileSize, size.width - left);
      const height = Math.min(sourceTileSize, size.height - top);

      tiles.push({
        region: {
          left,
          top,
          width,
          height,
        },
        outputSize: {
          width: Math.ceil(width / scaleFactor),
          height: Math.ceil(height / scaleFactor),
        },
      });
    }
  }

  return tiles;
}

function getTileRegionSegment(tile: Tile) {
  const { left, top, width, height } = tile.region;
  return `${left},${top},${width},${height}`;
}

function getSizeSegment(size: ImageSize) {
  return `${size.width},${size.height}`;
}

function getOutputFilename(format: OutputFormat) {
  return `default.${format}`;
}

function canWriteFormat(format: OutputFormat, size: ImageSize) {
  return (
    format === "jpg" ||
    (size.width <= WEBP_MAX_DIMENSION && size.height <= WEBP_MAX_DIMENSION)
  );
}

function getWritableFormats(size: ImageSize, outputFormats: OutputFormat[]) {
  return outputFormats.filter((format) => canWriteFormat(format, size));
}

function getFullMaxPath(file: ImageFile, format = DEFAULT_OUTPUT_FORMAT) {
  return path.join(
    file.outputDir,
    "full",
    "max",
    "0",
    getOutputFilename(format),
  );
}

function getFixedSizePath(
  file: ImageFile,
  size: ImageSize,
  format = DEFAULT_OUTPUT_FORMAT,
) {
  return path.join(
    file.outputDir,
    "full",
    getSizeSegment(size),
    "0",
    getOutputFilename(format),
  );
}

function getTilePath(
  file: ImageFile,
  tile: Tile,
  format = DEFAULT_OUTPUT_FORMAT,
) {
  return path.join(
    file.outputDir,
    getTileRegionSegment(tile),
    getSizeSegment(tile.outputSize),
    "0",
    getOutputFilename(format),
  );
}

function createInfoJson(
  file: ImageFile,
  size: ImageSize,
  options: CliOptions,
): ImageServiceInfo {
  const scaleFactors = getScaleFactors(size, options.tileSize);
  const info: ImageServiceInfo = {
    "@context": "http://iiif.io/api/image/3/context.json",
    id: file.expectedInfoId,
    type: "ImageService3",
    profile: "level0",
    protocol: "http://iiif.io/api/image",
    tiles: [
      {
        scaleFactors,
        width: options.tileSize,
        height: options.tileSize,
      },
    ],
    sizes: getFixedSizes(size),
    width: size.width,
    height: size.height,
  };

  if (options.outputFormats.includes("webp")) {
    info.extraFormats = ["webp"];
    info.preferredFormats = ["webp", "jpg"];
  }

  return info;
}

async function getExpectedInfo(file: ImageFile, options: CliOptions) {
  const metadata = await sharp(file.absolutePath, {
    limitInputPixels: false,
  }).metadata();

  return createInfoJson(file, getImageSize(metadata), options);
}

function getExpectedTilePaths(
  file: ImageFile,
  info: ImageServiceInfo,
  outputFormats: OutputFormat[],
) {
  const scaleFactors = info.tiles?.[0]?.scaleFactors ?? [];
  const imageSize = {
    width: info.width,
    height: info.height,
  };

  return scaleFactors.flatMap((scaleFactor) => {
    const tiles = getTiles(
      imageSize,
      info.tiles?.[0]?.width ?? DEFAULT_TILE_SIZE,
      scaleFactor,
    );

    return tiles.flatMap((tile) =>
      getWritableFormats(tile.outputSize, outputFormats).map((format) =>
        getTilePath(file, tile, format),
      ),
    );
  });
}

function getExpectedDerivativePaths(
  file: ImageFile,
  info: ImageServiceInfo,
  outputFormats: OutputFormat[],
) {
  const imageSize = {
    width: info.width,
    height: info.height,
  };

  return [
    ...getWritableFormats(imageSize, outputFormats).map((format) =>
      getFullMaxPath(file, format),
    ),
    ...(info.sizes ?? []).flatMap((size) =>
      getWritableFormats(size, outputFormats).map((format) =>
        getFixedSizePath(file, size, format),
      ),
    ),
    ...getExpectedTilePaths(file, info, outputFormats),
  ];
}

function normalizeInfoForComparison(info: ImageServiceInfo, id = info.id) {
  const normalized: ImageServiceInfo = {
    "@context": info["@context"],
    id,
    type: info.type,
    profile: info.profile,
    protocol: info.protocol,
    tiles: info.tiles,
    sizes: info.sizes,
    width: info.width,
    height: info.height,
  };

  if (info.extraFormats) {
    normalized.extraFormats = info.extraFormats;
  }

  if (info.preferredFormats) {
    normalized.preferredFormats = info.preferredFormats;
  }

  return normalized;
}

function isInfoCurrent(actual: ImageServiceInfo, expected: ImageServiceInfo) {
  return (
    JSON.stringify(normalizeInfoForComparison(actual, expected.id)) ===
    JSON.stringify(normalizeInfoForComparison(expected))
  );
}

async function isDerivativeCurrent(
  file: ImageFile,
  actualInfo: ImageServiceInfo,
  expectedInfo: ImageServiceInfo,
  outputFormats: OutputFormat[],
) {
  if (!isInfoCurrent(actualInfo, expectedInfo)) {
    return false;
  }

  const expectedPaths = getExpectedDerivativePaths(
    file,
    expectedInfo,
    outputFormats,
  );

  for (const expectedPath of expectedPaths) {
    if (!(await fileExists(expectedPath))) {
      return false;
    }
  }

  return true;
}

async function createRawImage(sourcePath: string, size: ImageSize) {
  const { data, info } = await sharp(sourcePath, { limitInputPixels: false })
    .resize(size.width, size.height, { fit: "fill" })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    data,
    width: info.width,
    height: info.height,
    channels: info.channels,
  };
}

async function writeRawDerivativeImage(
  image: RawImage,
  outputPath: string,
  format: OutputFormat,
  extract?: sharp.Region,
) {
  await mkdir(path.dirname(outputPath), { recursive: true });

  let pipeline = sharp(image.data, {
    raw: {
      width: image.width,
      height: image.height,
      channels: image.channels,
    },
  });

  if (extract) {
    pipeline = pipeline.extract(extract);
  }

  if (format === "webp") {
    await pipeline.webp({ quality: WEBP_QUALITY }).toFile(outputPath);
  } else {
    await pipeline.jpeg({ quality: JPEG_QUALITY }).toFile(outputPath);
  }
}

async function writeRawDerivativeImages(
  image: RawImage,
  outputPathForFormat: (format: OutputFormat) => string,
  outputSize: ImageSize,
  outputFormats: OutputFormat[],
  extract?: sharp.Region,
) {
  for (const format of getWritableFormats(outputSize, outputFormats)) {
    await writeRawDerivativeImage(
      image,
      outputPathForFormat(format),
      format,
      extract,
    );
  }
}

async function writeFixedSizeDerivatives(
  file: ImageFile,
  info: ImageServiceInfo,
  outputFormats: OutputFormat[],
) {
  const imageSize = {
    width: info.width,
    height: info.height,
  };
  const fullImage = await createRawImage(file.absolutePath, imageSize);

  await writeRawDerivativeImages(
    fullImage,
    (format) => getFullMaxPath(file, format),
    imageSize,
    outputFormats,
  );

  for (const size of info.sizes ?? []) {
    const resizedImage = await createRawImage(file.absolutePath, size);

    await writeRawDerivativeImages(
      resizedImage,
      (format) => getFixedSizePath(file, size, format),
      size,
      outputFormats,
    );
  }
}

function getLevelSize(size: ImageSize, scaleFactor: number) {
  return {
    width: Math.ceil(size.width / scaleFactor),
    height: Math.ceil(size.height / scaleFactor),
  };
}

function getLevelTileRegion(
  levelSize: ImageSize,
  tile: Tile,
  scaleFactor: number,
) {
  const left = Math.floor(tile.region.left / scaleFactor);
  const top = Math.floor(tile.region.top / scaleFactor);

  return {
    left,
    top,
    width: Math.min(tile.outputSize.width, levelSize.width - left),
    height: Math.min(tile.outputSize.height, levelSize.height - top),
  };
}

async function writeTileDerivatives(
  file: ImageFile,
  info: ImageServiceInfo,
  tileSize: number,
  outputFormats: OutputFormat[],
) {
  const imageSize = {
    width: info.width,
    height: info.height,
  };
  const scaleFactors = info.tiles?.[0]?.scaleFactors ?? [];

  for (const scaleFactor of scaleFactors) {
    const levelSize = getLevelSize(imageSize, scaleFactor);
    const levelImage = await createRawImage(file.absolutePath, levelSize);

    for (const tile of getTiles(imageSize, tileSize, scaleFactor)) {
      const levelTileRegion = getLevelTileRegion(levelSize, tile, scaleFactor);

      await writeRawDerivativeImages(
        levelImage,
        (format) => getTilePath(file, tile, format),
        {
          width: levelTileRegion.width,
          height: levelTileRegion.height,
        },
        outputFormats,
        levelTileRegion,
      );
    }
  }
}

async function writeDerivatives(
  file: ImageFile,
  info: ImageServiceInfo,
  options: CliOptions,
) {
  await rm(file.outputDir, { recursive: true, force: true });
  await mkdir(file.outputDir, { recursive: true });
  await writeFixedSizeDerivatives(file, info, options.outputFormats);
  await writeTileDerivatives(
    file,
    info,
    options.tileSize,
    options.outputFormats,
  );
  await writeJson(file.infoPath, info);
}

function createThumbnail(info: ImageServiceInfo) {
  const thumbnailSize = info.sizes?.[0] ?? {
    width: info.width,
    height: info.height,
  };
  const sizeSegment = info.sizes?.[0] ? getSizeSegment(thumbnailSize) : "max";

  return {
    id: `${info.id}/full/${sizeSegment}/0/default.jpg`,
    type: "Image" as const,
    format: "image/jpeg",
    width: thumbnailSize.width,
    height: thumbnailSize.height,
  };
}

async function createTiles(file: ImageFile, options: CliOptions) {
  const expectedInfo = await getExpectedInfo(file, options);
  const derivativeExists = await fileExists(file.infoPath);

  if (derivativeExists && !options.force) {
    const currentInfo = await readInfoJson(file.infoPath);

    if (
      await isDerivativeCurrent(
        file,
        currentInfo,
        expectedInfo,
        options.outputFormats,
      )
    ) {
      if (currentInfo.id !== expectedInfo.id) {
        await writeJson(file.infoPath, expectedInfo);
        console.log(`update ${path.relative(process.cwd(), file.infoPath)} id`);
      }

      console.log(`skip   ${file.relativePath}`);
      return expectedInfo;
    }
  }

  await writeDerivatives(file, expectedInfo, options);

  const action = derivativeExists
    ? options.force
      ? "force "
      : "update"
    : "create";
  console.log(`${action} ${file.relativePath}`);

  return expectedInfo;
}

function createManifest(
  relativeDir: string,
  images: ProcessedImage[],
  options: CliOptions,
) {
  const builder = new IIIFBuilder();
  const folderId = joinPublicId(
    options.idBase,
    relativeDir === "." ? "" : relativeDir,
  );
  const manifestId = joinPublicId(folderId, "manifest.json");
  const manifest = builder.createManifest(manifestId, (manifestBuilder) => {
    manifestBuilder.addLabel(folderLabel(relativeDir), "en");

    const firstThumbnail = images[0]?.thumbnail;
    if (firstThumbnail) {
      manifestBuilder.addThumbnail(firstThumbnail);
    }

    for (const image of images) {
      const canvasId = joinPublicId(folderId, "canvas", image.stem);
      manifestBuilder.createCanvas(canvasId, (canvas) => {
        canvas.addLabel(imageLabel(image.stem), "none");
        canvas.width = image.info.width;
        canvas.height = image.info.height;
        canvas.addThumbnail(image.thumbnail);
        canvas.createAnnotation(`${canvasId}/annotation`, {
          id: `${canvasId}/annotation`,
          type: "Annotation",
          motivation: "painting",
          target: canvasId,
          body: {
            id: image.sourceId,
            type: "Image",
            format: image.mimeType,
            width: image.info.width,
            height: image.info.height,
            service: [
              {
                id: image.info.id,
                type: "ImageService3",
                profile: "level0",
              },
            ],
          },
        });
      });
    }
  });

  return {
    id: manifest.id,
    json: builder.toPresentation3({
      id: manifest.id,
      type: "Manifest",
    }),
  };
}

function createCollection(
  manifests: Array<{
    id: string;
    label: string;
    thumbnail?: ProcessedImage["thumbnail"];
  }>,
  options: CliOptions,
) {
  const builder = new IIIFBuilder();
  const collectionId = joinPublicId(options.idBase, "collection.json");
  const collection = builder.createCollection(
    collectionId,
    (collectionBuilder) => {
      collectionBuilder.addLabel("Gravity Expeditions Image Collection", "en");

      const firstThumbnail = manifests[0]?.thumbnail;
      if (firstThumbnail) {
        collectionBuilder.addThumbnail(firstThumbnail);
      }

      for (const manifest of manifests) {
        collectionBuilder.createManifest(manifest.id, (manifestBuilder) => {
          manifestBuilder.addLabel(manifest.label, "en");
          if (manifest.thumbnail) {
            manifestBuilder.addThumbnail(manifest.thumbnail);
          }
        });
      }
    },
  );

  return builder.toPresentation3({
    id: collection.id,
    type: "Collection",
  });
}

async function writeJson(filePath: string, data: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function groupImagesByFolder(images: ProcessedImage[]) {
  const imagesByFolder = new Map<string, ProcessedImage[]>();

  for (const image of images) {
    const imagesInFolder = imagesByFolder.get(image.relativeDir) ?? [];
    imagesInFolder.push(image);
    imagesByFolder.set(image.relativeDir, imagesInFolder);
  }

  return [...imagesByFolder.entries()].sort(([a], [b]) => a.localeCompare(b));
}

async function main() {
  const publicUrl = await getPublicUrl();
  const options = parseCliOptions(publicUrl);

  const files = await findImageFiles(
    options.inputRoot,
    options.outputRoot,
    options.idBase,
    options.publicUrl,
  );

  if (!files.length) {
    throw new Error(`No image files found in ${options.inputRoot}`);
  }

  assertUniqueDerivativePaths(files);

  console.log(`Found ${files.length} image files:`);
  files.forEach((file) => console.log(`- ${file.relativePath}`));

  const processedImages: ProcessedImage[] = [];
  for (const file of files) {
    const info = await createTiles(file, options);
    processedImages.push({
      ...file,
      info,
      thumbnail: createThumbnail(info),
    });
  }

  const manifestItems = [];

  for (const [relativeDir, images] of groupImagesByFolder(processedImages)) {
    const { id, json } = createManifest(relativeDir, images, options);
    const manifestPath = path.join(
      options.outputRoot,
      relativeDir,
      "manifest.json",
    );

    await writeJson(manifestPath, json);
    manifestItems.push({
      id,
      label: folderLabel(relativeDir),
      thumbnail: images[0]?.thumbnail,
    });
    console.log(`write  ${path.relative(process.cwd(), manifestPath)}`);
  }

  const collection = createCollection(manifestItems, options);
  const collectionPath = path.join(options.outputRoot, "collection.json");
  await writeJson(collectionPath, collection);
  console.log(`write  ${path.relative(process.cwd(), collectionPath)}`);
}

await main();
