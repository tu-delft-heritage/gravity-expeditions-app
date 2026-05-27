#!/usr/bin/env node

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { IIIFBuilder } from "@iiif/builder";
import sharp from "sharp";
import type { TileOptions } from "sharp";

type CliOptions = {
  force: boolean;
  idBase: string;
  publicUrl: string;
  inputRoot: string;
  outputRoot: string;
  tileSize: number;
};

type ImageServiceInfo = {
  "@context": string;
  id: string;
  type: "ImageService3";
  profile: "level0";
  protocol: string;
  tiles?: Array<{
    scaleFactors?: number[];
    width?: number;
    height?: number;
  }>;
  width: number;
  height: number;
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
    },
  });

  if (values.help) {
    showHelp();
    process.exit(0);
  }

  return {
    force: values.force ?? false,
    idBase: normalizePublicBase(
      values.id ?? joinPublicId(publicUrl, "iiif"),
    ),
    publicUrl,
    inputRoot: path.resolve(values.input ?? DEFAULT_INPUT_ROOT),
    outputRoot: path.resolve(values.output ?? DEFAULT_OUTPUT_ROOT),
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
    await readFile(filePath);
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

async function ensureInfoId(file: ImageFile, info: ImageServiceInfo) {
  if (info.id === file.expectedInfoId) {
    return info;
  }

  const updatedInfo = {
    ...info,
    id: file.expectedInfoId,
  };

  await writeJson(file.infoPath, updatedInfo);
  console.log(`update ${path.relative(process.cwd(), file.infoPath)} id`);

  return updatedInfo;
}

function createThumbnail(info: ImageServiceInfo) {
  const scaleFactors = info.tiles?.flatMap((tile) => tile.scaleFactors ?? []) ?? [
    1,
  ];
  const maxScaleFactor = Math.max(1, ...scaleFactors);
  const width = Math.ceil(info.width / maxScaleFactor);
  const height = Math.ceil(info.height / maxScaleFactor);

  return {
    id: `${info.id}/full/${width},${height}/0/default.jpg`,
    type: "Image" as const,
    format: "image/jpeg",
    width,
    height,
  };
}

async function createTiles(file: ImageFile, options: CliOptions) {
  const derivativeExists = await fileExists(file.infoPath);

  if (derivativeExists && !options.force) {
    console.log(`skip   ${file.relativePath}`);
    return ensureInfoId(file, await readInfoJson(file.infoPath));
  }

  if (derivativeExists && options.force) {
    await rm(file.outputDir, { recursive: true, force: true });
  }

  await mkdir(path.dirname(file.outputDir), { recursive: true });

  const tileOptions: TileOptions = {
    id: file.serviceBaseId,
    layout: "iiif3",
    size: options.tileSize,
  };

  await sharp(file.absolutePath, { limitInputPixels: false })
    .tile(tileOptions)
    .toFile(file.outputDir);

  console.log(`${derivativeExists ? "force " : "create"} ${file.relativePath}`);

  return ensureInfoId(file, await readInfoJson(file.infoPath));
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
  const collection = builder.createCollection(collectionId, (collectionBuilder) => {
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
  });

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
