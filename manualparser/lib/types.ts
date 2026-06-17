// Shared types used by both server routes and the client gallery.
// Keep this file free of runtime/server-only imports so it is safe to import
// (as types) from client components.

export interface VisionTag {
  name: string;   // the label AI gave the image, e.g. "stop sign"
  confidence: number; // how sure the AI is, 0-100
}

export interface VisionResult {
  caption: { text: string; confidence: number } | null;
  tags: VisionTag[];// list of labels AI detected
  readText: string[]; // any text AI read from the image (OCR)
}

// One user-uploaded, AI-analyzed image (persisted in Blob Storage).
export interface UploadRecord {
  id: string;  // unique ID for this upload
  source: "upload";// marker saying "this came from a user upload"
  filename: string;// original file name
  image: string;// public URL where the image is stored
  ai: VisionResult;// the AI analysis result for this image
  createdAt: string;// when it was uploaded
}

// Represents one sample traffic sign from the manual (pre-loaded sample data,
// not uploaded by a user).
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
  blobEnabled: boolean;   // is Azure Blob Storage configured?
  seedCount: number;      // how many sample signs exist
  uploadCount: number;    // how many user uploads exist
  seeds: SeedSign[];      // the sample signs
  uploads: UploadRecord[]; // the user uploads
}
