import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@medstore/shared";
import { z } from "zod";

const MAX_MB = MAX_IMAGE_BYTES / (1024 * 1024);

// Strict: the server builds the path, so `path`, `fileName`, `folder` and the like are rejected.
export const createPrescriptionUploadSchema = {
  body: z.strictObject({
    contentType: z.enum(ALLOWED_IMAGE_TYPES, "Upload a JPEG or PNG image"),
    sizeBytes: z
      .number()
      .int("Use whole bytes")
      .min(1, "The image is empty")
      .max(MAX_IMAGE_BYTES, `Images can be at most ${MAX_MB} MB`),
  }),
};
