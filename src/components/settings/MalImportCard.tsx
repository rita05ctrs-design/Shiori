"use client";

import React, { useRef, useState } from "react";
import {
  CheckCircle2,
  FileCode2,
  Loader2,
  Sparkles,
  Upload,
  AlertCircle,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import {
  parseMalXml,
  readMalFileAsXml,
  type MalParseResult,
} from "@/lib/mal-import";
import { cn } from "@/lib/utils";
import type { LibraryEntry } from "@/types/media";

export function MalImportCard() {
  const { importEntriesBulk } = useShiori();
  const inputRef = useRef<HTMLInputElement>(null);

  const [parsed, setParsed] = useState<MalParseResult | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    added: number;
    updated: number;
    unmatched: number;
  } | null>(null);

  const handleFilePick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setSummary(null);

    try {
      const xmlText = await readMalFileAsXml(file);
      const result = parseMalXml(xmlText);
      if (result.items.length === 0) {
        setParsed(null);
        setError(
          "Aucune entrée anime ou manga détectée. Vérifiez qu'il s'agit bien d'un export XML MyAnimeList."
        );
        return;
      }
      setFileName(file.name);
      setParsed(result);
    } catch (err) {
      setParsed(null);
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de lire ce fichier MyAnimeList."
      );
    }
  };

  const handleImport = async () => {
    if (!parsed || parsed.items.length === 0) return;
    setImporting(true);
    setError(null);
    setSummary(null);

    try {
      const res = await fetch("/api/anilist/mal-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: parsed.items.slice(0, 600) }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !Array.isArray(data.entries)) {
        setError(data?.error ?? "Échec de la correspondance avec le catalogue AniList.");
        return;
      }

      const imported = importEntriesBulk(
        data.entries as LibraryEntry[],
        mode,
        "Import MyAnimeList"
      );
      setSummary({
        added: imported.added,
        updated: imported.updated,
        unmatched: Number(data.unmatched ?? 0),
      });
    } catch {
      setError("Erreur réseau lors de la résolution des titres MyAnimeList.");
    } finally {
      setImporting(false);
    }
  };

  const animeCount = parsed?.items.filter((i) => i.type === "ANIME").length ?? 0;
  const mangaCount = parsed?.items.filter((i) => i.type === "MANGA").length ?? 0;

  return (
    <section
      id="mal-import"
      className="rounded-2xl card-surface p-5 sm:p-6 space-y-4 scroll-mt-24"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-400/35 flex items-center justify-center shrink-0">
            <FileCode2 className="w-5 h-5 text-sky-300" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <span>Importer depuis MyAnimeList (XML)</span>
              <span className="px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/30 font-mono text-[10px] text-sky-300">
                .xml / .xml.gz
              </span>
            </h2>
            <p className="text-xs text-[#858A9E] mt-0.5">
              Importez votre export officiel MyAnimeList (animes ou mangas, avec notes,
              chapitres et tomes). Les couvertures et fiches sont enrichies automatiquement.
            </p>
          </div>
        </div>
      </div>

      {/* File Dropzone / Picker */}
      <input
        ref={inputRef}
        type="file"
        accept=".xml,.gz,application/xml,text/xml,application/gzip"
        onChange={(e) => {
          void handleFilePick(e.target.files?.[0]);
          e.target.value = "";
        }}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-2xl border border-dashed border-white/[0.16] hover:border-accent/55 bg-white/[0.02] hover:bg-white/[0.045] px-4 py-5 text-center transition-all cursor-pointer group"
      >
        <Upload className="w-5 h-5 text-accent-soft mx-auto mb-2 group-hover:-translate-y-0.5 transition-transform" />
        <p className="text-xs font-semibold text-white">
          {fileName
            ? `Fichier chargé : ${fileName}`
            : "Choisir un export MyAnimeList (.xml ou .xml.gz)"}
        </p>
        <p className="text-[11px] text-[#7F8499] mt-1">
          Sur MAL : Profil → Export → Anime List / Manga List
        </p>
      </button>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/12 border border-rose-500/30 text-xs text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {parsed && (
        <div className="p-4 rounded-xl bg-obsidian/75 border border-white/[0.09] space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-white">
                {parsed.items.length} titre{parsed.items.length > 1 ? "s" : ""} détecté
                {parsed.items.length > 1 ? "s" : ""}
                {parsed.username ? ` · Compte @${parsed.username}` : ""}
              </p>
              <p className="text-[11px] text-[#858A9E] font-mono mt-0.5">
                {animeCount > 0 ? `${animeCount} animé${animeCount > 1 ? "s" : ""}` : ""}
                {animeCount > 0 && mangaCount > 0 ? " · " : ""}
                {mangaCount > 0 ? `${mangaCount} manga${mangaCount > 1 ? "s" : ""}` : ""}
                {parsed.items.length > 600 ? " (600 premiers importés)" : ""}
              </p>
            </div>

            <div className="inline-flex items-center p-0.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[11px]">
              {(
                [
                  { id: "merge", label: "Fusionner" },
                  { id: "replace", label: "Remplacer" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMode(opt.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer",
                    mode === opt.id
                      ? "bg-accent text-accent-fg font-semibold"
                      : "text-[#9A9EAE] hover:text-white"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={importing}
            onClick={() => void handleImport()}
            className="w-full sm:w-auto h-10 px-5 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-50 text-accent-fg text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            {importing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Résolution des fiches en cours...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Importer dans ma bibliothèque</span>
              </>
            )}
          </button>
        </div>
      )}

      {summary && (
        <div className="p-3.5 rounded-xl bg-emerald-500/12 border border-emerald-500/30 text-xs text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Import réussi : <strong>{summary.added}</strong> ajouté
            {summary.added > 1 ? "s" : ""}
            {summary.updated > 0 ? `, ${summary.updated} fusionné(s)` : ""}
            {summary.unmatched > 0
              ? ` (${summary.unmatched} sans correspondance AniList ignoré${summary.unmatched > 1 ? "s" : ""})`
              : ""}
            .
          </span>
        </div>
      )}
    </section>
  );
}
