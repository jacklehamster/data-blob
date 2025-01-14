import { PayloadType } from "./payload-enum";
import crypto from "crypto";


export async function extractPayload(blob: Blob): Promise<Record<string, any>> {
  const decoder = new TextDecoder();
  const payload: Record<string, any> = {};
  let offset = 0;
  let arrayBuffer;
  while (offset < blob.size) {
    arrayBuffer = arrayBuffer ?? await blob.arrayBuffer();
    const keySize = new Uint8Array(arrayBuffer, offset, 1);
    offset += Uint8Array.BYTES_PER_ELEMENT;
    const key = decoder.decode(new Uint8Array(arrayBuffer, offset, keySize[0]));
    offset += keySize[0];

    const type = new Uint8Array(arrayBuffer, offset, 1);
    offset += Uint8Array.BYTES_PER_ELEMENT;
    const size = new Uint32Array(arrayBuffer.slice(offset, offset + Uint32Array.BYTES_PER_ELEMENT), 0, 1);
    offset += Uint32Array.BYTES_PER_ELEMENT;

    switch (type[0]) {
      case PayloadType.JSON:
        try {
          const str = decoder.decode(new Uint8Array(arrayBuffer, offset, size[0]));
          payload[key] = JSON.parse(str);
        } catch (error) {
          console.warn("Failed to parse JSON payload", error);
        }
        break;
      case PayloadType.BLOB:
        payload[key] = new Blob([arrayBuffer.slice(offset, offset + size[0])]);
        break;
    }
    offset += size[0];
  }
  return payload;
}

//  Browser code
export async function extractBlobUrlsFromPayload(
  payload: any,
  blobs: Record<string, Blob>,
  generateUid: () => string = () => crypto.randomBytes(16).toString("hex")
): Promise<any> {
  if (typeof payload === "string" && payload.startsWith("blob:")) {
    const blob = await fetch(payload).then(response => response.blob());
    URL.revokeObjectURL(payload);
    const uid = generateUid();
    blobs[uid] = blob;
    return `{blob:${uid}}`;
  }
  if (Array.isArray(payload)) {
    await Promise.all(payload.map(async (value, index) => {
      payload[index] = await extractBlobUrlsFromPayload(value, blobs, generateUid);
    }));
  } else if (typeof payload === "object" && payload) {
    await Promise.all(Object.entries(payload).map(async ([key, value]) => {
      payload[key] = await extractBlobUrlsFromPayload(value, blobs, generateUid);
    }));
  }
  return payload;
}

//  Browser code
export function includeBlobsInPayload(payload: any, blobs: Record<string, Blob>): any {
  if (typeof payload === "string" && payload.startsWith("{blob:")) {
    const uid = payload.substring(6, payload.length - 1);
    return URL.createObjectURL(blobs[uid]);
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
