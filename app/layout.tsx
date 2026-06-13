import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Citation Faithfulness Verification",
  description:
    "Numici — verifies whether claims in AI research reports faithfully represent their cited sources.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <a href="/" className="brand">
            <span className="brand-mark">Numici</span>
            <span className="brand-sub">Citation Faithfulness</span>
          </a>
        </header>
        {children}
        <footer className="site-footer">
          Built by <strong>Numici</strong> · Citation Faithfulness Verification ·
          verifies claims against their cited sources
        </footer>
      </body>
    </html>
  );
}
