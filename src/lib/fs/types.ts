export interface FsBackend {
  readFile(path: string): Promise<string | null>;
  exists(path: string): Promise<boolean>;
}
