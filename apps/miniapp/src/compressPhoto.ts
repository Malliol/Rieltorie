export interface CompressedPhoto {
  full: Blob;
  thumb: Blob;
  previewUrl: string;
}

const QUALITY = 0.82;
const FULL_MAX = 1600;
const THUMB_MAX = 480;

function resizeDimensions(w: number, h: number, max: number): [number, number] {
  if (w <= max && h <= max) return [w, h];
  const scale = max / Math.max(w, h);
  return [Math.round(w * scale), Math.round(h * scale)];
}

async function encodeWebP(bitmap: ImageBitmap, maxSize: number): Promise<Blob> {
  const [w, h] = resizeDimensions(bitmap.width, bitmap.height, maxSize);
  let canvas: OffscreenCanvas | HTMLCanvasElement;
  let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;

  if (typeof OffscreenCanvas !== "undefined") {
    canvas = new OffscreenCanvas(w, h);
    ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
  } else {
    canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    ctx = (canvas as HTMLCanvasElement).getContext("2d");
  }

  if (!ctx) throw new Error("Canvas context unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);

  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: "image/webp", quality: QUALITY });
  } else {
    return new Promise<Blob>((resolve, reject) => {
      (canvas as HTMLCanvasElement).toBlob(
        (b) => b ? resolve(b) : reject(new Error("toBlob failed")),
        "image/webp",
        QUALITY
      );
    });
  }
}

export async function compressPhoto(file: File): Promise<CompressedPhoto> {
  const bitmap = await createImageBitmap(file);
  const [full, thumb] = await Promise.all([
    encodeWebP(bitmap, FULL_MAX),
    encodeWebP(bitmap, THUMB_MAX),
  ]);
  bitmap.close();
  const previewUrl = URL.createObjectURL(full);
  return { full, thumb, previewUrl };
}
