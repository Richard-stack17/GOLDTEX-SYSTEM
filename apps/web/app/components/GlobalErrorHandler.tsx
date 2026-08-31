"use client";

import React, { Component, ErrorInfo, ReactNode, useEffect, useState } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: error.stack || null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({
      error,
      errorInfo: errorInfo.componentStack || error.stack || null,
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <ErrorOverlay
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={() => this.setState({ hasError: false, error: null, errorInfo: null })}
        />
      );
    }
    return this.props.children;
  }
}

function ErrorOverlay({
  error,
  errorInfo,
  onReset,
}: {
  error: Error | null;
  errorInfo: string | null;
  onReset: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const errorMessage = error?.message || String(error || "Unknown Error");
  const stack = errorInfo || error?.stack || "No stack trace available";

  const handleCopy = () => {
    const textToCopy = `[APK ERROR DIAGNOSTIC]\nMessage: ${errorMessage}\nStack:\n${stack}`;
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = textToCopy;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-950 text-red-100 p-6 overflow-auto flex flex-col font-mono select-text">
      <div className="bg-red-950/80 border border-red-500/50 rounded-2xl p-6 shadow-2xl max-w-4xl mx-auto w-full my-auto flex flex-col gap-4">
        <div className="flex items-center gap-3 border-b border-red-500/30 pb-4">
          <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse" />
          <h1 className="text-xl font-black text-red-400 uppercase tracking-wide">
            Diagnóstico de Error APK
          </h1>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-red-300/70 uppercase">Mensaje del Error:</span>
          <p className="text-base font-bold text-white bg-black/60 p-3 rounded-lg border border-red-900/50 break-words">
            {errorMessage}
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-red-300/70 uppercase">Origen / Stack Trace:</span>
          <pre className="text-xs font-mono text-red-200/80 bg-black/80 p-4 rounded-lg border border-red-950 max-h-60 overflow-auto whitespace-pre-wrap break-all">
            {stack}
          </pre>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => {
              onReset();
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            }}
            className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold text-sm rounded-xl transition-colors shadow-lg active:scale-95 cursor-pointer"
          >
            Reintentar / Recargar
          </button>
          <button
            onClick={handleCopy}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-sm rounded-xl transition-colors border border-slate-700 active:scale-95 cursor-pointer"
          >
            {copied ? "✓ Copiado al Portapapeles" : "Copiar Error"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function GlobalErrorHandler({ children }: { children: ReactNode }) {
  const isApkMode = process.env.NEXT_PUBLIC_APP_MODE === "apk";
  const [globalError, setGlobalError] = useState<{ error: Error; info?: string } | null>(null);

  useEffect(() => {
    if (!isApkMode) return;

    const handleWindowError = (event: ErrorEvent) => {
      const msg = event.message || event.error?.message || "";
      if (msg.includes("triggerEvent") || msg.includes("webpack-hmr")) {
        return;
      }
      console.error("Global Window Error caught:", event.error || event.message);
      setGlobalError({
        error: event.error || new Error(event.message || "Global Window Error"),
        info: `${event.filename || ""}:${event.lineno || ""}:${event.colno || ""}`,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled Rejection caught:", event.reason);
      const err = event.reason instanceof Error ? event.reason : new Error(String(event.reason || "Unhandled Promise Rejection"));
      setGlobalError({
        error: err,
        info: err.stack || "Unhandled Promise Rejection",
      });
    };

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, [isApkMode]);

  if (isApkMode && globalError) {
    return (
      <ErrorOverlay
        error={globalError.error}
        errorInfo={globalError.info || null}
        onReset={() => setGlobalError(null)}
      />
    );
  }

  if (isApkMode) {
    return <ErrorBoundary>{children}</ErrorBoundary>;
  }

  return <>{children}</>;
}
