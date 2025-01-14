import { PayloadType } from "./payload-enum";
import crypto from "crypto";


export async function extractPayload(blob: Blob): Promise<any[]> {
  const payload: any[] = [];
  let offset = 0;
  let arrayBuffer;
  while (offset < blob.size) {
    arrayBuffer = arrayBuffer ?? await blob.arrayBuffer();
    const type = new Uint8Array(arrayBuffer, offset, 1);
    offset += Uint8Array.BYTES_PER_ELEMENT;
    const size = new Uint32Array(arrayBuffer.slice(offset, offset + Uint32Array.BYTES_PER_ELEMENT), 0, 1);
    offset += Uint32Array.BYTES_PER_ELEMENT;
    switch (type[0]) {
      case PayloadType.JSON:
        payload.push(extractJson(arrayBuffer, offset, size[0]));
        break;
      case PayloadType.BLOB:
        payload.push(new Blob([arrayBuffer.slice(offset, offset + size[0])]));
        break;
    }
    offset += size[0];
  }
  return payload;
}

function extractJson(arrayBuffer: ArrayBuffer, offset: number, size: number): any {
  const str = new TextDecoder().decode(new Uint8Array(arrayBuffer, offset, size));
  return JSON.parse(str);
}

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

export function includeBlobsInPayload(payload: any, blobs: Record<string, Blob>): any {
  if (typeof payload === "string" && payload.startsWith("{blob:")) {
    const index = payload.substring(6, payload.length - 1);
    return URL.createObjectURL(blobs[index]);
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
