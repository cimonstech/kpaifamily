"use client";

import { APP_NAME } from "@/lib/constants";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

type SessionPayload = {
  id: string;
  email: string;
  role: "super" | "admin";
};

const AUTH_PATHS = [
  "/admin/login",
  "/admin/forgot-password",
  "/admin/reset-password",
  "/admin/first-time-reset",
];

function isAuthPath(pathname: string | null) {
  if (!pathname) return false;
  return AUTH_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

function IconGrid({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z" />
    </svg>
  );
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconDoc({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}

function IconKey({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.777 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

function IconShield({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconCog({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2m0 18v2m-7.78-15.56l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2m-15.56 7.78l1.42-1.42M17.36 5.64l1.42-1.42" />
    </svg>
  );
}

function IconMenu({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

const navCls =
  "flex min-h-[48px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition";
const navInactive = "text-white/70 hover:bg-white/5 hover:text-white";
const navActive = "bg-[#e8b84b]/15 text-[#e8b84b]";

export function AdminShell({
  session,
  children,
}: {
  session: SessionPayload | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  if (isAuthPath(pathname)) {
    return <>{children}</>;
  }

  if (!session) {
    return null;
  }

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    setMenuOpen(false);
    router.push("/admin/login");
    router.refresh();
  }

  function NavLink({
    href,
    label,
    icon,
    overlay,
  }: {
    href: string;
    label: string;
    icon: React.ReactNode;
    overlay?: boolean;
  }) {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        href={href}
        onClick={overlay ? () => setMenuOpen(false) : undefined}
        className={`${navCls} ${active ? navActive : navInactive}`}
      >
        <span className="h-5 w-5 shrink-0 opacity-90">{icon}</span>
        {label}
      </Link>
    );
  }

  const navItems = (
    <>
      <NavLink
        href="/admin"
        label="Dashboard"
        icon={<IconGrid className="h-5 w-5" />}
        overlay
      />
      <NavLink
        href="/admin/members"
        label="Members"
        icon={<IconUsers className="h-5 w-5" />}
        overlay
      />
      <NavLink
        href="/admin/reports"
        label="Reports"
        icon={<IconDoc className="h-5 w-5" />}
        overlay
      />
      <NavLink
        href="/admin/codes"
        label="Access Codes"
        icon={<IconKey className="h-5 w-5" />}
        overlay
      />
      {session.role === "super" ? (
        <>
          <NavLink
            href="/admin/audit"
            label="Audit Log"
            icon={<IconShield className="h-5 w-5" />}
            overlay
          />
          <NavLink
            href="/admin/settings"
            label="Settings"
            icon={<IconCog className="h-5 w-5" />}
            overlay
          />
        </>
      ) : null}
    </>
  );

  const sidebar = (
    <aside className="fixed left-0 top-0 z-40 hidden h-full w-[220px] flex-col border-r border-white/10 bg-[#161627] lg:flex">
      <div className="border-b border-white/10 px-4 py-5">
        <p className="font-serif text-lg font-semibold text-[#e8b84b]">
          {APP_NAME}
        </p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        <NavLink
          href="/admin"
          label="Dashboard"
          icon={<IconGrid className="h-5 w-5" />}
        />
        <NavLink
          href="/admin/members"
          label="Members"
          icon={<IconUsers className="h-5 w-5" />}
        />
        <NavLink
          href="/admin/reports"
          label="Reports"
          icon={<IconDoc className="h-5 w-5" />}
        />
        <NavLink
          href="/admin/codes"
          label="Access Codes"
          icon={<IconKey className="h-5 w-5" />}
        />
        {session.role === "super" ? (
          <>
            <NavLink
              href="/admin/audit"
              label="Audit Log"
              icon={<IconShield className="h-5 w-5" />}
            />
            <NavLink
              href="/admin/settings"
              label="Settings"
              icon={<IconCog className="h-5 w-5" />}
            />
          </>
        ) : null}
      </nav>
      <div className="border-t border-white/10 p-4">
        <p className="truncate text-xs text-white/50">{session.email}</p>
        <span className="mt-1 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#e8b84b]">
          {session.role}
        </span>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-lg border border-white/15 text-xs font-semibold text-white/80 transition hover:bg-white/5"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[#f8f7f4] text-[#1a1a2e]">
      {sidebar}

      {menuOpen ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-[#1a1a2e] lg:hidden"
          role="dialog"
          aria-modal
          aria-label="Navigation menu"
        >
          <div className="flex shrink-0 justify-end p-4">
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-lg text-white/80 transition hover:bg-white/10"
              aria-label="Close menu"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 pb-8">
            {navItems}
          </nav>
          <div className="shrink-0 border-t border-white/10 p-4">
            <p className="truncate text-sm text-white/60">{session.email}</p>
            <span className="mt-2 inline-block rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#e8b84b]">
              {session.role}
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-lg border border-white/20 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Sign Out
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-screen min-w-0 flex-col lg:ml-[220px]">
        <header className="flex items-center gap-3 border-b border-[#1a1a2e]/10 bg-white px-4 py-3 lg:hidden">
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-[#e8b84b]">
            {APP_NAME}
          </p>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-lg text-[#1a1a2e] hover:bg-[#f8f7f4]"
            aria-label="Open menu"
          >
            <IconMenu className="h-6 w-6" />
          </button>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
