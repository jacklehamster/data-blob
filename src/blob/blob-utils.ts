import { validatePayload } from "@dobuki/payload-validator";
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

export async function extractPayload<T extends Record<string, any>>(blob: Blob, secret?: string): Promise<T> {
  const payload: Record<string, any> = {};
  const blobs: Record<string, Blob> = {};
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
        const [str, strOffset] = extractLongStringFromArrayBuffer(arrayBuffer, offset);
        offset = strOffset;
        payload[key] = JSON.parse(str);
        break;
      case PayloadType.BLOB:
        const [blob, blobOffset] = extractBlobFromArrayBuffer(arrayBuffer, offset);
        offset = blobOffset;
        blobs[key] = blob;
        break;
    }
  }
  if (secret && !validatePayload(payload, { secret })) {
    throw new Error("Invalid payload signature");
  }
  return { ...payload, ...blobs } as T;
}

async function generateBlobHash(blob: Blob): Promise<string> {
  const chunkSize = 64 * 1024; // 64KB chunks
  const chunks = Math.ceil(blob.size / chunkSize);
  let hashBuffer = await crypto.subtle.digest('SHA-256', new Uint8Array(0)); // Initialize with empty buffer

  for (let i = 0; i < chunks; i++) {
    const chunk = blob.slice(i * chunkSize, (i + 1) * chunkSize);
    const arrayBuffer = await chunk.arrayBuffer();
    const chunkHashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const combinedBuffer = new Uint8Array(hashBuffer.byteLength + chunkHashBuffer.byteLength);
    combinedBuffer.set(new Uint8Array(hashBuffer), 0);
    combinedBuffer.set(new Uint8Array(chunkHashBuffer), hashBuffer.byteLength);
    hashBuffer = await crypto.subtle.digest('SHA-256', combinedBuffer.buffer);
  }

  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export async function extractBlobsFromPayload(
  payload: any,
  blobs: Record<string, Blob>,
  generateUid: (blob: Blob) => Promise<string> = generateBlobHash,
): Promise<any> {
  if (typeof payload === "string" && payload.startsWith("blob:")) {
    const blob = await fetch(payload).then(response => response.blob());
    URL.revokeObjectURL(payload);
    const uid = `{blobUrl:${await generateUid(blob)}}`;
    blobs[uid] = blob;
    return uid;
  }
  if (typeof payload === "object" && payload instanceof Blob) {
    const uid = `{blob:${await generateUid(payload)}}`;
    blobs[uid] = payload;
    return uid;
  }
  const prePayload = payload;
  if (Array.isArray(payload)) {
    await Promise.all(payload.map(async (value, index) => {
      const newValue = await extractBlobsFromPayload(value, blobs, generateUid);
      if (newValue !== payload[index]) {
        if (payload === prePayload) {
          payload = [...payload];
        }
        payload[index] = newValue;
      }
    }));
  } else if (typeof payload === "object" && payload) {
    await Promise.all(Object.entries(payload).map(async ([key, value]) => {
      const newValue = await extractBlobsFromPayload(value, blobs, generateUid);
      if (newValue !== payload[key]) {
        if (payload === prePayload) {
          payload = { ...payload };
        }
        payload[key] = newValue;
      }
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
  const prePayload = payload;
  if (Array.isArray(payload)) {
    payload.forEach((value, index) => {
      const newValue = includeBlobsInPayload(value, blobs);
      if (newValue !== value) {
        if (payload === prePayload) {
          payload = [...payload];
        }
        payload[index] = newValue;
      }
    });
  } else if (typeof payload === "object" && payload) {
    Object.entries(payload).forEach(([key, value]) => {
      const newValue = includeBlobsInPayload(value, blobs);
      if (newValue !== value) {
        if (payload === prePayload) {
          payload = { ...payload };
        }
        payload[key] = newValue;
      }
    });
  }
  return payload;
}
