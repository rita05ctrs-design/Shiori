"use client";

import React, { useState } from "react";
import { Check, Clock, Loader2, UserCheck, UserMinus, UserPlus, X } from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

interface FriendActionButtonProps {
  target: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  size?: "sm" | "md";
  compactIconOnly?: boolean;
  className?: string;
}

export function FriendActionButton({
  target,
  size = "sm",
  compactIconOnly = false,
  className,
}: FriendActionButtonProps) {
  const { profile, getFriendRelation, addFriend, acceptFriend, removeFriend } =
    useShiori();
  const { tr } = useTranslation();
  const [busy, setBusy] = useState(false);

  const isMe =
    target.id === profile.id ||
    target.username.toLowerCase() === profile.username.toLowerCase();
  if (isMe) return null;

  const relation = getFriendRelation(target.id, target.username);
  const hClass = size === "md" ? "h-10 px-4 text-xs" : "h-9 px-3 text-xs";

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  if (relation === "FRIENDS") {
    if (compactIconOnly) {
      return (
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => removeFriend(target))}
          title={`${tr("Ami")} · ${target.displayName}`}
          className={cn(
            "w-7 h-7 rounded-lg bg-emerald-500/18 hover:bg-rose-500/20 border border-emerald-400/40 hover:border-rose-400/45 text-emerald-300 hover:text-rose-300 flex items-center justify-center transition-colors cursor-pointer shrink-0",
            className
          )}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
        </button>
      );
    }

    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => void run(() => removeFriend(target))}
        title={tr("Retirer")}
        className={cn(
          "group rounded-xl bg-emerald-500/15 hover:bg-rose-500/18 border border-emerald-400/40 hover:border-rose-400/45 text-emerald-300 hover:text-rose-300 font-semibold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0",
          hClass,
          className
        )}
      >
        {busy ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <>
            <UserCheck className="w-3.5 h-3.5 group-hover:hidden" />
            <UserMinus className="w-3.5 h-3.5 hidden group-hover:block" />
          </>
        )}
        <span className="group-hover:hidden">{tr("Ami")}</span>
        <span className="hidden group-hover:inline">{tr("Retirer")}</span>
      </button>
    );
  }

  if (relation === "PENDING_OUTGOING") {
    if (compactIconOnly) {
      return (
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => removeFriend(target))}
          title={tr("En attente")}
          className={cn(
            "w-7 h-7 rounded-lg bg-amber-500/18 hover:bg-rose-500/20 border border-amber-400/40 text-amber-300 hover:text-rose-300 flex items-center justify-center transition-colors cursor-pointer shrink-0",
            className
          )}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
        </button>
      );
    }

    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => void run(() => removeFriend(target))}
        title={tr("Annuler")}
        className={cn(
          "group rounded-xl bg-amber-500/15 hover:bg-rose-500/18 border border-amber-400/40 hover:border-rose-400/45 text-amber-200 hover:text-rose-300 font-semibold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0",
          hClass,
          className
        )}
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
        <span className="group-hover:hidden">{tr("En attente")}</span>
        <span className="hidden group-hover:inline">{tr("Annuler")}</span>
      </button>
    );
  }

  if (relation === "PENDING_INCOMING") {
    return (
      <div className={cn("inline-flex items-center gap-1.5 shrink-0", className)}>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => acceptFriend(target))}
          className={cn(
            "rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#071510] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer",
            compactIconOnly ? "w-7 h-7 p-0" : hClass
          )}
          title={tr("Accepter")}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {!compactIconOnly && <span>{tr("Accepter")}</span>}
        </button>
        {!compactIconOnly && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => removeFriend(target))}
            title={tr("Refuser")}
            className={cn(
              "rounded-xl bg-white/[0.06] hover:bg-rose-500/20 border border-white/[0.1] text-[#B8BCCB] hover:text-rose-300 inline-flex items-center justify-center cursor-pointer",
              size === "md" ? "h-10 w-10" : "h-9 w-9"
            )}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  // relation === "NONE"
  if (compactIconOnly) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => void run(() => addFriend(target))}
        title={tr("Ajouter en ami")}
        className={cn(
          "w-7 h-7 rounded-lg bg-accent/20 hover:bg-accent border border-accent/45 text-accent-soft hover:text-accent-fg flex items-center justify-center transition-colors cursor-pointer shrink-0",
          className
        )}
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void run(() => addFriend(target))}
      className={cn(
        "rounded-xl bg-accent/18 hover:bg-accent border border-accent/45 hover:border-accent text-accent-soft hover:text-accent-fg font-semibold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0",
        hClass,
        className
      )}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
      <span>{tr("Ajouter en ami")}</span>
    </button>
  );
}
