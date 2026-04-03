import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "npm:@aws-sdk/client-s3@3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3";

// R2 Configuration
const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID');
const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID');
const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY');
const R2_BUCKET_NAME = Deno.env.get('R2_BUCKET_NAME') || 'online-shop-images';

// R2 Public URL (permanent, no expiration). Override via R2_PUBLIC_URL if the bucket uses another domain.
const R2_PUBLIC_URL =
  (Deno.env.get("R2_PUBLIC_URL") || "").trim() ||
  "https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev";

/**
 * R2 object key prefixes this app uses on the public R2 domain.
 * `community/` is excluded here — those objects are deleted only with owner checks (see server).
 */
const MANAGED_R2_PUBLIC_PREFIXES = [
  "house/",
  "car/",
  "place/",
  "places/",
  "property/",
  "panorama/",
  "bank/",
  "profiles/",
  "videos/",
  "rentals/",
  "shop-products/",
  "support_chat/",
  "auctions/",
  "user-car-",
  "user-car-panorama-",
  "vehicle-",
  "vehicle-panorama-",
] as const;

/** Public R2 URL → object key if it is ours (same host + allowed prefix); else null. */
export function extractManagedR2PublicKeyFromUrl(url: string): string | null {
  const u = String(url || "").trim();
  if (!u || (!u.startsWith("http://") && !u.startsWith("https://"))) return null;
  try {
    const parsed = new URL(u);
    const base = new URL(R2_PUBLIC_URL);
    if (parsed.hostname !== base.hostname) return null;
    const key = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    if (!key || key.includes("..")) return null;
    if (key.startsWith("community/")) return null;
    for (const p of MANAGED_R2_PUBLIC_PREFIXES) {
      if (key.startsWith(p)) return key;
    }
    return null;
  } catch {
    return null;
  }
}

export function extractListingMediaR2KeyFromUrl(url: string): string | null {
  return extractManagedR2PublicKeyFromUrl(url);
}

/** Best-effort delete for one URL on our public R2 (ignores external URLs and failures). */
export async function deleteManagedR2UrlIfKnown(url: string): Promise<void> {
  const key = extractManagedR2PublicKeyFromUrl(url);
  if (!key) return;
  try {
    if (!checkR2Config().configured) return;
    await deleteFromR2(key);
  } catch (e) {
    console.error("Managed R2 delete (non-fatal):", e);
  }
}

export async function deleteListingMediaFromR2IfKnown(url: string): Promise<void> {
  return deleteManagedR2UrlIfKnown(url);
}

/** Base64 data URL → R2; key is `${baseFileName}.${ext}` (e.g. user-car-…-0.jpg). */
export async function uploadImage(dataUrl: string, baseFileName: string): Promise<string> {
  const m = String(dataUrl).match(/^data:image\/(\w+);base64,(.+)$/i);
  if (!m) throw new Error("Base64 rasm data URL kutilgan");
  const imageType = m[1].toLowerCase();
  const base64Data = m[2];
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  const ext = imageType === "jpeg" ? "jpg" : imageType;
  const contentType =
    imageType === "jpeg" || imageType === "jpg" ? "image/jpeg" : `image/${imageType}`;
  const key = `${baseFileName}.${ext}`;
  return uploadToR2(key, bytes, contentType);
}

// Validate configuration
const isR2Configured = () => {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
};

// Create S3 Client for R2 (lazy initialization)
let r2Client: S3Client | null = null;

const getR2Client = () => {
  if (!isR2Configured()) {
    throw new Error('R2 sozlanmagan. Environment variables tekshiring: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY');
  }

  if (!r2Client) {
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID!,
        secretAccessKey: R2_SECRET_ACCESS_KEY!,
      },
    });
  }

  return r2Client;
};

/**
 * Upload file to R2 (supports images and videos)
 * @param fileName - File name
 * @param fileContent - File content (Buffer or Uint8Array)
 * @param contentType - Content type (e.g., 'image/jpeg', 'video/mp4')
 * @returns File URL (public, permanent)
 */
