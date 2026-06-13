"use client";

export default function ExportButton({
  data,
  filename,
  label = "Export JSON",
}: {
  data: unknown;
  filename: string;
  label?: string;
}) {
  function download() {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <button className="secondary-btn" onClick={download}>
      {label}
    </button>
  );
}
