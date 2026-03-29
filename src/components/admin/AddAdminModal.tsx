"use client";

import { useToast } from "@/components/admin/Toast";
import { useEffect, useState } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function EyeIcon({ show }: { show: boolean }) {
  if (show) {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
        />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );
}

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
      className="neu-modal-backdrop motion-safe:animate-kpai-fade-in"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="neu-modal-sheet neu-modal-sheet--lg motion-safe:animate-kpai-scale-in max-h-[90vh]"
        role="dialog"
        aria-modal
        aria-labelledby="add-admin-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="neu-modal-handle sm:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 pr-2">
            <h2
              id="add-admin-title"
              className="font-serif text-lg font-bold"
              style={{ color: "var(--neu-text-primary)" }}
            >
              Add family admin
            </h2>
            <p className="mt-1 text-xs" style={{ color: "var(--neu-text-secondary)" }}>
              Creates an admin account (not super admin). They can manage members and
              payments but not system settings.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="neu-close-btn shrink-0"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-medium" style={{ color: "var(--neu-text-secondary)" }}>
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="neu-input mt-1 disabled:opacity-60"
            />
          </div>
          <div>
            <label className="text-xs font-medium" style={{ color: "var(--neu-text-secondary)" }}>
              Temporary Password
            </label>
            <div className="relative mt-1">
              <input
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="neu-input pr-12 disabled:opacity-60"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "none",
                  padding: 4,
                  color: "var(--neu-gold)",
                }}
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                <EyeIcon show={showPw} />
              </button>
            </div>
            <p className="mt-1.5 text-xs" style={{ color: "var(--neu-text-secondary)" }}>
              The admin will be required to change this on first login.
            </p>
          </div>

          {error ? (
            <div className="neu-error-box text-sm" role="alert">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="neu-button min-h-[44px] w-full sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="neu-button-gold min-h-[44px] w-full sm:w-auto"
            >
              {loading ? "Creating…" : "Create admin"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
