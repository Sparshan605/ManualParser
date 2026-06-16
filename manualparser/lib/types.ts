// Shared types used by both server routes and the client gallery.
// Keep this file free of runtime/server-only imports so it is safe to import
// (as types) from client components.

export interface VisionTag {
  name: string;
  confidence: number; // 0-100
}

export interface VisionResult {
  caption: { text: string; confidence: number } | null;
  tags: VisionTag[];
  readText: string[];
}

// One user-uploaded, AI-analyzed image (persisted in Blob Storage).
export interface UploadRecord {
  id: string;
  source: "upload";
  filename: string;
  image: string; // public Blob URL
  ai: VisionResult;
  createdAt: string;
}

// One sample sign parsed from the TTCM manual (sample data).
export interface SeedSign {
  code: string; // TAC code = the tag
  tag: string;
  primary_code: string;
  description: string;
  coc_code: string;
  sizes: { custom: string; regular: string; large: string; oversized: string };
  image: string; // relative path, e.g. "images/RA-1.png"
  source_page: number;
  imageUrl: string; // resolved URL the gallery loads
}

export interface GalleryData {
  blobEnabled: boolean;
  seedCount: number;
  uploadCount: number;
  seeds: SeedSign[];
  uploads: UploadRecord[];
}
