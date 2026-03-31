"use client";

import { APP_NAME } from "@/lib/constants";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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

function currentYm() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function emailInitials(email: string) {
  const local = email.split("@")[0] ?? email;
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function IconGrid({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z" />
    </svg>
  );
}

function IconClipboard({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
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

function IconReceipt({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z" />
      <path d="M9 7h6M9 11h6M9 15h4" />
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
  const ym = useMemo(() => currentYm(), []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    function onChange() {
      if (mq.matches) setMenuOpen(false);
    }
    mq.addEventListener("change", onChange);
    onChange();
    return () => mq.removeEventListener("change", onChange);
  }, []);

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

  function isNavActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    if (href.startsWith("/admin/checklist")) {
      return pathname.startsWith("/admin/checklist");
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function DesktopNavLink({
    href,
    label,
    icon,
  }: {
    href: string;
    label: string;
    icon: React.ReactNode;
  }) {
    const active = isNavActive(href);
    return (
      <Link
        href={href}
        className={`neu-nav-link min-h-[48px] ${active ? "neu-nav-link-active" : ""}`}
      >
        <span className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center">
          {icon}
        </span>
        {label}
      </Link>
    );
  }

  function OverlayNavLink({
    href,
    label,
    icon,
  }: {
    href: string;
    label: string;
    icon: React.ReactNode;
  }) {
    const active = isNavActive(href);
    return (
      <Link
        href={href}
        onClick={() => setMenuOpen(false)}
        className={`neu-nav-link min-h-[48px] text-[var(--neu-text-primary)] ${active ? "neu-nav-link-active" : ""}`}
        style={{ color: active ? undefined : "var(--neu-text-secondary)" }}
      >
        <span className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center">
          {icon}
        </span>
        {label}
      </Link>
    );
  }

  const sidebar = (
    <aside className="neu-sidebar fixed left-0 top-0 z-40 hidden h-full w-[260px] flex-col lg:flex">
      <div className="px-6 py-6">
        <p
          className="font-serif text-lg font-bold"
          style={{ color: "var(--neu-gold)" }}
        >
          {APP_NAME}
        </p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4">
        <DesktopNavLink
          href="/admin"
          label="Home"
          icon={<IconGrid className="h-[18px] w-[18px]" />}
        />
        <DesktopNavLink
          href={`/admin/checklist/${ym}`}
          label="Checklist"
          icon={<IconClipboard className="h-[18px] w-[18px]" />}
        />
        <DesktopNavLink
          href="/admin/members"
          label="Members"
          icon={<IconUsers className="h-[18px] w-[18px]" />}
        />
        <DesktopNavLink
          href="/admin/reports"
          label="Reports"
          icon={<IconDoc className="h-[18px] w-[18px]" />}
        />
        <DesktopNavLink
          href="/admin/expenses"
          label="Expenses"
          icon={<IconReceipt className="h-[18px] w-[18px]" />}
        />
        <DesktopNavLink
          href="/admin/codes"
          label="Access Codes"
          icon={<IconKey className="h-[18px] w-[18px]" />}
        />
        {session.role === "super" ? (
          <>
            <DesktopNavLink
              href="/admin/audit"
              label="Audit Log"
              icon={<IconShield className="h-[18px] w-[18px]" />}
            />
            <DesktopNavLink
              href="/admin/settings"
              label="Settings"
              icon={<IconCog className="h-[18px] w-[18px]" />}
            />
          </>
        ) : null}
      </nav>
      <div className="mt-auto p-4">
        <div className="neu-card-sm flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div
              className="neu-avatar flex h-10 w-10 shrink-0 items-center justify-center text-xs"
              style={{
                background: "linear-gradient(145deg, #f0c05a, #d4a43c)",
                color: "var(--neu-navy)",
                boxShadow: "var(--neu-raised)",
              }}
            >
              {emailInitials(session.email)}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-xs"
                style={{ color: "var(--neu-text-secondary)" }}
              >
                {session.email}
              </p>
              <span className="neu-badge neu-badge-neutral mt-1 inline-block uppercase">
                {session.role}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="neu-button mt-1 w-full min-h-[44px] text-xs font-semibold"
          >
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );

  const pillBg = "#e8ecf1";

  const mobileNavEntries = [
    { href: "/admin", label: "Home", Icon: IconGrid },
    { href: `/admin/checklist/${ym}`, label: "Checklist", Icon: IconClipboard },
    { href: "/admin/members", label: "Members", Icon: IconUsers },
    { href: "/admin/reports", label: "Reports", Icon: IconDoc },
    { href: "/admin/expenses", label: "Expenses", Icon: IconReceipt },
  ] as const;

  type MobileNavEntry = (typeof mobileNavEntries)[number];

  function MobileSideNavLink({ entry }: { entry: MobileNavEntry }) {
    const active = isNavActive(entry.href);
    const Icon = entry.Icon;
    return (
      <Link
        href={entry.href}
        className="flex min-w-[56px] flex-col items-center gap-0.5 rounded-2xl px-2.5 py-2 transition-all"
        style={
          active
            ? {
                background: "linear-gradient(145deg, #f0c05a, #d4a43c)",
                boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.15)",
                color: "#1a1a2e",
              }
            : { color: "#718096" }
        }
      >
        <Icon className="h-5 w-5" />
        <span className="text-[10px] font-medium">{entry.label}</span>
      </Link>
    );
  }

  const checklistEntry = mobileNavEntries[1];
  const ChecklistIcon = checklistEntry.Icon;
  const checklistActive = isNavActive(checklistEntry.href);

  return (
    <div
      className="min-h-screen"
      style={{
        background: "var(--neu-bg)",
        color: "var(--neu-text-primary)",
      }}
    >
      {sidebar}

      {menuOpen ? (
        <div
          className="neu-admin-mobile-menu fixed inset-0 z-[70] flex flex-col overflow-y-auto motion-safe:animate-kpai-fade-in"
          style={{ background: "var(--neu-bg)" }}
          role="dialog"
          aria-modal
          aria-label="Menu"
        >
          <div className="flex shrink-0 justify-end p-4">
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="neu-close-btn"
              aria-label="Close menu"
            >
              <svg
                className="h-5 w-5"
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
          <nav className="flex flex-1 flex-col gap-1 px-4 pb-8">
            <OverlayNavLink
              href="/admin"
              label="Home"
              icon={<IconGrid className="h-[18px] w-[18px]" />}
            />
            <OverlayNavLink
              href={`/admin/checklist/${ym}`}
              label="Checklist"
              icon={<IconClipboard className="h-[18px] w-[18px]" />}
            />
            <OverlayNavLink
              href="/admin/members"
              label="Members"
              icon={<IconUsers className="h-[18px] w-[18px]" />}
            />
            <OverlayNavLink
              href="/admin/reports"
              label="Reports"
              icon={<IconDoc className="h-[18px] w-[18px]" />}
            />
            <OverlayNavLink
              href="/admin/expenses"
              label="Expenses"
              icon={<IconReceipt className="h-[18px] w-[18px]" />}
            />
            <OverlayNavLink
              href="/admin/codes"
              label="Access Codes"
              icon={<IconKey className="h-[18px] w-[18px]" />}
            />
            {session.role === "super" ? (
              <>
                <OverlayNavLink
                  href="/admin/audit"
                  label="Audit Log"
                  icon={<IconShield className="h-[18px] w-[18px]" />}
                />
                <OverlayNavLink
                  href="/admin/settings"
                  label="Settings"
                  icon={<IconCog className="h-[18px] w-[18px]" />}
                />
              </>
            ) : null}
          </nav>
          <div className="neu-divider mx-4" />
          <div className="shrink-0 p-4">
            <p
              className="truncate text-sm"
              style={{ color: "var(--neu-text-secondary)" }}
            >
              {session.email}
            </p>
            <span className="neu-badge neu-badge-neutral mt-2 inline-block uppercase">
              {session.role}
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="neu-button mt-4 w-full min-h-[48px] font-semibold"
            >
              Sign Out
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-screen min-w-0 flex-col lg:ml-[260px]">
        <header
          className="flex h-[60px] shrink-0 items-center gap-3 px-4 lg:hidden"
          style={{
            background: "var(--neu-bg)",
            boxShadow: "0 4px 12px var(--neu-shadow-dark)",
          }}
        >
          <p
            className="min-w-0 flex-1 truncate font-serif text-base font-bold"
            style={{ color: "var(--neu-gold)" }}
          >
            {APP_NAME}
          </p>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="neu-avatar flex h-10 w-10 shrink-0 items-center justify-center text-xs font-semibold"
            style={{
              background: "linear-gradient(145deg, #f0c05a, #d4a43c)",
              color: "var(--neu-navy)",
            }}
            aria-label="Open menu"
          >
            {emailInitials(session.email)}
          </button>
        </header>

        <main className="flex-1 overflow-auto p-4 pb-[100px] motion-safe:animate-kpai-fade-up sm:p-6 lg:pb-8 lg:pt-8">
          {children}
        </main>

        <nav
          className="pointer-events-none fixed bottom-5 left-1/2 z-50 w-[calc(100%-40px)] max-w-[380px] -translate-x-1/2 lg:hidden"
          aria-label="Primary"
        >
          <div className="pointer-events-auto relative h-[92px] shrink-0">
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 z-[49] -translate-x-1/2"
              style={{
                top: 14,
                width: 72,
                height: 36,
                background: pillBg,
                borderRadius: "0 0 36px 36px",
              }}
            />
            <div
              className="absolute bottom-0 left-0 right-0 flex h-[65px] items-center px-2"
              style={{
                background: pillBg,
                borderRadius: 35,
                boxShadow: "var(--neu-pill)",
                zIndex: 48,
              }}
            >
              <div className="flex flex-1 items-center justify-around">
                <MobileSideNavLink entry={mobileNavEntries[0]} />
                <MobileSideNavLink entry={mobileNavEntries[2]} />
              </div>
              <div className="w-14 shrink-0" />
              <div className="flex flex-1 items-center justify-around">
                <MobileSideNavLink entry={mobileNavEntries[3]} />
                <MobileSideNavLink entry={mobileNavEntries[4]} />
              </div>
            </div>
            <div
              className="absolute bottom-[34px] left-1/2 z-[51] flex -translate-x-1/2 flex-col items-center"
              style={{ width: 72 }}
            >
              <Link
                href={checklistEntry.href}
                aria-label={checklistEntry.label}
                className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full transition-transform hover:-translate-y-0.5 active:scale-95"
                style={{
                  background: "linear-gradient(135deg, #f0c05a, #d4a43c)",
                  boxShadow: checklistActive
                    ? "0 -4px 20px rgba(232,184,75,0.6), 0 8px 24px rgba(0,0,0,0.25), inset 2px 2px 6px rgba(0,0,0,0.15)"
                    : "0 -4px 20px rgba(232,184,75,0.4), 0 8px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3)",
                }}
              >
                <ChecklistIcon className="h-6 w-6 text-white" />
              </Link>
              <span
                className="mt-0.5 text-center text-[10px] font-medium leading-tight"
                style={{
                  color: checklistActive ? "#e8b84b" : "#718096",
                }}
              >
                Checklist
              </span>
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}
