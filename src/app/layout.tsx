import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stock Research",
  description:
    "Evidence-based stock scoring and congressional trading tracker",
};

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/picks", label: "Top Picks" },
  { href: "/congress", label: "Congress Trades" },
  { href: "/watchlist", label: "Watchlist" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <header className="border-b border-zinc-800 bg-zinc-900/60 sticky top-0 z-10 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight text-emerald-400">
              StockResearch
            </Link>
            <div className="flex gap-4 text-sm text-zinc-300">
              {navLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="hover:text-white transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          {children}
        </main>
        <footer className="border-t border-zinc-800 py-4">
          <p className="mx-auto max-w-6xl px-4 text-xs text-zinc-500">
            For research and education only — not financial advice. Scores are
            derived from historical data, which does not predict future
            returns. Congressional trades are public STOCK Act disclosures and
            may be reported up to 45 days after the trade occurred.
          </p>
        </footer>
      </body>
    </html>
  );
}
