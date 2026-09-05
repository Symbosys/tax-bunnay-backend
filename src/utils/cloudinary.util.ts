import cloudinary from "../config/cloudinary.config.ts";
import env from "../config/env.config.ts";

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  url: string;
  format: string;
  bytes: number;
}

export const getCloudinaryFolderPath = (subFolder?: string): string => {
  const baseFolder = env.cloudinary.folder || "hrms";
  return subFolder ? `${baseFolder}/${subFolder}` : baseFolder;
};

/**
 * Uploads a file buffer (from Multer memory storage) directly to Cloudinary using streams.
 * @param fileBuffer Buffer containing the image file binary
 * @param folderName Sub-folder path inside Cloudinary
 */
export const uploadBufferToCloudinary = (
  fileBuffer: Buffer,
  folderName: string = "avatars"
): Promise<CloudinaryUploadResult> => {
  const fullFolderPath = getCloudinaryFolderPath(folderName);
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: fullFolderPath,
        resource_type: "auto",
      },
      (error, result) => {
        if (error || !result) {
          return reject(error || new Error("Cloudinary upload failed with empty response"));
        }
        resolve({
          public_id: result.public_id,
          secure_url: result.secure_url,
          url: result.url,
          format: result.format,
          bytes: result.bytes,
        });
      }
    );

    uploadStream.end(fileBuffer);
  });
};

/**
 * Uploads a Base64 data URI string or remote URL directly to Cloudinary.
 * @param dataUri Base64 data string (e.g. data:image/png;base64,...) or file path/url
 * @param folderName Sub-folder path inside Cloudinary
 */
export const uploadDataUriToCloudinary = async (
  dataUri: string,
  folderName: string = "avatars"
): Promise<CloudinaryUploadResult> => {
  const fullFolderPath = getCloudinaryFolderPath(folderName);
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: fullFolderPath,
    resource_type: "auto",
  });

  return {
    public_id: result.public_id,
    secure_url: result.secure_url,
    url: result.url,
    format: result.format,
    bytes: result.bytes,
  };
};

/**
 * Removes an existing media file from Cloudinary using its public ID.
 * @param publicId Public ID of the asset on Cloudinary
 */
export const deleteFromCloudinary = async (publicId: string): Promise<any> => {
  return cloudinary.uploader.destroy(publicId);
};
