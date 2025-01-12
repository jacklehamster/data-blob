import { PayloadType } from "./payload-enum";

export class BlobBuilder {
  readonly data: Array<ArrayBuffer | Blob> = [];
  readonly encoder = new TextEncoder();

  addPayload(payload: any) {
    const type = new Uint8Array([PayloadType.JSON]);
    this.data.push(type.buffer);
    const json = JSON.stringify(payload);
    const buffer = this.encoder.encode(json);
    const size = new Uint32Array([buffer.byteLength]);
    this.data.push(size.buffer);
    this.data.push(buffer.buffer as ArrayBuffer);
  }

  addBlob(image: Blob) {
    const type = new Uint8Array([PayloadType.BLOB]);
    this.data.push(type.buffer);
    const size = new Uint32Array([image.size]);
    this.data.push(size.buffer);
    this.data.push(image);
  }

  build() {
    return new Blob(this.data);
  }
}
