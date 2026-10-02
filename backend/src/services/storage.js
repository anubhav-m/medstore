import {
  ALLOWED_IMAGE_TYPES,
  ErrorCodes,
  MAX_IMAGE_BYTES,
  SIGNED_VIEW_URL_TTL_SECONDS,
} from "@medstore/shared";
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

const bucket = () => supabase.storage.from(env.SUPABASE_BUCKET);

const BUCKET_SETTINGS = {
  public: false,
  fileSizeLimit: MAX_IMAGE_BYTES,
  allowedMimeTypes: [...ALLOWED_IMAGE_TYPES],
};

// The first bytes every real file of the type starts with.
const IMAGE_SIGNATURES = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
};
const SIGNATURE_BYTES = 8;
// Used once, right away, to read the signature bytes.
const PROBE_URL_TTL_SECONDS = 60;

// The log carries the provider's status and message (which never include the key), not the URL
// or token.
const unavailable = (operation, { name, status, message }) => {
  logger.error(
    { operation, errorName: name, providerStatus: status, providerMessage: message },
    "storage request failed",
  );
  return new AppError(
    "Prescription photos are unavailable right now. Please try again.",
    503,
    ErrorCodes.SERVICE_UNAVAILABLE,
  );
};

// storage-js returns most failures as `error` but can still throw; both end up in `error`.
const attempt = async (request) => {
  try {
    return await request();
  } catch (error) {
    return { error };
  }
};

const run = async (operation, request) => {
  const result = await attempt(request);
  if (result.error) throw unavailable(operation, result.error);
  return result.data;
};

// The URL accepts one upload to `path` (no overwrite) and is valid for 2 hours (fixed by Supabase).
export const createSignedUploadUrl = async (path) => {
  const { signedUrl, token } = await run("createSignedUploadUrl", () =>
    bucket().createSignedUploadUrl(path),
  );
  return { path, signedUrl, token };
};

// Storage reports a missing object either as HTTP 404 or as a 400 whose body says 404.
const isNotFound = (error) => error.status === 404 || String(error.statusCode) === "404";

// null when the object doesn't exist.
const objectInfo = async (path) => {
  const { data, error } = await attempt(() => bucket().info(path));
  if (!error) return data;
  if (isNotFound(error)) return null;
  throw unavailable("info", error);
};

// Reads only the signature bytes: a Range request on a short-lived signed URL answers 206.
const readFirstBytes = async (path) => {
  const { signedUrl } = await run("createSignedUrl", () =>
    bucket().createSignedUrl(path, PROBE_URL_TTL_SECONDS),
  );
  let response;
  try {
    response = await fetchWithTimeout(signedUrl, {
      headers: { Range: `bytes=0-${SIGNATURE_BYTES - 1}` },
    });
  } catch (error) {
    throw unavailable("readFirstBytes", error);
  }
  if (response.status !== 206) {
    await response.body?.cancel();
    throw unavailable("readFirstBytes", { status: response.status });
  }
  return new Uint8Array(await response.arrayBuffer());
};

// The bucket checks only the uploader's Content-Type header, never the bytes, and the header may
// disagree with the path's extension. So the stored type must be the one the path was issued for,
// the size within limits, and the first bytes a real signature of that type.
export const verifyImageObject = async (path, contentType) => {
  const info = await objectInfo(path);
  if (!info || info.contentType !== contentType) return false;
  if (!(info.size >= 1 && info.size <= MAX_IMAGE_BYTES)) return false;
  const firstBytes = await readFirstBytes(path);
  return IMAGE_SIGNATURES[contentType].every((byte, index) => firstBytes[index] === byte);
};

// One call for all of an order's images, in the order of `paths`.
export const createSignedViewUrls = async (paths) => {
  const signed = await run("createSignedUrls", () =>
    bucket().createSignedUrls(paths, SIGNED_VIEW_URL_TTL_SECONDS),
  );
  const urlByPath = new Map(signed.map((item) => [item.path, item.error ? null : item.signedUrl]));
  const urls = paths.map((path) => urlByPath.get(path));
  if (urls.some((url) => !url)) {
    throw unavailable("createSignedUrls", { message: "an object could not be signed" });
  }
  return urls;
};

// Deletes the objects at `paths` (at most 1000) in one call; an object already gone isn't an error.
export const removeObjects = async (paths) => {
  await run("remove", () => bucket().remove(paths));
};

const mismatchedSettings = (saved) => {
  const savedTypes = [...(saved.allowed_mime_types ?? [])].sort();
  return [
    saved.public !== false && "public",
    saved.file_size_limit !== BUCKET_SETTINGS.fileSizeLimit && "file_size_limit",
    savedTypes.join() !== [...BUCKET_SETTINGS.allowedMimeTypes].sort().join() &&
      "allowed_mime_types",
  ].filter(Boolean);
};

// Creates the bucket or resets its settings, then reads it back so a setting the project didn't
// apply is reported instead of assumed. Safe to run repeatedly.
export const ensureBucket = async () => {
  const id = env.SUPABASE_BUCKET;
  const buckets = await run("listBuckets", () => supabase.storage.listBuckets({ search: id }));
  const exists = buckets.some((existing) => existing.id === id);
  if (exists) {
    await run("updateBucket", () => supabase.storage.updateBucket(id, BUCKET_SETTINGS));
  } else {
    await run("createBucket", () => supabase.storage.createBucket(id, BUCKET_SETTINGS));
  }
  const saved = await run("getBucket", () => supabase.storage.getBucket(id));
  return { created: !exists, mismatched: mismatchedSettings(saved) };
};
