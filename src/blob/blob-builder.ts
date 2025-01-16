// To recognize dom types (see https://bun.sh/docs/typescript#dom-types):
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { PayloadType } from "./payload-enum";

export class BlobBuilder {
  readonly data: Array<ArrayBuffer | Blob> = [];
  readonly #encoder = new TextEncoder();

  static payload<T = any>(key: string, payload: T) {
    return new BlobBuilder().payload<T>(key, payload);
  }

  static blob(key: string, blob: Blob) {
    return new BlobBuilder().blob(key, blob);
  }

  #saveKey(key: string) {
    const buffer = this.#encoder.encode(key);
    const size = new Uint8Array([buffer.byteLength]);
    this.data.push(size.buffer);
    this.data.push(buffer.buffer as ArrayBuffer);
  }

  payload<T = any>(key: string, payload: T) {
    this.#saveKey(key);
    const type = new Uint8Array([PayloadType.JSON]);
    this.data.push(type.buffer);
    const json = JSON.stringify(payload);
    const buffer = this.#encoder.encode(json);
    const size = new Uint32Array([buffer.byteLength]);
    this.data.push(size.buffer);
    this.data.push(buffer.buffer as ArrayBuffer);
    return this;
  }

  blob(key: string, blob: Blob) {
    this.#saveKey(key);
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
