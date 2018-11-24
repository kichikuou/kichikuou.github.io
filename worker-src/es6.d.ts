interface String {
  startsWith(searchString: string, position?: number): boolean;
  endsWith(searchString: string, endPosition?: number): boolean;
}
type DOMError = any;  // @types/filesystem needs this