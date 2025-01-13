// To recognize dom types (see https://bun.sh/docs/typescript#dom-types):
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { PayloadType } from "./payload-enum";

export class BlobBuilder {
  readonly data: Array<ArrayBuffer | Blob> = [];
  readonly encoder = new TextEncoder();

  payload(payload: any) {
    const type = new Uint8Array([PayloadType.JSON]);
    this.data.push(type.buffer);
    const json = JSON.stringify(payload);
    const buffer = this.encoder.encode(json);
    const size = new Uint32Array([buffer.byteLength]);
    this.data.push(size.buffer);
    this.data.push(buffer.buffer as ArrayBuffer);
    return this;
  }

  blob(blob: Blob) {
    const type = new Uint8Array([PayloadType.BLOB]);
    this.data.push(type.buffer);
    const size = new Uint32Array([blob.size]);
    this.data.push(size.buffer);
    this.data.push(blob);
    return this;
  }

  build() {
    return new Blob(this.data);
  }
}
