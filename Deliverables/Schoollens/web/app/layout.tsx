import type { Metadata } from "next";
import { Noto_Sans, Noto_Sans_Myanmar } from "next/font/google";
import { SessionProvider } from "./session-context";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import "./globals.css";

const notoSans = Noto_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-latin",
});

const notoMyanmar = Noto_Sans_Myanmar({
  subsets: ["myanmar"],
  weight: ["400", "500", "600"],
  variable: "--font-myanmar",
});

export const metadata: Metadata = {
  title: "SchoolLens",
  description: "Evidence-linked school facts for Myanmar. AI reconciles sources. It does not rank schools.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${notoSans.variable} ${notoMyanmar.variable}`}>
      <body>
        <SessionProvider>
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <SiteHeader />
          <div id="main" tabIndex={-1}>
            {children}
          </div>
          <SiteFooter />
        </SessionProvider>
      </body>
    </html>
  );
}
