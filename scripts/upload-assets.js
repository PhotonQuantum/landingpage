#!/usr/bin/env node

import { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import mime from 'mime';

// Load config from environment variables
const {
  S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY,
  S3_BUCKET,
  S3_ENDPOINT, // e.g. https://<accountid>.r2.cloudflarestorage.com or any S3-compatible endpoint
  S3_REGION = 'auto', // Default to 'auto' for R2, but can be set for other S3 providers
  MAX_QUOTA_BYTES, // Optional: max allowed size in bytes
  MAX_CONCURRENCY = 8, // Optional: max concurrent uploads
} = process.env;

if (!S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY || !S3_BUCKET || !S3_ENDPOINT) {
  console.error('Missing one or more required environment variables: S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET, S3_ENDPOINT');
  process.exit(1);
}

if (process.argv.length < 4) {
  console.error('Usage: node upload-assets.js <local-dir> <remote-prefix> [--delete]');
  process.exit(1);
}

const localDir = process.argv[2];
const remotePrefix = process.argv[3].replace(/\/$/, ''); // remove trailing slash
const shouldDelete = process.argv.includes('--delete');

const s3 = new S3Client({
  region: S3_REGION,
  endpoint: S3_ENDPOINT,
  credentials: {
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

async function listAllObjects(prefix) {
  let continuationToken = undefined;
  let objects = [];
  try {
    do {
      const command = new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });
      const response = await s3.send(command);
      if (response.Contents) {
        objects = objects.concat(response.Contents);
      }
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.Code === 'NoSuchKey') {
      // Treat as empty
      return [];
    }
    throw err;
  }
  return objects;
}

async function listLocalFiles(dir, baseDir = dir) {
  let results = [];
  const list = await fs.promises.readdir(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = await fs.promises.stat(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(await listLocalFiles(filePath, baseDir));
    } else {
      results.push(path.relative(baseDir, filePath));
    }
  }
  return results;
}

async function uploadFile(localFile, remoteKey) {
  const fileStream = fs.createReadStream(path.join(localDir, localFile));
  const contentType = mime.getType(localFile) || 'application/octet-stream';
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: remoteKey,
    Body: fileStream,
    CacheControl: 'public, max-age=31536000, immutable', // cache forever
    ContentType: contentType,
  });
  await s3.send(command);
}

async function deleteObject(remoteKey) {
  const command = new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: remoteKey,
  });
  await s3.send(command);
}

async function batchDeleteObjects(keys) {
  if (!keys.length) return;
  const batches = [];
  for (let i = 0; i < keys.length; i += 1000) {
    batches.push(keys.slice(i, i + 1000));
  }
  for (const batch of batches) {
    const command = new DeleteObjectsCommand({
      Bucket: S3_BUCKET,
      Delete: {
        Objects: batch.map(Key => ({ Key })),
        Quiet: false,
      },
    });
    await s3.send(command);
  }
}

// Concurrency pool for uploads
async function runConcurrent(tasks, maxConcurrency) {
  let index = 0;
  let active = 0;
  let results = [];
  return new Promise((resolve, reject) => {
    function next() {
      if (index === tasks.length && active === 0) {
        resolve(Promise.all(results));
        return;
      }
      while (active < maxConcurrency && index < tasks.length) {
        const i = index++;
        active++;
        const p = tasks[i]()
          .catch(reject)
          .finally(() => {
            active--;
            next();
          });
        results.push(p);
      }
    }
    next();
  });
}

(async () => {
  try {
    // 1. List all local files
    const localFiles = await listLocalFiles(localDir);
    const localFileSet = new Set(localFiles.map(f => f.replace(/\\/g, '/')));

    // 2. List all S3 objects under prefix
    const s3Objects = await listAllObjects(remotePrefix);
    const s3Keys = s3Objects.map(obj => obj.Key);

    // --- Bucket quota check ---
    if (MAX_QUOTA_BYTES) {
      const totalSize = s3Objects.reduce((sum, obj) => sum + (obj.Size || 0), 0);
      if (totalSize > Number(MAX_QUOTA_BYTES)) {
        console.error(`Bucket quota exceeded: ${totalSize} bytes used, quota is ${MAX_QUOTA_BYTES} bytes.`);
        process.exit(1);
      }
    }
    // --- End quota check ---

    // 3. Upload missing files (concurrent)
    const uploadTasks = [];
    for (const file of localFiles) {
      const s3Key = remotePrefix ? `${remotePrefix}/${file.replace(/\\/g, '/')}` : file.replace(/\\/g, '/');
      if (!s3Keys.includes(s3Key)) {
        uploadTasks.push(() => {
          console.log(`Uploading ${file} -> ${s3Key}`);
          return uploadFile(file, s3Key);
        });
      }
    }
    await runConcurrent(uploadTasks, Number(MAX_CONCURRENCY) || 8);

    // 4. Delete extra S3 files if --delete
    if (shouldDelete) {
      const keysToDelete = [];
      for (const s3Key of s3Keys) {
        const relativeKey = s3Key.slice(remotePrefix.length + (remotePrefix ? 1 : 0));
        if (!localFileSet.has(relativeKey)) {
          console.log(`Deleting remote ${s3Key}`);
          keysToDelete.push(s3Key);
        }
      }
      await batchDeleteObjects(keysToDelete);
    }

    console.log('Sync complete.');
  } catch (err) {
    console.error('Error uploading assets:', err);
    process.exit(1);
  }
})();
