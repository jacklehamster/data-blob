import { expect, it, describe } from 'bun:test';
import { BlobBuilder } from './blob-builder';
import { PayloadType } from './payload-enum';

describe('BlobBuilder', () => {
  it('should add JSON payload correctly', async () => {
    const builder = new BlobBuilder();
    const payload = { key: 'value' };
    builder.payload("payload", payload);

    const expectedType = new Uint8Array([PayloadType.JSON]).buffer;
    const json = JSON.stringify(payload);
    const encoder = new TextEncoder();
    const buffer = encoder.encode(json);
    const expectedSize = new Uint32Array([buffer.byteLength]).buffer;

    expect(builder.data[2]).toEqual(expectedType);
    expect(builder.data[3]).toEqual(expectedSize);
    expect(builder.data[4]).toEqual(buffer.buffer as ArrayBuffer);
  });
});

it('should add Blob payload correctly', async () => {
  const builder = new BlobBuilder();
  const blobContent = new Uint8Array([1, 2, 3, 4, 5]);
  const blob = new Blob([blobContent]);
  builder.blob("blob", blob);

  const expectedType = new Uint8Array([PayloadType.BLOB]).buffer;
  const expectedSize = new Uint32Array([blob.size]).buffer;

  expect(builder.data[2]).toEqual(expectedType);
  expect(builder.data[3]).toEqual(expectedSize);
  expect(builder.data[4]).toEqual(blob);
});
