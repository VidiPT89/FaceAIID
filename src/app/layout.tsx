import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";
import { THEME_STORAGE_KEY, ThemeProvider } from "@/lib/theme";
import { DebugModeProvider } from "@/lib/debugMode";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://faceaiid.vercel.app"),
  title: "Face AI ID",
  description: "Real-time hand gesture, facial expression and head movement recognition, running entirely in the browser.",
};

// Applies the saved theme before first paint — without it, a dark-theme
// visitor saw the light palette flash until React hydrated.
const themeScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark"||t==="system")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt"
      data-theme="system"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <LanguageProvider>
            <DebugModeProvider>{children}</DebugModeProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
