"use client";

import Link from "next/link";
import { useState } from "react";

type Reply = { status: string; message: string; href?: string };

/** "Can't find it? Request it": queues a pub.dev package to be added to the catalog. */
export function RequestPackage({ initial = "", compact = false }: { initial?: string; compact?: boolean }) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<Reply | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim().toLowerCase();
    if (!n) return;
    setBusy(true);
    setReply(null);
    try {
      const r = await fetch("/api/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: n }) });
      setReply(await r.json());
    } catch {
      setReply({ status: "error", message: "Couldn't send the request. Check your connection." });
    } finally {
      setBusy(false);
    }
  }

  const ok = reply && (reply.status === "queued" || reply.status === "exists");
  return (
    <div className={compact ? "" : "rounded-xl border border-line bg-card p-5"}>
      {!compact && (
        <>
          <h2 className="text-md font-semibold text-ink">Can&apos;t find a package?</h2>
          <p className="mt-1 text-sm text-body">pubscout covers pub.dev&apos;s most-used packages plus a hand-picked set. Ask for any other package and it&apos;s added automatically, usually within 10 minutes.</p>
        </>
      )}
      <form onSubmit={submit} className={`flex flex-wrap gap-2 ${compact ? "" : "mt-4"}`}>
        <label className="sr-only" htmlFor="req-name">Package name on pub.dev</label>
        <input
          id="req-name"
          value={name}
          onChange={(e) => { setName(e.target.value); setReply(null); }}
          placeholder="package_name"
          spellCheck={false}
          autoComplete="off"
          className="h-10 min-w-0 flex-1 rounded-md border border-line bg-ground px-3 font-mono text-sm text-ink outline-none placeholder:text-muted focus:border-cobalt"
        />
        <button type="submit" disabled={busy || !name.trim()} className="h-10 rounded-md bg-action px-4 text-sm font-medium text-white transition-colors hover:bg-action-hover disabled:opacity-50">
          {busy ? "Sending…" : "Request"}
        </button>
      </form>
      {reply && (
        <p role="status" className={`fade-in mt-3 text-sm ${ok ? "text-good" : "text-body"}`}>
          {reply.message}{" "}
          {reply.href && <Link href={reply.href} className="link">Open it</Link>}
        </p>
      )}
    </div>
  );
}
