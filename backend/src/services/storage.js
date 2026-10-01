import { ALLOWED_IMAGE_TYPES, ErrorCodes, MAX_IMAGE_BYTES } from "@medstore/shared";
import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { AppError } from "../utils/AppError.js";

const TIMEOUT_MS = 10_000;

// Nothing here passes its own abort signal, so every request just gets a timeout.
const fetchWithTimeout = (input, init) =>
  fetch(input, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });

// The only holder of the secret key. Storage only: no Supabase Auth sessions on the server.
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fetchWithTimeout },
});

const BUCKET_SETTINGS = {
  public: false,
  fileSizeLimit: MAX_IMAGE_BYTES,
  allowedMimeTypes: [...ALLOWED_IMAGE_TYPES],
};

// storage-js returns most failures as `error` but can still throw; both become a 503. The log
// carries the provider's status and message (which never include the key), not the URL or token.
const run = async (operation, request) => {
  let result;
  try {
    result = await request();
  } catch (error) {
    result = { error };
  }
  if (!result.error) return result.data;
  const { name, status, message } = result.error;
  logger.error(
    { operation, errorName: name, providerStatus: status, providerMessage: message },
    "storage request failed",
  );
  throw new AppError(
    "Uploads are unavailable right now. Please try again.",
    503,
    ErrorCodes.SERVICE_UNAVAILABLE,
  );
};

// The URL accepts one upload to `path` (no overwrite) and is valid for 2 hours (fixed by Supabase).
export const createSignedUploadUrl = async (path) => {
  const { signedUrl, token } = await run("createSignedUploadUrl", () =>
    supabase.storage.from(env.SUPABASE_BUCKET).createSignedUploadUrl(path),
  );
  return { path, signedUrl, token };
};

const mismatchedSettings = (bucket) => {
  const savedTypes = [...(bucket.allowed_mime_types ?? [])].sort();
  return [
    bucket.public !== false && "public",
    bucket.file_size_limit !== BUCKET_SETTINGS.fileSizeLimit && "file_size_limit",
    savedTypes.join() !== [...BUCKET_SETTINGS.allowedMimeTypes].sort().join() &&
      "allowed_mime_types",
  ].filter(Boolean);
};

// Creates the bucket or resets its settings, then reads it back so a setting the project didn't
// apply is reported instead of assumed. Safe to run repeatedly.
export const ensureBucket = async () => {
  const id = env.SUPABASE_BUCKET;
  const buckets = await run("listBuckets", () => supabase.storage.listBuckets({ search: id }));
  const exists = buckets.some((bucket) => bucket.id === id);
  if (exists) {
    await run("updateBucket", () => supabase.storage.updateBucket(id, BUCKET_SETTINGS));
  } else {
    await run("createBucket", () => supabase.storage.createBucket(id, BUCKET_SETTINGS));
  }
  const saved = await run("getBucket", () => supabase.storage.getBucket(id));
  return { created: !exists, mismatched: mismatchedSettings(saved) };
};
