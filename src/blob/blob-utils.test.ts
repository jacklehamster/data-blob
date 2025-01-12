import { expect, it, describe } from 'bun:test';
import { extractPayload } from './blob-utils';
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
