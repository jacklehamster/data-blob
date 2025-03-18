import { expect, it, describe, jest, beforeEach, afterEach } from 'bun:test';
import { extractBlobsFromPayload, extractPayload, includeBlobsInPayload } from './blob-utils';
import { PayloadType } from './payload-enum';

describe('extractPayload', () => {
  it('extracts JSON payload from blob', async () => {
    const key = "payload";
    const keySize = new Uint8Array([key.length]);
    const keyBuffer = new TextEncoder().encode(key);
    const jsonPayload = { key: 'value' };
    const jsonString = JSON.stringify(jsonPayload);
    const size = new Uint32Array([jsonString.length]);
    const type = new Uint8Array([PayloadType.JSON]);
    const blob = new Blob([keySize, keyBuffer, type, size, jsonString]);

    const result = await extractPayload(blob);

    expect(result).toEqual({ payload: jsonPayload });
  });

  it('handles empty blob', async () => {
    const blob = new Blob([]);

    const result = await extractPayload(blob);

    expect(result).toEqual({});
  });

  it('handles multiple JSON payloads', async () => {
    const key1 = "payload1";
    const keySize1 = new Uint8Array([key1.length]);
    const keyBuffer1 = new TextEncoder().encode(key1);
    const jsonPayload1 = { key1: 'value1' };
    const jsonString1 = JSON.stringify(jsonPayload1);
    const size1 = new Uint32Array([jsonString1.length]);
    const type1 = new Uint8Array([PayloadType.JSON]);

    const key2 = "payload2";
    const keySize2 = new Uint8Array([key2.length]);
    const keyBuffer2 = new TextEncoder().encode(key2);
    const jsonPayload2 = { key2: 'value2' };
    const jsonString2 = JSON.stringify(jsonPayload2);
    const size2 = new Uint32Array([jsonString2.length]);
    const type2 = new Uint8Array([PayloadType.JSON]);

    const blob = new Blob([keySize1, keyBuffer1, type1, size1, jsonString1, keySize2, keyBuffer2, type2, size2, jsonString2]);

    const result = await extractPayload(blob);

    expect(result).toEqual({ payload1: jsonPayload1, payload2: jsonPayload2 });
  });
});

describe('includeBlobsInPayload', () => {
  const createObjectURL = global.URL.createObjectURL;
  beforeEach(() => {
    global.URL.createObjectURL = jest.fn(() => 'blob:http://example.com/12345678-1234-1234-1234-123456789012');
  });

  afterEach(() => {
    global.URL.createObjectURL = createObjectURL;
  });

  it('replaces blob URLs with object URLs', () => {
    const blobs = { uid: new Blob([new Uint8Array([1, 2, 3, 4, 5])]) };
    const payload = "{blobUrl:uid}";

    const result = includeBlobsInPayload(payload, blobs);

    expect(result.startsWith("blob:")).toBe(true);
  });

  it('handles nested blob URLs', () => {
    const blobs = { uid: new Blob([new Uint8Array([1, 2, 3, 4, 5])]) };
    const payload = { nested: "{blobUrl:uid}" };

    const result = includeBlobsInPayload(payload, blobs);

    expect(result.nested.startsWith("blob:")).toBe(true);
  });

  it('handles arrays with blob URLs', () => {
    const blobs = { uid: new Blob([new Uint8Array([1, 2, 3, 4, 5])]) };
    const payload = ["{blobUrl:uid}"];

    const result = includeBlobsInPayload(payload, blobs);

    expect(result[0].startsWith("blob:")).toBe(true);
    expect(result).not.toBe(payload);
  });

  it('retains payload if no blob URLs are found', () => {
    const payload = { key: 'value' };
    const result = includeBlobsInPayload(payload, {});
    expect(result).toBe(payload);
  });
});

describe('extractBlobUrlsFromPayload', () => {
  const fetch = global.fetch;
  beforeEach(() => {
    global.fetch = jest.fn((url) => {
      if (url.startsWith('blob:')) {
        return Promise.resolve({
          blob: () => Promise.resolve(new Blob(['{"key":"value"}'], { type: 'application/json' })),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    }) as any;
  })

  afterEach(() => {
    global.fetch = fetch;
  });

  it('replaces blob URLs with placeholders', async () => {
    const blobs: Record<string, Blob> = {};
    const payload = "blob:http://example.com/12345";

    const result = await extractBlobsFromPayload(payload, blobs, async () => "uid");

    expect(result).toBe("{blobUrl:uid}");
  });

  it('handles nested blob URLs', async () => {
    const blobs: Record<string, Blob> = {};
    const payload = { nested: "blob:http://example.com/12345" };

    const result = await extractBlobsFromPayload(payload, blobs, async () => "uid");

    expect(result.nested).toBe("{blobUrl:uid}");
    expect(result).not.toBe(payload);
  });

  it('retains payload if no blob URLs are found', async () => {
    const payload = { key: 'value' };
    const result = await extractBlobsFromPayload(payload, {});
    expect(result).toBe(payload);
  });

  it('handles arrays with blob URLs', async () => {
    const blobs: Record<string, Blob> = {};
    const payload = ["blob:http://example.com/12345"];

    const result = await extractBlobsFromPayload(payload, blobs, async () => "uid");

    expect(result[0]).toBe("{blobUrl:uid}");
  });
});
