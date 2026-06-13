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
        {children}
        <footer className="site-footer">
          <strong>Numici</strong> · Citation Faithfulness Verification
          <span className="copyright">
            © 2026 Vidi Vici Technologies, Inc. (Numici). All rights reserved.
          </span>
        </footer>
      </body>
    </html>
  );
}
