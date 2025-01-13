import { expect, it, describe, jest, beforeEach, afterEach } from 'bun:test';
import { extractBlobUrlsFromPayload, extractPayload, includeBlobsInPayload } from './blob-utils';
import { PayloadType } from './payload-enum';

describe('extractPayload', () => {
  it('extracts JSON payload from blob', async () => {
    const jsonPayload = { key: 'value' };
    const jsonString = JSON.stringify(jsonPayload);
    const size = new Uint32Array([jsonString.length]);
    const type = new Uint8Array([PayloadType.JSON]);
    const blob = new Blob([type, size, jsonString]);

    const result = await extractPayload(blob);

    expect(result).toEqual([jsonPayload]);
  });

  it('handles empty blob', async () => {
    const blob = new Blob([]);

    const result = await extractPayload(blob);

    expect(result).toEqual([]);
  });

  it('handles multiple JSON payloads', async () => {
    const jsonPayload1 = { key1: 'value1' };
    const jsonString1 = JSON.stringify(jsonPayload1);
    const size1 = new Uint32Array([jsonString1.length]);
    const type1 = new Uint8Array([PayloadType.JSON]);

    const jsonPayload2 = { key2: 'value2' };
    const jsonString2 = JSON.stringify(jsonPayload2);
    const size2 = new Uint32Array([jsonString2.length]);
    const type2 = new Uint8Array([PayloadType.JSON]);

    const blob = new Blob([type1, size1, jsonString1, type2, size2, jsonString2]);

    const result = await extractPayload(blob);

    expect(result).toEqual([jsonPayload1, jsonPayload2]);
  });
});
it('extracts Blob payload from blob', async () => {
  const blobContent = new Uint8Array([1, 2, 3, 4, 5]);
  const size = new Uint32Array([blobContent.length]);
  const type = new Uint8Array([PayloadType.BLOB]);
  const blob = new Blob([type, size, blobContent]);

  const result = await extractPayload(blob);

  expect(result.length).toBe(1);
  expect(result[0] instanceof Blob).toBe(true);
  const extractedBlob = result[0] as Blob;
  const extractedContent = new Uint8Array(await extractedBlob.arrayBuffer());
  expect(extractedContent).toEqual(blobContent);
});

it('handles multiple Blob payloads', async () => {
  const blobContent1 = new Uint8Array([1, 2, 3, 4, 5]);
  const size1 = new Uint32Array([blobContent1.length]);
  const type1 = new Uint8Array([PayloadType.BLOB]);

  const blobContent2 = new Uint8Array([6, 7, 8, 9, 10]);
  const size2 = new Uint32Array([blobContent2.length]);
  const type2 = new Uint8Array([PayloadType.BLOB]);

  const blob = new Blob([type1, size1, blobContent1, type2, size2, blobContent2]);

  const result = await extractPayload(blob);

  expect(result.length).toBe(2);
  expect(result[0] instanceof Blob).toBe(true);
  expect(result[1] instanceof Blob).toBe(true);

  const extractedBlob1 = result[0] as Blob;
  const extractedContent1 = new Uint8Array(await extractedBlob1.arrayBuffer());
  expect(extractedContent1).toEqual(blobContent1);

  const extractedBlob2 = result[1] as Blob;
  const extractedContent2 = new Uint8Array(await extractedBlob2.arrayBuffer());
  expect(extractedContent2).toEqual(blobContent2);
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
    const blobs = [new Blob([new Uint8Array([1, 2, 3, 4, 5])])];
    const payload = "{blob:0}";

    const result = includeBlobsInPayload(payload, blobs);

    expect(result.startsWith("blob:")).toBe(true);
  });

  it('handles nested blob URLs', () => {
    const blobs = [new Blob([new Uint8Array([1, 2, 3, 4, 5])])];
    const payload = { nested: "{blob:0}" };

    const result = includeBlobsInPayload(payload, blobs);

    expect(result.nested.startsWith("blob:")).toBe(true);
  });

  it('handles arrays with blob URLs', () => {
    const blobs = [new Blob([new Uint8Array([1, 2, 3, 4, 5])])];
    const payload = ["{blob:0}"];

    const result = includeBlobsInPayload(payload, blobs);

    expect(result[0].startsWith("blob:")).toBe(true);
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
    const blobs: Blob[] = [];
    const payload = "blob:http://example.com/12345";

    const result = await extractBlobUrlsFromPayload(payload, blobs);

    expect(result).toBe("{blob:0}");
    expect(blobs.length).toBe(1);
  });

  it('handles nested blob URLs', async () => {
    const blobs: Blob[] = [];
    const payload = { nested: "blob:http://example.com/12345" };

    const result = await extractBlobUrlsFromPayload(payload, blobs);

    expect(result.nested).toBe("{blob:0}");
    expect(blobs.length).toBe(1);
  });

  it('handles arrays with blob URLs', async () => {
    const blobs: Blob[] = [];
    const payload = ["blob:http://example.com/12345"];

    const result = await extractBlobUrlsFromPayload(payload, blobs);

    expect(result[0]).toBe("{blob:0}");
    expect(blobs.length).toBe(1);
  });
});
