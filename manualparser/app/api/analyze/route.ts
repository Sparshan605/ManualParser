import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { visionConfigured, analyzeImageBytes } from "@/lib/vision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read raw bytes for a seeded sign image. Local/public paths are read from disk;
// absolute URLs (e.g. an Azure Blob URL) are fetched over HTTP.
async function loadImageBytes(imageUrl: string): Promise<Buffer> {
  if (/^https?:\/\//i.test(imageUrl)) {
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`Could not fetch image (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  const safe = imageUrl.replace(/^\/+/, "").replace(/\.\.(\/|\\)/g, "");
  return readFile(path.join(process.cwd(), "public", safe));
}

// POST { imageUrl }: analyze an already-displayed (seeded) image with Azure AI
// Vision and return the result. Used by the "Analyze" button on sample signs so
// you can compare the manual's code against what the AI sees.
export async function POST(request: Request) {
  try {
    const { imageUrl } = (await request.json()) as { imageUrl?: string };
    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
    }
    if (!visionConfigured()) {
      return NextResponse.json(
        { error: "Azure AI Vision is not configured. See AZURE_SETUP.md." },
        { status: 503 },
      );
    }
    const bytes = await loadImageBytes(imageUrl);
    const ai = await analyzeImageBytes(bytes);
    return NextResponse.json(ai);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
