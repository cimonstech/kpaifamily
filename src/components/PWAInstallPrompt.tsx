"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

type Platform = "android" | "ios" | "other";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInstallPrompt({
  startUrl,
}: {
  startUrl: "/" | "/admin/login";
}) {
  const [platform, setPlatform] = useState<Platform>("other");
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const wasDismissed = sessionStorage.getItem("pwa-prompt-dismissed");
    if (wasDismissed) return;

    const ua = navigator.userAgent;
    const msStream = (window as unknown as { MSStream?: unknown }).MSStream;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !msStream;
    const isAndroid = /Android/.test(ua);

    if (isIOS) {
      const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua);
      if (isSafari) {
        setPlatform("ios");
        setShowPrompt(true);
      }
    } else if (isAndroid) {
      setPlatform("android");
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setPlatform("android");
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (platform === "android" && deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    sessionStorage.setItem("pwa-prompt-dismissed", "true");
  };

  if (!showPrompt || dismissed) return null;

  const overlayStyle: CSSProperties = {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    padding: "16px",
    paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
    background: "linear-gradient(to top, rgba(8,8,24,0.95), transparent)",
    display: "flex",
    justifyContent: "center",
  };

  const cardStyle: CSSProperties = {
    background: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "20px",
    padding: "16px 20px",
    width: "100%",
    maxWidth: "380px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  };

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  };

  const iconStyle: CSSProperties = {
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #f0c05a, #d4a43c)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontSize: "22px",
    fontWeight: "700",
    color: "#1a1a2e",
    fontFamily: "serif",
  };

  const titleStyle: CSSProperties = {
    color: "white",
    fontWeight: "600",
    fontSize: "15px",
    marginBottom: "2px",
  };

  const subtitleStyle: CSSProperties = {
    color: "rgba(255,255,255,0.5)",
    fontSize: "12px",
  };

  const installBtnStyle: CSSProperties = {
    background: "linear-gradient(135deg, #f0c05a, #d4a43c)",
    border: "none",
    borderRadius: "12px",
    padding: "12px",
    color: "#1a1a2e",
    fontWeight: "700",
    fontSize: "14px",
    cursor: "pointer",
    width: "100%",
    boxShadow: "0 4px 20px rgba(232,184,75,0.4)",
  };

  const dismissBtnStyle: CSSProperties = {
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.4)",
    fontSize: "12px",
    cursor: "pointer",
    textAlign: "center",
    width: "100%",
  };

  if (platform === "ios") {
    return (
      <div style={overlayStyle} data-pwa-entry={startUrl}>
        <div style={cardStyle}>
          <div style={headerStyle}>
            <div style={iconStyle}>K</div>
            <div>
              <div style={titleStyle}>Add to Home Screen</div>
              <div style={subtitleStyle}>KF Contributions</div>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              style={{
                marginLeft: "auto",
                background: "rgba(255,255,255,0.1)",
                border: "none",
                borderRadius: "50%",
                width: "28px",
                height: "28px",
                color: "white",
                cursor: "pointer",
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.06)",
              borderRadius: "12px",
              padding: "12px",
              fontSize: "13px",
              color: "rgba(255,255,255,0.75)",
              lineHeight: "1.6",
            }}
          >
            <div
              style={{
                marginBottom: "8px",
                fontWeight: "600",
                color: "white",
              }}
            >
              Install this app on your iPhone:
            </div>
            <div>
              1. Tap the <strong style={{ color: "#e8b84b" }}>Share</strong>{" "}
              button
              <span style={{ fontSize: "16px" }}> ⎙ </span>
              at the bottom of Safari
            </div>
            <div>
              2. Scroll down and tap{" "}
              <strong style={{ color: "#e8b84b" }}>
                &quot;Add to Home Screen&quot;
              </strong>
            </div>
            <div>
              3. Tap <strong style={{ color: "#e8b84b" }}>&quot;Add&quot;</strong>{" "}
              in the top right
            </div>
          </div>
          <button type="button" onClick={handleDismiss} style={dismissBtnStyle}>
            Maybe later
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={overlayStyle} data-pwa-entry={startUrl}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div style={iconStyle}>K</div>
          <div>
            <div style={titleStyle}>Install KF Contributions</div>
            <div style={subtitleStyle}>
              Add to your home screen for quick access
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            style={{
              marginLeft: "auto",
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "50%",
              width: "28px",
              height: "28px",
              color: "white",
              cursor: "pointer",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
        <button type="button" onClick={handleInstall} style={installBtnStyle}>
          Install App
        </button>
        <button type="button" onClick={handleDismiss} style={dismissBtnStyle}>
          Not now
        </button>
      </div>
    </div>
  );
}
