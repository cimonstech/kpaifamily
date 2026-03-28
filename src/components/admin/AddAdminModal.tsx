"use client";

import { useToast } from "@/components/admin/Toast";
import { useEffect, useState } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AddAdminModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function AddAdminModal({ open, onClose, onSuccess }: AddAdminModalProps) {
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEmail("");
    setPassword("");
    setShowPw(false);
    setError(null);
    setLoading(false);
  }, [open]);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const em = email.trim().toLowerCase();
    if (!EMAIL_RE.test(em)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Temporary password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not create admin");
      showToast("Admin account created", "success");
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[160] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-[#1a1a2e]/10 bg-white p-4 shadow-xl sm:rounded-2xl sm:p-6"
        role="dialog"
        aria-modal
        aria-labelledby="add-admin-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <h2
          id="add-admin-title"
          className="font-serif text-lg font-semibold text-[#1a1a2e]"
        >
          Add family admin
        </h2>
        <p className="mt-1 text-xs text-[#1a1a2e]/60">
          Creates an admin account (not super admin). They can manage members and
          payments but not system settings.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-[#1a1a2e]/60">
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="mt-1 w-full rounded-lg border border-[#1a1a2e]/15 px-3 py-2 text-sm text-[#1a1a2e] outline-none ring-[#e8b84b]/30 focus:ring-2 disabled:opacity-60"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#1a1a2e]/60">
              Temporary Password
            </label>
            <div className="relative mt-1">
              <input
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full rounded-lg border border-[#1a1a2e]/15 px-3 py-2 pr-20 text-sm text-[#1a1a2e] outline-none ring-[#e8b84b]/30 focus:ring-2 disabled:opacity-60"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-[#e8b84b] hover:underline"
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-[#1a1a2e]/45">
              The admin will be required to change this on first login.
            </p>
          </div>

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex min-h-[44px] w-full items-center justify-center rounded-lg border border-[#1a1a2e]/15 px-4 py-2 text-sm text-[#1a1a2e]/70 hover:bg-[#f8f7f4] sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#e8b84b] px-4 py-2 text-sm font-semibold text-[#1a1a2e] shadow hover:bg-[#f0c35c] disabled:opacity-60 sm:w-auto"
            >
              {loading ? "Creating…" : "Create admin"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
