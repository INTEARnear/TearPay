interface ImageMetadata {
  src: string;
  height?: number;
  width?: number;
}

declare module '*.webp' {
  const content: ImageMetadata;
  export default content;
}

declare module '*.png' {
  const content: ImageMetadata;
  export default content;
}

declare module '*.jpg' {
  const content: ImageMetadata;
  export default content;
}

declare module '*.jpeg' {
  const content: ImageMetadata;
  export default content;
}

declare module '*.svg' {
  const content: ImageMetadata;
  export default content;
} 