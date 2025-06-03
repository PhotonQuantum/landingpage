/**
 * build-images.ts
 *
 * This script processes images according to the configuration in image.config.json.
 * It uses imagetools-core for image transformations and metadata extraction, including
 * custom EXIF and blurhash transforms (ported from app.config.ts).
 *
 * Usage: Run this script from the project root. All necessary dependencies must be installed.
 */

import fs from 'fs';
import path from 'path';
import glob from 'fast-glob';
import sharp from 'sharp';
import { builtins, resolveConfigs, TransformFactory, setMetadata, generateTransforms, applyTransforms, urlFormat, builtinOutputFormats } from 'imagetools-core';
import exifReader from 'exif-reader';
import { encode } from 'blurhash';
import { blurhashToCssGradientString } from '@unpic/placeholder';

import { BinaryLike, createHash } from 'node:crypto';
import { copyFile, writeFile } from 'node:fs/promises';
import os from 'os';

// --- Pretty Print Utilities ---
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};
function prettyInfo(msg: string, indent = 0) {
  const pad = ' '.repeat(indent);
  console.log(`${pad}${colors.blue}ℹ ${msg}${colors.reset}`);
}
function prettyWarn(msg: string, indent = 0) {
  const pad = ' '.repeat(indent);
  console.warn(`${pad}${colors.yellow}⚠ ${msg}${colors.reset}`);
}
function prettyProcessing(msg: string, indent = 0) {
  const pad = ' '.repeat(indent);
  console.log(`${pad}${colors.cyan}► ${msg}${colors.reset}`);
}
function prettyDone(msg: string, indent = 0) {
  const pad = ' '.repeat(indent);
  console.log(`${pad}${colors.green}✔ ${msg}${colors.reset}`);
}

