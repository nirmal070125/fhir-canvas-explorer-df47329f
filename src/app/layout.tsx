import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/styles.css";

// The CSP nonce is per-request, so pages must render dynamically for Next to
// stamp it onto the inline hydration scripts (a static page can't carry a nonce).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "FHIR Explorer — Browse any FHIR R4 server",
  description:
    "Interactive UI for exploring FHIR R4 servers with a read-only AI assistant powered by the WSO2 FHIR MCP Server.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
