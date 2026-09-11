import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The agent reads its system prompt from a markdown file at runtime; make sure it ships with the functions.
  outputFileTracingIncludes: { "/api/chat": ["./src/lib/agent/system.md"], "/a/[slug]": ["./src/lib/agent/system.md"] },
  /* config options here */
};

export default nextConfig;
