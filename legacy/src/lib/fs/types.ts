export interface FsBackend {
  readFile(path: string): Promise<string | null>;
  readFileSample(path: string, maxBytes: number): Promise<Uint8Array | null>;
  exists(path: string): Promise<boolean>;
}
