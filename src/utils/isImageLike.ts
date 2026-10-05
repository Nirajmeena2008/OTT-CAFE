// A delivery partner's `photoUrl` can now hold an uploaded ID/document (PDF/DOC),
// not just a photo, so every place that renders it as an <img> must check this first
// and fall back to a file icon -- otherwise a PDF data: URL renders as a broken image.
export const isImageLike = (value: string): boolean =>
  /^data:image\//.test(value) || /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i.test(value);
