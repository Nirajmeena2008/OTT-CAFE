// Shared by every admin "upload from device" field (dish image, banner image,
// delivery partner document) -- converts a picked File straight to a Data URL
// client-side, matching the pattern already used by CustomCakeModal for cake
// reference photos. No server upload endpoint needed: the resulting string is
// stored directly wherever an image/document URL is expected.
export const MAX_UPLOAD_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Failed to read file'));
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
