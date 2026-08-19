import { v2 as cloudinary, UploadApiResponse, UploadApiOptions } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export interface UploadOptions {
  folder?: string;
  publicId?: string;
  resourceType?: 'image' | 'raw' | 'auto' | 'video';
  format?: string;
}

/**
 * Uploads a file (Base64 string, URL, or Buffer) directly to Cloudinary.
 * Returns the Cloudinary upload result containing secure_url, public_id, etc.
 */
export const uploadToCloudinary = async (
  fileData: string | Buffer,
  options?: UploadOptions
): Promise<UploadApiResponse> => {
  const uploadOptions: UploadApiOptions = {
    folder: options?.folder || 'geetpay',
    resource_type: options?.resourceType || 'auto',
  };

  if (options?.publicId) {
    uploadOptions.public_id = options.publicId;
  }
  if (options?.format) {
    uploadOptions.format = options.format;
  }

  if (Buffer.isBuffer(fileData)) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error || !result) {
            return reject(error || new Error('Cloudinary upload stream failed'));
          }
          resolve(result);
        }
      );
      uploadStream.end(fileData);
    });
  }

  // fileData is a base64 string (with or without data URI scheme) or a file path / URL
  const dataUri = fileData.startsWith('data:') || fileData.startsWith('http')
    ? fileData
    : `data:image/jpeg;base64,${fileData}`;

  return cloudinary.uploader.upload(dataUri, uploadOptions);
};

export default cloudinary;
