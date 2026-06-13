/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bundle the data directories into the serverless functions so the
  // dashboard routes can read committed ground_truth/results/runs at runtime
  // on Vercel (read-only fs is fine — these routes only READ).
  outputFileTracingIncludes: {
    "/results": ["./results/**/*", "./runs/**/*", "./ground_truth/**/*"],
    "/verification": [
      "./results/**/*",
      "./runs/**/*",
      "./ground_truth/**/*",
      "./reports/**/*",
    ],
    "/harness-review": ["./ground_truth/**/*", "./reports/**/*"],
    "/api/cases": ["./ground_truth/**/*", "./reports/**/*"],
  },
};

export default nextConfig;
