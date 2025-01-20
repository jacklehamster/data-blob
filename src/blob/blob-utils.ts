import { PayloadType } from "./payload-enum";

const DECODER = new TextDecoder();

function extractShortStringFromArrayBuffer(arrayBuffer: ArrayBuffer, offset: number): [string, number] {
  const [keySize, keySizeOffset] = extractByteFromArrayBuffer(arrayBuffer, offset);
  const key = DECODER.decode(new Uint8Array(arrayBuffer, keySizeOffset, keySize));
  return [key, keySizeOffset + keySize];
}

function extractLongStringFromArrayBuffer(arrayBuffer: ArrayBuffer, offset: number): [string, number] {
  const [strSize, strSizeOffset] = extractLongFromArrayBuffer(arrayBuffer, offset);
  const str = DECODER.decode(new Uint8Array(arrayBuffer, strSizeOffset, strSize));
  return [str, strSizeOffset + strSize];
}

function extractBlobFromArrayBuffer(arrayBuffer: ArrayBuffer, offset: number): [Blob, number] {
  const [blobSize, blobSizeOffset] = extractLongFromArrayBuffer(arrayBuffer, offset);
  const blob = new Blob([new Uint8Array(arrayBuffer, blobSizeOffset, blobSize)], { type: "application/octet-stream" });
  return [blob, blobSizeOffset + blobSize];
}

function extractLongFromArrayBuffer(arrayBuffer: ArrayBuffer, offset: number): [number, number] {
  const uint32Array = new Uint32Array(arrayBuffer.slice(offset, offset + Uint32Array.BYTES_PER_ELEMENT), 0, 1);
  return [uint32Array[0], offset + Uint32Array.BYTES_PER_ELEMENT];
}

function extractByteFromArrayBuffer(arrayBuffer: ArrayBuffer, offset: number): [number, number] {
  const uint8Array = new Uint8Array(arrayBuffer, offset, 1);
  return [uint8Array[0], offset + Uint8Array.BYTES_PER_ELEMENT];
}

export async function extractPayload(blob: Blob): Promise<Record<string, any>> {
  const payload: Record<string, any> = {};
  let offset = 0;
  let arrayBuffer;
  while (offset < blob.size) {
    arrayBuffer = arrayBuffer ?? await blob.arrayBuffer();
    const [key, keyOffset] = extractShortStringFromArrayBuffer(arrayBuffer, offset);
    offset = keyOffset;
    const [type, typeOffset] = extractByteFromArrayBuffer(arrayBuffer, offset);
    offset = typeOffset;

    switch (type) {
      case PayloadType.JSON:
        try {
          const [str, strOffset] = extractLongStringFromArrayBuffer(arrayBuffer, offset);
          offset = strOffset;
          payload[key] = JSON.parse(str);
        } catch (error) {
          console.warn("Failed to parse JSON payload", error);
        }
        break;
      case PayloadType.BLOB:
        const [blob, blobOffset] = extractBlobFromArrayBuffer(arrayBuffer, offset);
        offset = blobOffset;
        payload[key] = blob;
        break;
    }
  }
  return payload;
}

//  Browser code
export async function extractBlobsFromPayload(
  payload: any,
  blobs: Record<string, Blob>,
  generateUid: () => string = () => globalThis.crypto.randomUUID()
): Promise<any> {
  if (typeof payload === "string" && payload.startsWith("blob:")) {
    const blob = await fetch(payload).then(response => response.blob());
    URL.revokeObjectURL(payload);
    const uid = `{blobUrl:${generateUid()}}`;
    blobs[uid] = blob;
    return uid;
  }
  if (typeof payload === "object" && payload instanceof Blob) {
    const uid = `{blob:${generateUid()}}`;
    blobs[uid] = payload;
    return uid;
  }
  if (Array.isArray(payload)) {
    await Promise.all(payload.map(async (value, index) => {
      payload[index] = await extractBlobsFromPayload(value, blobs, generateUid);
    }));
  } else if (typeof payload === "object" && payload) {
    await Promise.all(Object.entries(payload).map(async ([key, value]) => {
      payload[key] = await extractBlobsFromPayload(value, blobs, generateUid);
    }));
  }
  return payload;
}

//  Browser code
export function includeBlobsInPayload(payload: any, blobs: Record<string, Blob>): any {
  if (typeof payload === "string" && payload.startsWith("{blobUrl:")) {
    return URL.createObjectURL(blobs[payload]);
  }
  if (typeof payload === "string" && payload.startsWith("{blob:")) {
    return blobs[payload];
  }
  if (Array.isArray(payload)) {
    payload.forEach((value, index) => {
      payload[index] = includeBlobsInPayload(value, blobs);
    });
  } else if (typeof payload === "object" && payload) {
    Object.entries(payload).forEach(([key, value]) => {
      payload[key] = includeBlobsInPayload(value, blobs);
    });
  }
  return payload;
}
