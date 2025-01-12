import { PayloadType } from "./payload-enum";


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
