import fs from "fs";
import path from "path";
import { config } from "../config";
import { renderPostImage } from "./image-renderer";
import type { ImageData } from "./image-renderer";

export async function generateImage(imageData: ImageData): Promise<string | null> {
  try {
    const imagesDir = config.paths.images;
    fs.mkdirSync(imagesDir, { recursive: true });

    const buffer = await renderPostImage(imageData);
    const filename = `post-${Date.now()}.png`;
    const filepath = path.join(imagesDir, filename);
    fs.writeFileSync(filepath, buffer);
    console.log(`Image rendered: ${filepath} (${buffer.length} bytes)`);
    return filepath;
  } catch (err: any) {
    console.error(`Image rendering failed: ${err.message}`);
    return null;
  }
}

export function shouldGenerateImage(): boolean {
  return Math.random() * 100 < config.bot.imagePostPercentage;
}
