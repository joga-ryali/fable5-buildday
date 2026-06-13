// Domain selector — simple links carrying ?domain=. Self-contained (no
// server-only imports) so it works in both server and client components.
const DOMAINS = [
  { key: "corporate_filings", label: "Corporate Filings" },
  { key: "legal", label: "Law" },
];

export default function DomainTabs({
  current,
  basePath,
}: {
  current: string;
  basePath: string;
}) {
  return (
    <div className="domain-tabs">
      {DOMAINS.map((d) => (
        <a
          key={d.key}
          href={`${basePath}?domain=${d.key}`}
          className={`domain-tab ${d.key === current ? "active" : ""}`}
        >
          {d.label}
        </a>
      ))}
    </div>
  );
}