export async function uploadToR2(
  fileName: string,
  fileContent: Uint8Array,
  contentType: string
): Promise<string> {
  try {
    const client = getR2Client();
    
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileName,
      Body: fileContent,
      ContentType: contentType,
      // Cache for 1 year (videos and images are permanent)
      CacheControl: 'public, max-age=31536000, immutable',
    });

    await client.send(command);

    // Return public URL (permanent, no expiration)
    const publicUrl = `${R2_PUBLIC_URL}/${fileName}`;
    console.log('✅ File uploaded successfully to R2:', publicUrl);
    return publicUrl;
  } catch (error: any) {
    console.error('R2 upload error:', error);
    throw new Error(`Fayl yuklashda xatolik: ${error.message || error}`);
  }
}

/**
 * Delete file from R2
 * @param fileName - File name to delete
 */
export async function deleteFromR2(fileName: string): Promise<void> {
  try {
    const client = getR2Client();
    
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileName,
    });

    await client.send(command);
  } catch (error: any) {
    console.error('R2 delete error:', error);
    throw new Error(`Rasmni o'chirishda xatolik: ${error.message || error}`);
  }
}

/**
 * Generate signed URL for private files
 * @param fileName - File name
 * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
 * @returns Signed URL
 */
export async function getSignedUrlFromR2(
  fileName: string,
  expiresIn: number = 3600
): Promise<string> {
  try {
    const client = getR2Client();
    
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileName,
    });

    const signedUrl = await getSignedUrl(client, command, { expiresIn });
    return signedUrl;
  } catch (error: any) {
    console.error('R2 signed URL error:', error);
    throw new Error(`Signed URL yaratishda xatolik: ${error.message || error}`);
  }
}

/**
 * Generate presigned URL for direct upload from frontend
 * @param fileName - File name to upload
 * @param contentType - Content type (e.g., 'image/jpeg')
 * @param expiresIn - Expiration time in seconds (default: 600 = 10 minutes)
 * @returns Presigned URL for PUT request
 */
export async function generatePresignedUploadUrl(
  fileName: string,
  contentType: string,
  expiresIn: number = 600
): Promise<string> {
  try {
    const client = getR2Client();
    
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileName,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(client, command, { expiresIn });
    return presignedUrl;
  } catch (error: any) {
    console.error('R2 presigned upload URL error:', error);
    throw new Error(`Presigned URL yaratishda xatolik: ${error.message || error}`);
  }
}

/**
 * Generate unique file name with timestamp
 * @param originalName - Original file name
 * @returns Unique file name
 */
export function generateFileName(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const extension = originalName.split('.').pop() || 'jpg';
  return `${timestamp}-${random}.${extension}`;
}

/**
 * Check if R2 is configured
 */
export function checkR2Config(): { configured: boolean; message: string } {
  if (!R2_ACCOUNT_ID) {
    return { configured: false, message: 'R2_ACCOUNT_ID sozlanmagan' };
  }
  if (!R2_ACCESS_KEY_ID) {
    return { configured: false, message: 'R2_ACCESS_KEY_ID sozlanmagan' };
  }
  if (!R2_SECRET_ACCESS_KEY) {
    return { configured: false, message: 'R2_SECRET_ACCESS_KEY sozlanmagan' };
  }
  return { configured: true, message: 'R2 to\'liq sozlangan' };
}

/**
 * Upload file (alternative name for uploadToR2)
 * @param fileContent - File content (Buffer or Uint8Array)
 * @param fileName - File name
 * @param contentType - Content type (e.g., 'image/jpeg')
 * @returns Upload result with URL
 */
export async function uploadFile(
  fileContent: Uint8Array,
  fileName: string,
  contentType: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const url = await uploadToR2(fileName, fileContent, contentType);
    return { success: true, url };
  } catch (error: any) {
    console.error('uploadFile error:', error);
    return { success: false, error: error.message || 'Faylni yuklashda xatolik' };
  }
}