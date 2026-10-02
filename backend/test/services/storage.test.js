import { ErrorCodes, MAX_IMAGE_BYTES } from "@medstore/shared";
import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSignedUploadUrl,
  createSignedViewUrls,
  ensureBucket,
  removeObjects,
  verifyImageObject,
} from "../../src/services/storage.js";

const { storage, bucketFiles } = vi.hoisted(() => {
  const bucketFiles = {
    createSignedUploadUrl: vi.fn(),
    info: vi.fn(),
    createSignedUrl: vi.fn(),
    createSignedUrls: vi.fn(),
    remove: vi.fn(),
  };
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

describe("verifyImageObject", () => {
  const PATH = "u/1.jpg";
  const JPEG_START = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46];
  const PNG_START = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const PROBE_URL = "https://signed.example/object/sign/u/1.jpg?token=probe";

  const partial = (bytes, status = 206) => new Response(new Uint8Array(bytes), { status });
  const stored = (contentType, size = 1000) =>
    bucketFiles.info.mockResolvedValue(ok({ contentType, size }));

  let fetchMock;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    bucketFiles.createSignedUrl.mockResolvedValue(ok({ signedUrl: PROBE_URL }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["image/jpeg", JPEG_START],
    ["image/png", PNG_START],
  ])("accepts a %s whose type, size and first bytes match", async (contentType, bytes) => {
    stored(contentType);
    fetchMock.mockResolvedValue(partial(bytes));

    await expect(verifyImageObject(PATH, contentType)).resolves.toBe(true);
    expect(bucketFiles.info).toHaveBeenCalledWith(PATH);
    expect(bucketFiles.createSignedUrl).toHaveBeenCalledWith(PATH, 60);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(PROBE_URL);
    expect(init.headers).toEqual({ Range: "bytes=0-7" });
  });

  it.each([
    ["a text file stored as JPEG", "image/jpeg", [0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x0a]],
    ["PNG bytes stored as JPEG", "image/jpeg", PNG_START],
    ["JPEG bytes stored as PNG", "image/png", JPEG_START],
    ["a file shorter than the signature", "image/png", [0x89, 0x50]],
  ])("rejects %s", async (_case, contentType, bytes) => {
    stored(contentType);
    fetchMock.mockResolvedValue(partial(bytes));
    await expect(verifyImageObject(PATH, contentType)).resolves.toBe(false);
  });

  it("rejects a stored type other than the one the path was issued for, without reading it", async () => {
    stored("image/png");
    await expect(verifyImageObject(PATH, "image/jpeg")).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([0, MAX_IMAGE_BYTES + 1])("rejects a stored size of %i bytes", async (size) => {
    stored("image/jpeg", size);
    await expect(verifyImageObject(PATH, "image/jpeg")).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["HTTP 404", { name: "StorageApiError", status: 404, statusCode: "404" }],
    ["a 400 whose body says 404", { name: "StorageApiError", status: 400, statusCode: "404" }],
  ])("rejects a missing object (%s)", async (_case, error) => {
    bucketFiles.info.mockResolvedValue({ data: null, error });
    await expect(verifyImageObject(PATH, "image/jpeg")).resolves.toBe(false);
  });

  it.each([
    ["info fails", () => bucketFiles.info.mockResolvedValue(failed(500))],
    [
      "signing the probe URL fails",
      () => {
        stored("image/jpeg");
        bucketFiles.createSignedUrl.mockResolvedValue(failed(500));
      },
    ],
    [
      "the read throws",
      () => {
        stored("image/jpeg");
        fetchMock.mockRejectedValue(new TypeError("fetch failed"));
      },
    ],
    [
      "the range is ignored (200)",
      () => {
        stored("image/jpeg");
        fetchMock.mockResolvedValue(partial(JPEG_START, 200));
      },
    ],
  ])("returns 503 SERVICE_UNAVAILABLE when %s", async (_case, arrange) => {
    arrange();
    await expect(verifyImageObject(PATH, "image/jpeg")).rejects.toMatchObject({
      statusCode: 503,
      code: ErrorCodes.SERVICE_UNAVAILABLE,
    });
  });
});

describe("createSignedViewUrls", () => {
  const signed = (path) => ({ path, error: null, signedUrl: `https://signed.example/${path}` });

  it("signs every path in one call for 600 seconds, in the order asked", async () => {
    bucketFiles.createSignedUrls.mockResolvedValue(ok([signed("u/b.png"), signed("u/a.jpg")]));

    await expect(createSignedViewUrls(["u/a.jpg", "u/b.png"])).resolves.toEqual([
      "https://signed.example/u/a.jpg",
      "https://signed.example/u/b.png",
    ]);
    expect(bucketFiles.createSignedUrls).toHaveBeenCalledExactlyOnceWith(
      ["u/a.jpg", "u/b.png"],
      600,
    );
  });

  it.each([
    ["the call fails", () => bucketFiles.createSignedUrls.mockResolvedValue(failed(500))],
    [
      "one path can't be signed",
      () =>
        bucketFiles.createSignedUrls.mockResolvedValue(
          ok([signed("u/a.jpg"), { path: "u/b.png", error: "Object not found", signedUrl: null }]),
        ),
    ],
  ])("returns 503 SERVICE_UNAVAILABLE when %s", async (_case, arrange) => {
    arrange();
    await expect(createSignedViewUrls(["u/a.jpg", "u/b.png"])).rejects.toMatchObject({
      code: ErrorCodes.SERVICE_UNAVAILABLE,
    });
  });
});

describe("removeObjects", () => {
  it("deletes every path in one call", async () => {
    bucketFiles.remove.mockResolvedValue(ok([{ name: "u/a.jpg" }]));

    await removeObjects(["u/a.jpg", "u/b.png"]);

    expect(bucketFiles.remove).toHaveBeenCalledExactlyOnceWith(["u/a.jpg", "u/b.png"]);
  });

  it("returns 503 SERVICE_UNAVAILABLE when the call fails", async () => {
    bucketFiles.remove.mockResolvedValue(failed(500));
    await expect(removeObjects(["u/a.jpg"])).rejects.toMatchObject({
      code: ErrorCodes.SERVICE_UNAVAILABLE,
    });
  });
});
