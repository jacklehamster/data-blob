import { validatePayload } from "@dobuki/payload-validator";
import { PayloadType } from "./payload-enum";
import { v4 as uuidv4 } from 'uuid';

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

export function checkPayload(payload: Record<string, any>, secret: string) {
  return validatePayload(payload, { secret });
}

export async function extractPayload<T extends Record<string, any>>(blob: Blob): Promise<T> {
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
        try {
          payload[key] = JSON.parse(str);
        } catch (error) {
          console.error(`Error parsing JSON for key "${key}":`, error);
        }
        break;
      case PayloadType.BLOB:
        const [blob, blobOffset] = extractBlobFromArrayBuffer(arrayBuffer, offset);
        offset = blobOffset;
        blobs[key] = blob;
        break;
    }
  }
  return { ...payload, ...blobs } as T;
}


export function extractBlobsFromPayload(
  payload: any,
  blobs: Record<string, Blob>
): any {
  if (typeof payload === "object" && payload instanceof Blob) {
    const uid = `{blob:${uuidv4()}}`;
    blobs[uid] = payload;
    return uid;
  }
  const prePayload = payload;
  if (Array.isArray(payload)) {
    payload.forEach((value, index) => {
      const newValue = extractBlobsFromPayload(value, blobs);
      if (newValue !== payload[index]) {
        if (payload === prePayload) {
          payload = [...payload];
        }
        payload[index] = newValue;
      }
    });
  } else if (typeof payload === "object" && payload) {
    Object.entries(payload).forEach(([key, value]) => {
      const newValue = extractBlobsFromPayload(value, blobs);
      if (newValue !== payload[key]) {
        if (payload === prePayload) {
          payload = { ...payload };
        }
        payload[key] = newValue;
      }
    });
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
