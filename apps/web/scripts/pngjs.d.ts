// Minimal types for the part of pngjs the scripts use.
declare module 'pngjs' {
  export class PNG {
    width: number;
    height: number;
    data: Buffer;
    static sync: {
      read(buffer: Buffer): PNG;
      write(png: PNG, options?: { colorType?: number }): Buffer;
    };
  }
}
