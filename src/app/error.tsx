"use client";

import { useEffect } from "react";

/**
 * Next.js App Router's route-level error boundary. Without this, an
 * exception thrown anywhere in the render tree (not just inside the
 * detection loops, which already have their own try/catch) would white-
 * screen the whole app with no way back except a manual reload.
 *
 * Deliberately has no dependency on i18n/theme context: if the crash
 * happened inside one of those providers, relying on them here to render
 * the fallback would just throw again.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[FaceAIID] unhandled render error", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <p className="text-lg font-semibold">Algo correu mal. / Something went wrong.</p>
      <p className="text-sm text-foreground-muted max-w-md">
        Tenta recarregar a página. Se o problema continuar, verifica a consola do browser.
        <br />
        Try reloading the page. If it persists, check the browser console.
      </p>
      <button
        onClick={reset}
        className="rounded-full px-6 py-2 font-semibold text-black gradient-brand"
      >
        Tentar novamente / Try again
      </button>
    </div>
  );
}
