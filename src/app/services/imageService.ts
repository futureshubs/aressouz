import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c`;

export interface UploadResponse {
  url: string;
  fileName: string;
  size: number;
  type: string;
  message: string;
}

export interface SignedUrlResponse {
  url: string;
  expiresIn: number;
  message: string;
}

/**
 * Upload image to R2 storage
 */
export async function uploadImage(
  file: File,
  token?: string
): Promise<UploadResponse> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const headers: HeadersInit = {};
    
    if (token) {
      console.log('🔑 Using provided token:', token.substring(0, 20) + '...');
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      console.log('🔑 Using public anon key');
      headers['Authorization'] = `Bearer ${publicAnonKey}`;
    }

    console.log('📤 Uploading to:', `${API_BASE_URL}/upload`);
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    console.log('📥 Upload response status:', response.status);
    const data = await response.json();
    console.log('📥 Upload response data:', data);

    if (!response.ok) {
      console.error('❌ Upload failed:', data);
      console.error('❌ Parsed error data:', {
        code: data.code || response.status,
        message: data.message || data.error || 'Rasm yuklashda xatolik'
      });
      throw new Error(data.message || data.error || 'Rasm yuklashda xatolik');
    }

    return data;
  } catch (error: any) {
    console.error('Upload image error:', error);
    throw new Error(error.message || 'Rasm yuklashda xatolik');
  }
}

/**
 * Delete image from R2 storage
 */
export async function deleteImage(
  fileName: string,
  token?: string
): Promise<void> {
  try {
    const headers: HeadersInit = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      headers['Authorization'] = `Bearer ${publicAnonKey}`;
    }

    const response = await fetch(`${API_BASE_URL}/upload/${fileName}`, {
      method: 'DELETE',
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Rasmni o\'chirishda xatolik');
    }
  } catch (error: any) {
    console.error('Delete image error:', error);
    throw new Error(error.message || 'Rasmni o\'chirishda xatolik');
  }
}

/**
 * Get signed URL for private images
 */
export async function getSignedUrl(
  fileName: string,
  expiresIn: number = 3600,
  token?: string
): Promise<SignedUrlResponse> {
  try {
    const headers: HeadersInit = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      headers['Authorization'] = `Bearer ${publicAnonKey}`;
    }

    const response = await fetch(
      `${API_BASE_URL}/upload/signed/${fileName}?expiresIn=${expiresIn}`,
      {
        method: 'GET',
        headers,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Signed URL yaratishda xatolik');
    }

    return data;
  } catch (error: any) {
    console.error('Get signed URL error:', error);
    throw new Error(error.message || 'Signed URL yaratishda xatolik');
  }
}

/**
 * Validate image file
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Faqat rasm fayllari (JPEG, PNG, WebP, GIF) yuklash mumkin',
    };
  }

  // Check file size (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'Fayl hajmi 10MB dan oshmasligi kerak',
    };
  }

  return { valid: true };
}

/**
 * Validate video file
 */
export function validateVideoFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/mpeg'];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Faqat video fayllari (MP4, WebM, MOV, AVI) yuklash mumkin',
    };
  }

  // Check file size (max 100MB)
  const maxSize = 100 * 1024 * 1024; // 100MB
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'Fayl hajmi 100MB dan oshmasligi kerak',
    };
  }

  return { valid: true };
}

/**
 * Validate media file (image or video)
 */
export function validateMediaFile(file: File): { valid: boolean; error?: string; isVideo: boolean } {
  const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  const videoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/mpeg'];
  
  const isImage = imageTypes.includes(file.type);
  const isVideo = videoTypes.includes(file.type);
  
  if (!isImage && !isVideo) {
    return {
      valid: false,
      error: 'Faqat rasm yoki video fayllari yuklash mumkin',
      isVideo: false,
    };
  }
  
  // Check file size
  const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      valid: false,
      error: isVideo ? 'Video hajmi 100MB dan oshmasligi kerak' : 'Rasm hajmi 10MB dan oshmasligi kerak',
      isVideo,
    };
  }
  
  return { valid: true, isVideo };
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}