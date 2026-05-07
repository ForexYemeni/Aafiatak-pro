/**
 * Client-side image compression utility
 * Compresses images before upload while maintaining visual quality
 * Uses Canvas API for efficient browser-native compression
 */

interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.0 to 1.0
  maxSizeKB?: number; // Target max size in KB
}

const DEFAULT_OPTIONS: CompressOptions = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.85,
  maxSizeKB: 500, // Target under 500KB
};

/**
 * Compress an image file while maintaining visual quality
 * - Resizes if larger than maxWidth/maxHeight
 * - Converts to JPEG for better compression
 * - Iteratively reduces quality to meet size target
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));

    img.onload = () => {
      // Calculate new dimensions maintaining aspect ratio
      let { width, height } = img;

      if (width > opts.maxWidth! || height > opts.maxHeight!) {
        const ratio = Math.min(
          opts.maxWidth! / width,
          opts.maxHeight! / height
        );
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // Create canvas and draw resized image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Use high-quality rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Try to compress with iterative quality reduction
      const tryCompress = (quality: number): void => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }

            const sizeKB = blob.size / 1024;

            // If still too large and quality can be reduced further, try again
            if (sizeKB > opts.maxSizeKB! && quality > 0.3) {
              tryCompress(quality - 0.1);
              return;
            }

            // Create compressed file
            const compressedFile = new File(
              [blob],
              file.name.replace(/\.[^.]+$/, '.jpg'),
              { type: 'image/jpeg', lastModified: Date.now() }
            );

            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };

      tryCompress(opts.quality!);
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    reader.readAsDataURL(file);
  });
}

/**
 * Get image dimensions without fully loading it
 */
export function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to get image dimensions'));
    };

    img.src = url;
  });
}