// --- Utility: Clean EXIF data (ported from app.config.ts) ---
function cleanExifData(exifData: any): any {
  if (!exifData || typeof exifData !== 'object') {
    return exifData;
  }
  if (Array.isArray(exifData)) {
    return exifData.map((item) => cleanExifData(item));
  }
  if (exifData instanceof Date) {
    return exifData;
  }
  const cleaned: any = {};
  const importantDateFields = new Set([
    'DateTimeOriginal',
    'DateTime',
    'DateTimeDigitized',
    'CreateDate',
    'ModifyDate',
  ]);
  for (const [key, value] of Object.entries(exifData)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string') {
      if (importantDateFields.has(key)) {
        const cleanedString = value.replaceAll('\0', '');
        if (cleanedString.length > 0) cleaned[key] = cleanedString;
      } else {
        const cleanedString = value.replaceAll('\0', '').trim();
        if (cleanedString.length > 0) cleaned[key] = cleanedString;
      }
    } else if (value instanceof Date) {
      cleaned[key] = value;
    } else if (typeof value === 'object') {
      const cleanedNested = cleanExifData(value);
      if (cleanedNested && Object.keys(cleanedNested).length > 0) cleaned[key] = cleanedNested;
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

// --- Custom EXIF transform (ported from app.config.ts) ---
function exifTransform(): TransformFactory {
  // Returns an ImageTransformation compatible with imagetools-core
  return (metadata) => {
    if (!('exif' in metadata)) return undefined;
    return async (image: sharp.Sharp) => {
      const meta = await image.metadata();
      if (!meta.exif) return image;
      const parsed = exifReader(meta.exif);
      delete parsed.Photo?.MakerNote;
      delete parsed.Photo?.UserComment;
      delete parsed.Photo?.PrintImageMatching;
      delete parsed.Image?.PrintImageMatching;
      const cleaned = cleanExifData(parsed);
      // Attach cleaned EXIF to metadata for later JSON output
      setMetadata(image, "exif", cleaned);
      return image;
    };
  };
}

// --- Custom blurhash transform (ported from app.config.ts) ---
function blurhashTransform(): TransformFactory {
  // Returns an ImageTransformation compatible with imagetools-core
  return (metadata) => {
    if (!('blurhash' in metadata)) return undefined;
    return async (image: sharp.Sharp) => {
      const { data, info } = await image.ensureAlpha().clone().raw().toBuffer({ resolveWithObject: true });
      const aspectRatio = info.width / info.height;
      const totalComponents = 12;
      const xComponents = Math.ceil(Math.sqrt(totalComponents * aspectRatio));
      const yComponents = Math.ceil(totalComponents / xComponents);
      const encoded = encode(
        new Uint8ClampedArray(data),
        info.width,
        info.height,
        xComponents,
        yComponents
      );
      const gradientString = blurhashToCssGradientString(encoded, xComponents, yComponents);
      // Attach blurhash data to metadata for later JSON output
      setMetadata(image, "blurhash", {
        blurhash: encoded,
        blurhashXComponents: xComponents,
        blurhashYComponents: yComponents,
        blurhashGradient: gradientString,
      });
      return image;
    };
  };
}

const factories = [exifTransform(), ...builtins, blurhashTransform()];

// --- Utility: Normalize directives for resolveConfigs ---
function normalizeDirectives(directives: Record<string, any>): Array<[string, string[]]> {
  // Converts all directive values to arrays of strings as required by resolveConfigs
  return Object.entries(directives).map(([k, v]) => {
    if (Array.isArray(v)) {
      return [k, v.map(String)];
    } else if (typeof v === 'boolean' || typeof v === 'number') {
      return [k, [String(v)]];
    } else if (typeof v === 'string') {
      return [k, [v]];
    } else {
      return [k, []];
    }
  });
}

// --- Utility: Build URLSearchParams from config object ---
function buildSearchParams(cfg: Record<string, any>): URLSearchParams {
  const searchParams = new URLSearchParams();
  for (const [k, v] of Object.entries(cfg)) {
    if (Array.isArray(v)) {
      searchParams.set(k, v.map(String).join(';'));
    } else if (typeof v === 'boolean' || typeof v === 'number') {
      searchParams.set(k, String(v));
    } else if (typeof v === 'string') {
      searchParams.set(k, v);
    }
  }
  return searchParams;
}

function generateImageID(config: any, imageHash: string) {
  return hash([JSON.stringify(config), imageHash]);
}
function hash(keyParts: BinaryLike[]) {
  let hash = createHash('sha1');
  for (const keyPart of keyParts) {
    hash = hash.update(keyPart);
  }
  return hash.digest('hex');
}

// --- Concurrency: Async Pool Helper ---
// Generic async pool with type safety
async function asyncPool<T, R>(poolLimit: number, array: T[], iteratorFn: (item: T) => Promise<R>): Promise<R[]> {
  const ret: Promise<R>[] = [];
  const executing: Promise<any>[] = [];
  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p);
    if (poolLimit <= array.length) {
      const e: Promise<any> = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= poolLimit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(ret);
}

// --- Utility: Get max value for a directive from config ---
function getMaxDirective(cfg: Record<string, any>, keys: string[]): number | undefined {
  for (const key of keys) {
    if (cfg[key] !== undefined) {
      if (Array.isArray(cfg[key])) {
        const nums = cfg[key].map(Number).filter(n => !isNaN(n));
        if (nums.length > 0) return Math.max(...nums);
      } else {
        const n = Number(cfg[key]);
        if (!isNaN(n)) return n;
      }
    }
  }
  return undefined;
}

// --- Utility: Check if directives is an orientation record ---
function isOrientationDirectives(directives: any): boolean {
  return (
    directives &&
    typeof directives === 'object' &&
    ('landscape' in directives || 'portrait' in directives)
  );
}

// --- Utility: Extract directives for image orientation ---
function extractDirectivesForOrientation(origWidth: number | undefined, origHeight: number | undefined, directives: any): any {
  if (!isOrientationDirectives(directives)) return directives;
  if (origWidth !== undefined && origHeight !== undefined) {
    if (origWidth >= origHeight && 'landscape' in directives) {
      return directives['landscape'];
    } else if (origHeight > origWidth && 'portrait' in directives) {
      return directives['portrait'];
    } else {
      // fallback: if only one is present, use it
      return directives['landscape'] || directives['portrait'];
    }
  } else {
    // fallback: if can't determine, use landscape if present
    return directives['landscape'] || directives['portrait'];
  }
}

// --- Utility: Check and skip 'auto' w/h configs if already processed ---
function shouldSkipAutoConfig(cfg: any, origWidth: number | undefined, origHeight: number | undefined, processedConfigHashes: Set<string>, relFile: string): boolean {
  let isAutoW = false, isAutoH = false;
  let autoSubCfg = { ...cfg };
  if (cfg.w !== undefined) {
    if ((Array.isArray(cfg.w) && cfg.w.includes('auto')) || cfg.w === 'auto') {
      isAutoW = true;
      autoSubCfg = { ...autoSubCfg, w: Array.isArray(cfg.w) ? cfg.w.map((v: any) => v === 'auto' ? String(origWidth) : v) : String(origWidth) };
    }
  }
  if (cfg.h !== undefined) {
    if ((Array.isArray(cfg.h) && cfg.h.includes('auto')) || cfg.h === 'auto') {
      isAutoH = true;
      autoSubCfg = { ...autoSubCfg, h: Array.isArray(cfg.h) ? cfg.h.map((v: any) => v === 'auto' ? String(origHeight) : v) : String(origHeight) };
    }
  }
  const configHash = JSON.stringify({ ...autoSubCfg, w: autoSubCfg.w, h: autoSubCfg.h });
  if ((isAutoW || isAutoH) && processedConfigHashes.has(configHash)) {
    prettyWarn(`[SKIP] ${relFile}: auto w/h config already processed with original dimension`, 6);
    return true;
  }
  // Mark this config as processed
  processedConfigHashes.add(JSON.stringify({ ...cfg, w: cfg.w, h: cfg.h }));
  if (isAutoW || isAutoH) {
    processedConfigHashes.add(configHash);
  }
  return false;
}

// --- Main script logic ---
(async () => {
  // 1. Load image.config.json
  const configPath = path.resolve(process.cwd(), 'image.config.json');
  const configRaw = fs.readFileSync(configPath, 'utf-8');
  const configs = JSON.parse(configRaw);

  const cacheDir = path.resolve(process.cwd(), process.env.CACHE_DIR || '.cache/images');
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

  // Get max concurrency from env or default to 4
  // Default to available parallelism (Node 18+: os.availableParallelism()), fallback to os.cpus().length
  let defaultParallelism = 4;
  if (typeof os.availableParallelism === 'function') {
    defaultParallelism = os.availableParallelism();
  } else if (os.cpus) {
    defaultParallelism = os.cpus().length;
  }
  const maxConcurrency = parseInt(process.env.MAX_CONCURRENCY || String(defaultParallelism), 10);

  // 2. For each config entry, process images
  for (const entry of configs) {
    const inputGlob = entry.input;
    const output = entry.output;
    const directives = entry.directives;

    // 2a. Expand input glob
    const files = await glob(inputGlob, { absolute: true });
    if (files.length === 0) {
      prettyWarn(`[WARN] No files matched for input: ${inputGlob}`);
      continue;
    }
    prettyInfo(`Processing ${files.length} files for input: ${inputGlob}`);

    // 2b. Prepare output collectors
    let jsonOutput: Record<string, any> = {};

    // 2c. Process each file (concurrently, with max concurrency)
    // Track processed configs for this image
    const processedConfigHashes = new Set<string>();
    await asyncPool(maxConcurrency, files, async (file) => {
      // Report the filename currently being processed
      const relFile = "/" + path.relative(process.cwd(), file);
      prettyProcessing(`${relFile}`, 4);
      // Load image with sharp
      const image = sharp(file);
      const meta = await image.metadata();
      const origWidth = meta.width;
      const origHeight = meta.height;

      // Select directives based on orientation if needed
      const usedDirectives = extractDirectivesForOrientation(origWidth, origHeight, directives);

      // Normalize directives to entries for resolveConfigs
      const entries = normalizeDirectives(usedDirectives);
      // Get all config combinations for this file
      const resolvedConfigs = resolveConfigs(entries, builtinOutputFormats);
      // Compute Image ID
      const imageHash = hash([await image.clone().toBuffer()]);
      let outputMetadatas: any[] = [];
      for (const cfg of resolvedConfigs) {
        // --- AUTO w/h SKIP LOGIC ---
        if (shouldSkipAutoConfig(cfg, origWidth, origHeight, processedConfigHashes, relFile)) {
          continue;
        }
        // Check for width/height in this cfg
        const maxW = getMaxDirective(cfg, ['w', 'width']);
        const maxH = getMaxDirective(cfg, ['h', 'height']);
        if ((maxW !== undefined && origWidth !== undefined && maxW > origWidth) ||
            (maxH !== undefined && origHeight !== undefined && maxH > origHeight)) {
          prettyWarn(`[SKIP] ${relFile}: cfg width (${maxW ?? '-'})/height (${maxH ?? '-'}) exceeds original (${origWidth}x${origHeight})`, 6);
          continue;
        }
        const id = generateImageID(cfg, imageHash);

        // Check if file exists in cache
        const cachePath = path.join(cacheDir, id);
        if (fs.existsSync(cachePath)) {
          const image = sharp(cachePath);
          const sharpMeta = await image.metadata();

          // we set the format on the metadata during transformation using the format directive
          // when restoring from the cache, we use sharp to read it from the image and that results in a different value for avif images
          // see https://github.com/lovell/sharp/issues/2504 and https://github.com/lovell/sharp/issues/3746
          if (cfg.format === 'avif' && sharpMeta.format === 'heif' && sharpMeta.compression === 'av1')
            sharpMeta.format = 'avif';
          const ext = sharpMeta.format ? `.${sharpMeta.format}` : path.extname(file);

          // Construct output name
          const outName = `${id}${ext}`;

          // Copy cached file to output directory if needed
          if (output.images) {
            const outDir = path.resolve(process.cwd(), output.images);
            const outPath = path.join(outDir, outName);
            if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
            await fs.promises.copyFile(cachePath, outPath);
          }

          // Construct source path
          const pathPrefix = process.env.PATH_PREFIX || '';
          const srcPath = pathPrefix ? `${pathPrefix}/${outName}` : `${outName}`;

          // Load meta from cache
          const cacheJsonPath = path.join(cacheDir, `${id}.json`);
          const meta = JSON.parse(fs.readFileSync(cacheJsonPath, 'utf-8'));

          // Always set metadata
          outputMetadatas.push({
            ...meta,
            src: srcPath,
            image: image,
          });

        } else {
          // Prepare logger and searchParams for generateTransforms
          const logger = {
            info: () => { },
            warn: () => { },
            error: () => { },
          };
          // Compose searchParams from config (simulate URLSearchParams)
          const searchParams = buildSearchParams(cfg);
          // Generate transforms for this config
          const { transforms } = generateTransforms(cfg, factories, searchParams, logger);
          // Apply transforms using imagetools-core's applyTransforms
          const { image: transformed, metadata: meta } = await applyTransforms(transforms, image);

          // Store file & json to cache
          await writeFile(cachePath, await transformed.toBuffer());
          const cacheJsonPath = path.join(cacheDir, `${id}.json`);
          fs.writeFileSync(cacheJsonPath, JSON.stringify(meta), 'utf-8');

          // Construct output name
          const ext = meta.format ? `.${meta.format}` : path.extname(file);
          const outName = `${id}${ext}`;

          // Write images if needed
          if (output.images) {
            const outDir = path.resolve(process.cwd(), output.images);
            const outPath = path.join(outDir, outName);
            if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
            await copyFile(cachePath, outPath);
          }

          // Construct source path
          const pathPrefix = process.env.PATH_PREFIX || '';
          const srcPath = pathPrefix ? `${pathPrefix}/${outName}` : `${outName}`;

          // Always set metadata
          outputMetadatas.push({
            ...meta,
            src: srcPath,
            image: transformed,
          });
        }
      }
      // Collect JSON metadata
      // Use output format logic from vite-imagetools
      // Determine output format based on 'as' directive
      let outputFormat = urlFormat();
      let asParam: string[] | undefined = undefined;
      let as: string | undefined = undefined;
      const directiveAs = entries.find(([k]) => k === 'as');
      if (directiveAs) {
        const asRaw = directiveAs?.[1]?.[0];
        if (typeof asRaw === 'string') {
          asParam = asRaw.split(':');
          as = asParam[0];
        }
      }
      // Check for custom output format
      for (const [key, format] of Object.entries(builtinOutputFormats)) {
        if (as === key) {
          outputFormat = format(asParam && asParam[1] ? asParam[1].split(';') : undefined);
          break;
        }
      }
      // Prepare metadata for output format
      const formatted = outputFormat(outputMetadatas);
      // Aggregate all outputs for this file
      if (!jsonOutput[relFile]) {
        jsonOutput[relFile] = [];
      }
      jsonOutput[relFile].push(formatted);
    }); // end asyncPool
    // 2e. Write JSON output if needed
    if (output.json && Object.keys(jsonOutput).length > 0) {
      // Flatten arrays with only one element to a single object for consistency
      for (const key of Object.keys(jsonOutput)) {
        if (Array.isArray(jsonOutput[key]) && jsonOutput[key].length === 1) {
          jsonOutput[key] = jsonOutput[key][0];
        }
      }
      const outJsonPath = path.resolve(process.cwd(), output.json);
      const outJsonDir = path.dirname(outJsonPath);
      if (!fs.existsSync(outJsonDir)) fs.mkdirSync(outJsonDir, { recursive: true });
      fs.writeFileSync(outJsonPath, JSON.stringify(jsonOutput, null, 2), 'utf-8');
      prettyDone(`Wrote JSON metadata to ${outJsonPath}`, 2);
    }
  }

  prettyDone('[DONE] Image processing complete.');
})();