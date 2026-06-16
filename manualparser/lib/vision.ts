// Azure AI Vision (Image Analysis 4.0) helper.
// Sends raw image bytes and returns a small, UI-friendly result.
// The endpoint + key are read from server-side env vars only (never the client).
import type { VisionResult } from "./types";

export type { VisionResult, VisionTag } from "./types";

export function visionConfigured(): boolean {
  return Boolean(process.env.VISION_ENDPOINT && process.env.VISION_KEY);
}

// Shape of the bits of the Azure response we use.
interface VisionApiResponse {
  captionResult?: { text: string; confidence: number };
  tagsResult?: { values: { name: string; confidence: number }[] };
  readResult?: { blocks: { lines: { text: string }[] }[] };
}

function normalize(json: VisionApiResponse): VisionResult {
  const tags = (json.tagsResult?.values ?? []).map((t) => ({
    name: t.name,
    confidence: Math.round((t.confidence ?? 0) * 100),
  }));
  const readText = (json.readResult?.blocks ?? []).flatMap((b) =>
    (b.lines ?? []).map((l) => l.text),
  );
  const caption = json.captionResult
    ? {
        text: json.captionResult.text,
        confidence: Math.round((json.captionResult.confidence ?? 0) * 100),
      }
    : null;
  return { caption, tags, readText };
}

async function callVision(bytes: Buffer, features: string): Promise<Response> {
  const endpoint = process.env.VISION_ENDPOINT!.replace(/\/+$/, "");
  const url =
    `${endpoint}/computervision/imageanalysis:analyze` +
    `?api-version=2024-02-01&features=${encodeURIComponent(features)}`;
  return fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": process.env.VISION_KEY!,
      "Content-Type": "application/octet-stream",
    },
    body: new Uint8Array(bytes),
  });
}

// Analyze raw image bytes. Throws on failure with a readable message.
export async function analyzeImageBytes(bytes: Buffer): Promise<VisionResult> {
  const features = process.env.VISION_FEATURES || "caption,tags,read";
  let res = await callVision(bytes, features);
  // caption is region-restricted; if the request fails, retry without it.
  if (!res.ok && /caption/i.test(features)) {
    res = await callVision(bytes, "tags,read");
  }
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Azure AI Vision error (${res.status}): ${detail.slice(0, 300)}`);
  }
  return normalize((await res.json()) as VisionApiResponse);
}
