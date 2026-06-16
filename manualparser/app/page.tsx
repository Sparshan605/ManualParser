"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GalleryData, SeedSign, UploadRecord, VisionResult } from "@/lib/types";

// Shared rendering of an Azure AI Vision result.
function AiResult({ ai, cached }: { ai: VisionResult | null; cached?: boolean }) {
  if (!ai) return null;
  return (
    <div className="ai">
      <span className="ai-title">Azure AI Vision {cached ? "(cached)" : ""}</span>
      {ai.caption && (
        <div className="caption">
          “{ai.caption.text}” <span className="meta">{ai.caption.confidence}%</span>
        </div>
      )}
      {ai.tags.length > 0 && (
        <div className="tags">
          {ai.tags.slice(0, 8).map((t) => (
            <span className="tag" key={t.name}>
              <b>{t.name}</b> {t.confidence}%
            </span>
          ))}
        </div>
      )}
      {ai.readText.length > 0 && (
        <div className="ocr">
          <b>OCR:</b> {ai.readText.join(" ")}
        </div>
      )}
    </div>
  );
}

// A user-uploaded image: already analyzed by Azure AI Vision and persisted.
function UploadCard({ rec }: { rec: UploadRecord }) {
  return (
    <div className="card">
      <div className="thumb">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={rec.image} alt={rec.filename} loading="lazy" />
      </div>
      <div className="body">
        <span className="badge upload">uploaded</span>
        <div className="desc" title={rec.filename}>{rec.filename}</div>
        <div className="meta">{new Date(rec.createdAt).toLocaleString()}</div>
        <AiResult ai={rec.ai} />
      </div>
    </div>
  );
}

// A seeded TTCM sign: shows its manual code; "Analyze" runs Azure AI Vision so
// you can compare the manual's code against what the AI actually sees.
function SeedCard({ sign }: { sign: SeedSign }) {
  const [ai, setAi] = useState<VisionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasCode = Boolean(sign.code);

  async function analyze() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: sign.imageUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setAi(data as VisionResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="thumb">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={sign.imageUrl} alt={sign.description || sign.tag} loading="lazy" />
      </div>
      <div className="body">
        <span className={hasCode ? "badge" : "badge nocode"}>
          {hasCode ? sign.code : "no code"}
        </span>
        <div className="desc">{sign.description || "—"}</div>
        <div className="meta">
          {sign.coc_code ? `CoC ${sign.coc_code} · ` : ""}
          Regular {sign.sizes?.regular || "—"} · p.{sign.source_page}
        </div>
        <AiResult ai={ai} />
        {error && <div className="err">{error}</div>}
        <button className="analyze" onClick={analyze} disabled={loading}>
          {loading ? "Analyzing…" : ai ? "Re-analyze" : "Analyze with Azure AI"}
        </button>
      </div>
    </div>
  );
}

function UploadPanel({
  blobEnabled,
  onUploaded,
}: {
  blobEnabled: boolean;
  onUploaded: (rec: UploadRecord) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(f: File | null) {
    setError(null);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function submit() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onUploaded(data as UploadRecord);
      pick(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="uploader">
      <h2>Upload a sign image</h2>
      <p className="meta">
        The image is stored in Azure Blob Storage and analyzed by Azure AI Vision
        (tags, caption, and OCR). The result is saved and shown below.
      </p>
      {!blobEnabled && (
        <div className="notice">
          Upload needs Azure configured (<code>AZURE_STORAGE_CONNECTION_STRING</code>,{" "}
          <code>VISION_ENDPOINT</code>, <code>VISION_KEY</code>). See{" "}
          <code>AZURE_SETUP.md</code>. You can still browse the sample signs below.
        </div>
      )}
      <div className="upload-row">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
          disabled={!blobEnabled || busy}
        />
        <button
          className="primary"
          onClick={submit}
          disabled={!blobEnabled || !file || busy}
        >
          {busy ? "Analyzing…" : "Upload & Analyze"}
        </button>
      </div>
      {preview && (
        <div className="preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="preview" />
        </div>
      )}
      {error && <div className="err">{error}</div>}
    </section>
  );
}

export default function Home() {
  const [data, setData] = useState<GalleryData>({
    blobEnabled: false,
    seedCount: 0,
    uploadCount: 0,
    seeds: [],
    uploads: [],
  });
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [prefix, setPrefix] = useState("ALL");

  useEffect(() => {
    fetch("/api/signs")
      .then((r) => r.json())
      .then((d: GalleryData & { error?: string }) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setLoadErr(e instanceof Error ? e.message : String(e)));
  }, []);

  const prefixes = useMemo(() => {
    const set = new Set<string>();
    for (const s of data.seeds) {
      const m = (s.code || "").match(/^[A-Za-z]+/);
      if (m) set.add(m[0].toUpperCase());
    }
    return ["ALL", ...[...set].sort()];
  }, [data.seeds]);

  const filteredSeeds = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.seeds.filter((s) => {
      const codeOk = prefix === "ALL" || (s.code || "").toUpperCase().startsWith(prefix);
      const text = `${s.code} ${s.description}`.toLowerCase();
      return codeOk && (!q || text.includes(q));
    });
  }, [data.seeds, query, prefix]);

  function onUploaded(rec: UploadRecord) {
    setData((d) => ({ ...d, uploads: [rec, ...d.uploads] }));
  }

  return (
    <div className="wrap">
      <header className="hero">
        <h1>🚧 TTCM Sign Gallery</h1>
        <p>
          Upload a traffic-sign image and Azure AI Vision tags it, captions it, and
          reads any text (OCR). Uploads are stored in Azure Blob Storage. The sample
          signs below were parsed from the <em>Temporary Traffic Control Manual</em>{" "}
          and carry their manual <b>TAC code</b> — click <b>Analyze</b> to compare
          the official code with what the AI sees.
        </p>
      </header>

      {loadErr && <div className="notice">Could not load gallery: {loadErr}</div>}

      <UploadPanel blobEnabled={data.blobEnabled} onUploaded={onUploaded} />

      {data.uploads.length > 0 && (
        <>
          <h2>Your uploads · AI-tagged ({data.uploads.length})</h2>
          <div className="grid">
            {data.uploads.map((rec) => (
              <UploadCard key={rec.id} rec={rec} />
            ))}
          </div>
        </>
      )}

      <h2>Sample TTCM signs ({data.seeds.length})</h2>
      <div className="toolbar">
        <input
          type="search"
          placeholder="Search code or description… (e.g. stop, RB, yield)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={prefix} onChange={(e) => setPrefix(e.target.value)}>
          {prefixes.map((p) => (
            <option key={p} value={p}>
              {p === "ALL" ? "All codes" : p}
            </option>
          ))}
        </select>
        <span className="count">
          {filteredSeeds.length} / {data.seeds.length} signs
        </span>
      </div>
      <div className="grid">
        {filteredSeeds.map((s) => (
          <SeedCard key={s.image} sign={s} />
        ))}
      </div>
    </div>
  );
}
