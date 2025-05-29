#!/usr/bin/env node

import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';

const pipelineAsync = promisify(pipeline);

// Load config from environment variables
const {
  S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY,
  S3_BUCKET,
  S3_ENDPOINT, // e.g. https://<accountid>.r2.cloudflarestorage.com or any S3-compatible endpoint
  S3_REGION = 'auto', // Default to 'auto' for R2, but can be set for other S3 providers
} = process.env;

if (!S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY || !S3_BUCKET || !S3_ENDPOINT) {
  console.error('Missing one or more required environment variables: S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET, S3_ENDPOINT');
  process.exit(1);
}

if (process.argv.length < 4) {
  console.error('Usage: node build-pull-assets.js <remote-prefix> <local-dir>');
  process.exit(1);
}

const remotePrefix = process.argv[2];
const localDir = process.argv[3];

const s3 = new S3Client({
  region: S3_REGION,
  endpoint: S3_ENDPOINT,
  credentials: {
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true, // Required for most S3-compatible storage
});

async function listAllObjects(prefix) {
  let continuationToken = undefined;
  let objects = [];
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
  return objects;
}

async function downloadObject(key, destPath) {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });
  const response = await s3.send(command);
  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
  await pipelineAsync(response.Body, fs.createWriteStream(destPath));
}

(async () => {
  try {
    const objects = await listAllObjects(remotePrefix);
    if (objects.length === 0) {
      console.log('No objects found for prefix:', remotePrefix);
      return;
    }
    for (const obj of objects) {
      if (obj.Key.endsWith('/')) continue; // skip folders
      const relativePath = path.relative(remotePrefix, obj.Key);
      const destPath = path.join(localDir, relativePath);
      console.log(`Downloading ${obj.Key} -> ${destPath}`);
      await downloadObject(obj.Key, destPath);
    }
    console.log('All assets pulled successfully.');
  } catch (err) {
    console.error('Error pulling assets:', err);
    process.exit(1);
  }
})();
