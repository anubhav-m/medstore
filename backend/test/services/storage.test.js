import { ErrorCodes, MAX_IMAGE_BYTES } from "@medstore/shared";
import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSignedUploadUrl, ensureBucket } from "../../src/services/storage.js";

const { storage, bucketFiles } = vi.hoisted(() => {
  const bucketFiles = { createSignedUploadUrl: vi.fn() };
  return {
    bucketFiles,
    storage: {
      from: vi.fn(),
      listBuckets: vi.fn(),
      createBucket: vi.fn(),
      updateBucket: vi.fn(),
      getBucket: vi.fn(),
    },
  };
});
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({ storage })) }));

// The client is built once at import, before mockReset clears the recorded calls.
const [clientUrl, clientKey, clientOptions] = vi.mocked(createClient).mock.calls[0];

const SETTINGS = {
  public: false,
  fileSizeLimit: MAX_IMAGE_BYTES,
  allowedMimeTypes: ["image/jpeg", "image/png"],
};
const SAVED = {
  id: "prescriptions",
  public: false,
  file_size_limit: MAX_IMAGE_BYTES,
  allowed_mime_types: ["image/png", "image/jpeg"],
};

const ok = (data) => ({ data, error: null });
const failed = (status) => ({ data: null, error: { name: "StorageApiError", status } });

beforeEach(() => {
  storage.from.mockReturnValue(bucketFiles);
  storage.createBucket.mockResolvedValue(ok({ name: "prescriptions" }));
  storage.updateBucket.mockResolvedValue(ok({ message: "Successfully updated" }));
  storage.getBucket.mockResolvedValue(ok(SAVED));
});

describe("storage client", () => {
  it("uses the secret key without Supabase Auth sessions", () => {
    expect(clientUrl).toBe("https://test-project.supabase.co");
    expect(clientKey).toBe("sb_secret_test-key");
    expect(clientOptions).toEqual({
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: expect.any(Function) },
    });
  });
});

describe("createSignedUploadUrl", () => {
  it("signs the path in the configured bucket", async () => {
    bucketFiles.createSignedUploadUrl.mockResolvedValue(
      ok({ signedUrl: "https://signed.example/upload?token=t", token: "t", path: "u/1.jpg" }),
    );

    await expect(createSignedUploadUrl("u/1.jpg")).resolves.toEqual({
      path: "u/1.jpg",
      signedUrl: "https://signed.example/upload?token=t",
      token: "t",
    });
    expect(storage.from).toHaveBeenCalledWith("prescriptions");
    expect(bucketFiles.createSignedUploadUrl).toHaveBeenCalledExactlyOnceWith("u/1.jpg");
  });

  it.each([
    ["returns an error", () => bucketFiles.createSignedUploadUrl.mockResolvedValue(failed(400))],
    ["throws", () => bucketFiles.createSignedUploadUrl.mockRejectedValue(new TypeError("fetch"))],
  ])("turns a provider that %s into 503 SERVICE_UNAVAILABLE", async (_case, arrange) => {
    arrange();
    await expect(createSignedUploadUrl("u/1.jpg")).rejects.toMatchObject({
      statusCode: 503,
      code: ErrorCodes.SERVICE_UNAVAILABLE,
    });
  });
});

describe("ensureBucket", () => {
  it("creates the bucket as private with the size and type limits when it doesn't exist", async () => {
    // search is a substring match, so a similarly named bucket must not count.
    storage.listBuckets.mockResolvedValue(ok([{ id: "prescriptions-old" }]));

    await expect(ensureBucket()).resolves.toEqual({ created: true, mismatched: [] });
    expect(storage.listBuckets).toHaveBeenCalledWith({ search: "prescriptions" });
    expect(storage.createBucket).toHaveBeenCalledExactlyOnceWith("prescriptions", SETTINGS);
    expect(storage.updateBucket).not.toHaveBeenCalled();
  });

  it("resets the settings of an existing bucket", async () => {
    storage.listBuckets.mockResolvedValue(ok([{ id: "prescriptions" }]));

    await expect(ensureBucket()).resolves.toEqual({ created: false, mismatched: [] });
    expect(storage.updateBucket).toHaveBeenCalledExactlyOnceWith("prescriptions", SETTINGS);
    expect(storage.createBucket).not.toHaveBeenCalled();
  });

  it("reports settings that didn't apply", async () => {
    storage.listBuckets.mockResolvedValue(ok([{ id: "prescriptions" }]));
    storage.getBucket.mockResolvedValue(
      ok({ ...SAVED, public: true, file_size_limit: 1_000_000, allowed_mime_types: null }),
    );

    await expect(ensureBucket()).resolves.toEqual({
      created: false,
      mismatched: ["public", "file_size_limit", "allowed_mime_types"],
    });
  });

  it("fails with 503 when Supabase refuses a request", async () => {
    storage.listBuckets.mockResolvedValue(failed(403));
    await expect(ensureBucket()).rejects.toMatchObject({ code: ErrorCodes.SERVICE_UNAVAILABLE });
    expect(storage.createBucket).not.toHaveBeenCalled();
  });
});
