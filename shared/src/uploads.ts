import type { AllowedImageType } from "./limits.js";

/** The server builds the object path; the request can't name one. */
export interface CreateUploadUrlRequest {
  contentType: AllowedImageType;
  /** 1 to `MAX_IMAGE_BYTES` */
  sizeBytes: number;
}

/** `data` of POST /uploads/prescriptions. */
export interface UploadUrlResponse {
  /** `{userId}/{uuid}.{jpg|png}` — sent back with the order */
  path: string;
  /** Upload the image bytes here; valid for 2 hours, for one upload */
  signedUrl: string;
  /** The signed URL's token (also in its query string) */
  token: string;
}
