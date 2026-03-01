import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { config } from "../config";

const genAI = new GoogleGenAI({ apiKey: config.gemini.apiKey });

export async function generateImage(prompt: string): Promise<string | null> {
  try {
    const imagesDir = config.paths.images;
    fs.mkdirSync(imagesDir, { recursive: true });

    // Use Gemini 3.1 Flash Image (Nano Banana 2) for image generation
    const response = await genAI.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: prompt,
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    // Extract image from response parts
    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) {
      console.warn("No parts in Gemini image response");
      return null;
    }

    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        const filename = `post-${Date.now()}.png`;
        const filepath = path.join(imagesDir, filename);
        const buffer = Buffer.from(part.inlineData.data, "base64");
        fs.writeFileSync(filepath, buffer);
        console.log(`Image generated: ${filepath}`);
        return filepath;
      }
    }

    console.warn("No image data in Gemini response");
    return null;
  } catch (err: any) {
    console.error(`Image generation failed: ${err.message}`);
    return null;
  }
}

export function shouldGenerateImage(): boolean {
  return Math.random() * 100 < config.bot.imagePostPercentage;
}
