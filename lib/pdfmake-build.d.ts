declare module 'pdfmake/build/pdfmake' {
  const pdfMake: unknown;
  export = pdfMake;
}

declare module 'pdfmake/build/vfs_fonts' {
  const virtualFileSystem: Record<string, string>;
  export = virtualFileSystem;
}
