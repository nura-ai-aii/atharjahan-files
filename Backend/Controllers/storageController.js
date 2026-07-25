import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { fileTypeFromFile } from 'file-type';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_STORAGE_DIR = path.resolve(__dirname, '../Uploads');
const STAGING_DIR = path.join(LOCAL_STORAGE_DIR, '.staging');

// Ensure storage directories exist without touching root user files
if (!fs.existsSync(LOCAL_STORAGE_DIR)) fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
if (!fs.existsSync(STAGING_DIR)) fs.mkdirSync(STAGING_DIR, { recursive: true });

const USE_CLOUD = process.env.CLOUD_STORAGE_PROVIDER === 'r2' || process.env.CLOUD_STORAGE_PROVIDER === 's3';
const S3_BUCKET = process.env.S3_BUCKET || 'personal-cloud-explorer-vault';

let s3Client = null;
if (USE_CLOUD && process.env.S3_ACCESS_KEY_ID && process.env.S3_ACCESS_KEY_ID !== 'your_r2_access_key') {
  s3Client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'auto',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
    }
  });
  console.log('☁️ Cloudflare R2 / AWS S3 storage engine initialized successfully.');
} else {
  console.log('📦 No cloud keys detected - defaulting to isolated local vault storage at /Uploads.');
}

/**
 * Compute SHA-256 cryptographic checksum of a file stream
 */
export function computeSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}

/**
 * Validate file signature (magic numbers) to prevent MIME spoofing
 */
export async function verifyFileSignature(filePath, fallbackMime) {
  try {
    const type = await fileTypeFromFile(filePath);
    if (type) {
      return { mimeType: type.mime, ext: type.ext, verified: true };
    }
    // Plain text, CSV, JSON, Markdown, and custom code often don't have binary magic headers
    return { mimeType: fallbackMime || 'application/octet-stream', ext: '', verified: false };
  } catch (err) {
    console.error('Magic number validation warning:', err);
    return { mimeType: fallbackMime || 'application/octet-stream', ext: '', verified: false };
  }
}

/**
 * Stream large files up to 2GB directly to R2/S3 or Local vault
 */
export async function uploadToStorage(filePath, storageKey, mimeType) {
  const fileStream = fs.createReadStream(filePath);

  if (s3Client) {
    const parallelUploads3 = new Upload({
      client: s3Client,
      params: {
        Bucket: S3_BUCKET,
        Key: storageKey,
        Body: fileStream,
        ContentType: mimeType
      },
      queueSize: 4, // Concurrent upload worker queue
      partSize: 10 * 1024 * 1024 // 10MB chunks for optimal multi-gigabyte memory buffering
    });
    await parallelUploads3.done();
  } else {
    // Local secure storage fallback inside /Uploads
    const destPath = path.join(LOCAL_STORAGE_DIR, storageKey);
    await new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(destPath);
      fileStream.pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  }

  // Safely remove staging temp file after committed storage
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * Get readable streaming pipe from R2/S3 or local storage for downloads & previews
 */
export async function getFileStream(storageKey) {
  if (s3Client) {
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: storageKey
    });
    const response = await s3Client.send(command);
    return response.Body; // Node.js stream
  } else {
    const localPath = path.join(LOCAL_STORAGE_DIR, storageKey);
    if (!fs.existsSync(localPath)) {
      throw new Error('File not found in storage vault.');
    }
    return fs.createReadStream(localPath);
  }
}

export { STAGING_DIR };
