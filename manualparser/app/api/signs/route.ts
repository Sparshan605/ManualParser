import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { blobEnabled, listRecords } from "@/lib/azure";
import type { SeedSign, UploadRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns everything the gallery needs:
//   seeds   - the 74 TTCM signs prepared offline by the Python parser (sample
//             data), each carrying its manual TAC code as the tag
//   uploads - user-uploaded images analyzed by Azure AI Vision (persisted in
//             Blob Storage); this is the live AI + persistent-data feature
export async function GET() {
  let seeds: SeedSign[] = [];
  try {
    const file = path.join(process.cwd(), "public", "signs", "tags.json");
    const manifest = JSON.parse(await readFile(file, "utf-8")) as Omit<SeedSign, "imageUrl">[];
    const base =
      process.env.NEXT_PUBLIC_BLOB_BASE_URL?.replace(/\/+$/, "") || "/signs";
    seeds = manifest.map((s) => ({ ...s, imageUrl: `${base}/${s.image}` }));
  } catch {
    seeds = [];
  }

  let uploads: UploadRecord[] = [];
  try {
    uploads = await listRecords();
  } catch {
    uploads = [];
  }

  return NextResponse.json({
    blobEnabled: blobEnabled(),
    seedCount: seeds.length,
    uploadCount: uploads.length,
    seeds,
    uploads,
  });
}
