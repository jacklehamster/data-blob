import { expect, it, describe } from 'bun:test';
import { BlobBuilder } from './blob-builder';
import { PayloadType } from './payload-enum';

describe('BlobBuilder', () => {
  it('should add JSON payload correctly', async () => {
    const builder = new BlobBuilder();
    const payload = { key: 'value' };
    builder.addPayload(payload);

    const expectedType = new Uint8Array([PayloadType.JSON]).buffer;
    const json = JSON.stringify(payload);
    const encoder = new TextEncoder();
    const buffer = encoder.encode(json);
    const expectedSize = new Uint32Array([buffer.byteLength]).buffer;

    expect(builder.data[0]).toEqual(expectedType);
    expect(builder.data[1]).toEqual(expectedSize);
    expect(builder.data[2]).toEqual(buffer.buffer as ArrayBuffer);
  });

  it('should build a Blob with the correct data', async () => {
    const builder = new BlobBuilder();
    const payload = { key: 'value' };
    builder.addPayload(payload);
    const blob = builder.build();

    const expectedType = new Uint8Array([PayloadType.JSON]).buffer;
    const json = JSON.stringify(payload);
    const encoder = new TextEncoder();
    const buffer = encoder.encode(json);
    const expectedSize = new Uint32Array([buffer.byteLength]).buffer;

    const expectedBlob = new Blob([expectedType, expectedSize, buffer.buffer as ArrayBuffer]);

    expect(blob.size).toBe(expectedBlob.size);
    expect(blob.type).toBe(expectedBlob.type);

    //  should extract the data from the blob
    const data = await blob.arrayBuffer();
    const type = new Uint8Array(data, 0, 1);
    const size = new Uint32Array(data.slice(1, 5), 0, 1);
    const str = new TextDecoder().decode(new Uint8Array(data, type.byteLength + size.byteLength, size[0]));
    const obj = JSON.parse(str);
    expect(type[0]).toBe(PayloadType.JSON);
    expect(size[0]).toBe(buffer.byteLength);
    expect(obj).toEqual(payload);
  });
});

it('should add Blob payload correctly', async () => {
  const builder = new BlobBuilder();
  const blobContent = new Uint8Array([1, 2, 3, 4, 5]);
  const blob = new Blob([blobContent]);
  builder.addBlob(blob);

  const expectedType = new Uint8Array([PayloadType.BLOB]).buffer;
  const expectedSize = new Uint32Array([blob.size]).buffer;

  expect(builder.data[0]).toEqual(expectedType);
  expect(builder.data[1]).toEqual(expectedSize);
  expect(builder.data[2]).toEqual(blob);
});

it('should build a Blob with the correct Blob data', async () => {
  const builder = new BlobBuilder();
  const blobContent = new Uint8Array([1, 2, 3, 4, 5]);
  const blob = new Blob([blobContent]);
  builder.addBlob(blob);
  const builtBlob = builder.build();

  const expectedType = new Uint8Array([PayloadType.BLOB]).buffer;
  const expectedSize = new Uint32Array([blob.size]).buffer;

  const expectedBlob = new Blob([expectedType, expectedSize, blob]);

  expect(builtBlob.size).toBe(expectedBlob.size);
  expect(builtBlob.type).toBe(expectedBlob.type);

  // should extract the data from the built blob
  const data = await builtBlob.arrayBuffer();
  const type = new Uint8Array(data, 0, 1);
  const size = new Uint32Array(data.slice(1, 5), 0, 1);
  const blobData = new Uint8Array(data, type.byteLength + size.byteLength, size[0]);

  expect(type[0]).toBe(PayloadType.BLOB);
  expect(size[0]).toBe(blob.size);
  expect(blobData).toEqual(blobContent);
});
