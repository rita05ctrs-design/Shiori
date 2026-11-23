"use client";

import React, { useState } from "react";
import {
  FolderPlus,
  Globe,
  Lock,
  Trash2,
  X,
  FolderHeart,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { cn } from "@/lib/utils";

const COLLECTION_COLORS = [
  "#E5484D",
  "#8B5CF6",
  "#0EA5E9",
  "#10B981",
  "#F59E0B",
  "#EC4899",
];

interface CollectionsManagerPanelProps {
  activeCollectionId: string;
  onSelectCollection: (id: string) => void;
  onClose?: () => void;
}

export function CollectionsManagerPanel({
  activeCollectionId,
  onSelectCollection,
  onClose,
}: CollectionsManagerPanelProps) {
  const { collections, createCollection, updateCollection, deleteCollection } = useShiori();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLLECTION_COLORS[0]);
  const [isPublic, setIsPublic] = useState(true);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const created = createCollection({ name, description, color, isPublic });
    setName("");
    setDescription("");
    onSelectCollection(created.id);
  };

  return (
    <div className="rounded-3xl card-surface border border-accent/25 p-4 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-accent flex items-center gap-1.5">
            <FolderHeart className="w-3.5 h-3.5" />
            <span>Collections personnalisées</span>
          </p>
          <h2 className="text-base sm:text-lg font-bold text-white mt-0.5">
            Créez vos propres sélections thématiques
          </h2>
          <p className="text-xs text-[#8A8FA4] mt-0.5">
            Regroupez vos œuvres par thème (ex. « Chefs-d&apos;œuvre automne », « À voir entre amis ») et partagez-les sur votre profil public si vous le souhaitez.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer les collections"
            className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.14] flex items-center justify-center text-white cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Create New Collection Form */}
      <form
        onSubmit={handleCreate}
        className="p-3.5 sm:p-4 rounded-2xl bg-obsidian/70 border border-white/[0.08] space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="Nom de la collection (ex: Pépites Seinen)..."
            className="h-10 px-3.5 rounded-xl bg-surface border border-white/[0.09] text-xs sm:text-sm text-white placeholder:text-[#656A7E] focus:outline-none focus:border-accent"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={240}
            placeholder="Description courte (optionnel)..."
            className="h-10 px-3.5 rounded-xl bg-surface border border-white/[0.09] text-xs sm:text-sm text-white placeholder:text-[#656A7E] focus:outline-none focus:border-accent"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              {COLLECTION_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Couleur ${c}`}
                  className={cn(
                    "w-6 h-6 rounded-full border-2 transition-transform cursor-pointer",
                    color === c ? "border-white scale-110" : "border-transparent opacity-70 hover:opacity-100"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsPublic((v) => !v)}
              className={cn(
                "h-8 px-3 rounded-full border text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors",
                isPublic
                  ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-200"
                  : "bg-white/[0.05] border-white/[0.1] text-[#9A9EAE]"
              )}
            >
              {isPublic ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              <span>{isPublic ? "Partagée sur mon profil" : "Privée"}</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={!name.trim()}
            className="h-9 px-4 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-45 text-accent-fg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-accent"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Créer la collection</span>
          </button>
        </div>
      </form>

      {/* Existing Collections Grid */}
      {collections.length === 0 ? (
        <p className="text-xs text-[#858A9E]">
          Aucune collection créée pour le moment. Une fois créée, ajoutez-y vos œuvres via le bouton d&apos;édition rapide de n&apos;importe quel titre.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {collections.map((col) => {
            const active = activeCollectionId === col.id;
            return (
              <div
                key={col.id}
                className={cn(
                  "p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-2.5",
                  active
                    ? "bg-accent/14 border-accent/50"
                    : "bg-obsidian/70 border-white/[0.08] hover:border-white/[0.16]"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectCollection(active ? "ALL" : col.id)}
                    className="text-left min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: col.color }}
                      />
                      <span className="text-xs sm:text-sm font-semibold text-white truncate">
                        {col.name}
                      </span>
                    </div>
                    {col.description && (
                      <p className="text-[11px] text-[#8E93A6] line-clamp-1 mt-0.5">
                        {col.description}
                      </p>
                    )}
                  </button>
                  <span className="px-2 py-0.5 rounded-full bg-white/[0.06] font-mono text-[10.5px] text-[#D2D6E6] shrink-0">
                    {col.mediaIds.length}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => updateCollection(col.id, { isPublic: !col.isPublic })}
                    className="text-[10.5px] text-[#9A9EAE] hover:text-white inline-flex items-center gap-1 cursor-pointer"
                  >
                    {col.isPublic ? (
                      <>
                        <Globe className="w-3 h-3 text-emerald-400" />
                        <span>Publique</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3 h-3 text-amber-400" />
                        <span>Privée</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onSelectCollection(active ? "ALL" : col.id)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[10.5px] font-semibold cursor-pointer",
                        active
                          ? "bg-accent text-accent-fg"
                          : "bg-white/[0.06] hover:bg-white/[0.12] text-white"
                      )}
                    >
                      {active ? "Filtrée ✓" : "Filtrer"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (active) onSelectCollection("ALL");
                        deleteCollection(col.id);
                      }}
                      title="Supprimer la collection"
                      className="p-1.5 rounded-lg text-[#7D8296] hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
