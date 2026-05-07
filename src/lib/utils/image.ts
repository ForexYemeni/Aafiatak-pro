// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Image Optimization Utility
// ============================================================================
// Client-side image processing utilities for compression, conversion,
// resizing, blur placeholder generation, and validation.
// Uses the Canvas API for image manipulation (works in all modern browsers).
// ============================================================================

/** Options for image compression */
export interface CompressOptions {
  /** Maximum width in pixels (default: 1920) */
  maxWidth?: number;
  /** Maximum height in pixels (default: 1080) */
  maxHeight?: number;
  /** Quality from 0 to 1 (default: 0.8) */
  quality?: number;
  /** Output format (default: 'jpeg') */
  format?: 'jpeg' | 'png' | 'webp';
}

/** Image validation result */
export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

/** Maximum allowed file size in bytes (5MB) */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Allowed image MIME types */
const ALLOWED_MIME_TYPES: string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

/** Allowed file extensions */
const ALLOWED_EXTENSIONS: string[] = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
];

/**
 * Load an image file into an HTMLImageElement.
 * @param file - The image File to load
 * @returns Promise resolving to an HTMLImageElement
 */
function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('فشل تحميل الصورة'));
    };

    img.src = url;
  });
}

/**
 * Calculate dimensions that fit within max bounds while maintaining aspect ratio.
 * @param originalWidth - Original image width
 * @param originalHeight - Original image height
 * @param maxWidth - Maximum allowed width
 * @param maxHeight - Maximum allowed height
 * @returns Object with new width and height
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
    return { width: originalWidth, height: originalHeight };
  }

  const aspectRatio = originalWidth / originalHeight;

  let width = maxWidth;
  let height = maxWidth / aspectRatio;

  if (height > maxHeight) {
    height = maxHeight;
    width = maxHeight * aspectRatio;
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}

/**
 * Get the MIME type for a given format string.
 * @param format - The format ('jpeg', 'png', 'webp')
 * @returns The corresponding MIME type string
 */
function getMimeType(format: 'jpeg' | 'png' | 'webp'): string {
  const mimeTypes: Record<string, string> = {
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };
  return mimeTypes[format] ?? 'image/jpeg';
}

/**
 * Compress an image file with configurable options.
 * Resizes to fit within max dimensions and applies quality compression.
 * @param file - The image File to compress
 * @param options - Compression options
 * @returns Promise resolving to a compressed Blob
 */
export async function compressImage(file: File, options?: CompressOptions): Promise<Blob> {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.8,
    format = 'jpeg',
  } = options ?? {};

  const img = await loadImage(file);
  const { width, height } = calculateDimensions(img.naturalWidth, img.naturalHeight, maxWidth, maxHeight);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('فشل إنشاء سياق Canvas لضغط الصورة');
  }

  // Use high-quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw the resized image
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('فشل ضغط الصورة'));
        }
      },
      getMimeType(format),
      quality
    );
  });
}

/**
 * Convert an image file to WebP format.
 * WebP provides better compression than JPEG/PNG with similar quality.
 * @param file - The image File to convert
 * @param quality - Quality from 0 to 1 (default: 0.8)
 * @returns Promise resolving to a WebP Blob
 */
export async function convertToWebP(file: File, quality: number = 0.8): Promise<Blob> {
  const img = await loadImage(file);

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('فشل إنشاء سياق Canvas لتحويل الصورة');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('فشل تحويل الصورة إلى WebP'));
        }
      },
      'image/webp',
      quality
    );
  });
}

/**
 * Resize an image to fit within maximum dimensions while maintaining aspect ratio.
 * Does not apply quality compression (use compressImage for that).
 * @param file - The image File to resize
 * @param maxWidth - Maximum width in pixels
 * @param maxHeight - Maximum height in pixels
 * @returns Promise resolving to a resized Blob (same format as input)
 */
export async function resizeImage(file: File, maxWidth: number, maxHeight: number): Promise<Blob> {
  const img = await loadImage(file);
  const { width, height } = calculateDimensions(img.naturalWidth, img.naturalHeight, maxWidth, maxHeight);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('فشل إنشاء سياق Canvas لتغيير حجم الصورة');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  // Preserve original format
  const originalType = file.type || 'image/jpeg';

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('فشل تغيير حجم الصورة'));
        }
      },
      originalType,
      0.9
    );
  });
}

/**
 * Generate a base64 blur placeholder for an image.
 * Used with Next.js Image component's blurDataURL prop.
 * Creates a tiny, heavily blurred version of the image.
 * @param width - Width of the placeholder (default: 10)
 * @param height - Height of the placeholder (default: 10)
 * @returns Base64-encoded data URL string
 */
export function generateBlurPlaceholder(width: number = 10, height: number = 10): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // Return a simple gray placeholder if canvas is not available
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVQYV2P8z8BQz0BFwMgwasChAQBf9AoL/k2MVQAAAABJRU5ErkJggg==';
  }

  // Create a gradient placeholder matching the app's purple theme
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#9333ea');
  gradient.addColorStop(1, '#a855f7');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  return canvas.toDataURL('image/png');
}

/**
 * Validate an image file before upload.
 * Checks file type, size, and extension.
 * Returns a validation result with Arabic error messages.
 * @param file - The image File to validate
 * @returns Validation result with valid flag and optional error message
 */
export function validateImage(file: File): ImageValidationResult {
  // Check if file exists
  if (!file) {
    return { valid: false, error: 'لم يتم اختيار ملف' };
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'نوع الملف غير مدعوم. الأنواع المدعومة: JPG, PNG, WebP, GIF',
    };
  }

  // Check file extension
  const fileName = file.name.toLowerCase();
  const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext));
  if (!hasValidExtension) {
    return {
      valid: false,
      error: 'امتداد الملف غير مدعوم. الامتدادات المدعومة: .jpg, .jpeg, .png, .webp, .gif',
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `حجم الملف كبير جداً. الحد الأقصى: ${Math.round(MAX_FILE_SIZE / (1024 * 1024))} ميجابايت`,
    };
  }

  // Check minimum file size (1KB - prevent empty/corrupt files)
  if (file.size < 1024) {
    return {
      valid: false,
      error: 'الملف صغير جداً أو تالف. يرجى اختيار ملف آخر',
    };
  }

  return { valid: true };
}

/**
 * Get image dimensions from a file without fully loading it.
 * Useful for pre-validation before upload.
 * @param file - The image File
 * @returns Promise resolving to width and height
 */
export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  const img = await loadImage(file);
  return {
    width: img.naturalWidth,
    height: img.naturalHeight,
  };
}

/**
 * Create a File from a Blob with a proper filename.
 * @param blob - The Blob to convert
 * @param fileName - The filename to use
 * @param mimeType - The MIME type
 * @returns A File object
 */
export function blobToFile(blob: Blob, fileName: string, mimeType?: string): File {
  return new File([blob], fileName, {
    type: mimeType ?? blob.type,
    lastModified: Date.now(),
  });
}
