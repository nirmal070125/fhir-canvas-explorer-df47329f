import { fhirFetch } from "./fhir-client";

export interface SampleManifest {
  generatedAt: string;
  generator: string;
  fhirVersion: string;
  patientCount: number;
  bundles: string[];
}

export interface LoadProgress {
  index: number;
  total: number;
  file: string;
  status: "loading" | "ok" | "fail";
  resources?: number;
  message?: string;
}

export interface LoadSummary {
  ok: number;
  failed: number;
  resources: number;
  durationMs: number;
  errors: { file: string; message: string }[];
}

const MANIFEST_URL = "/sample-data/manifest.json";
const BUNDLE_BASE = "/sample-data/";

export async function loadManifest(): Promise<SampleManifest> {
  const res = await fetch(MANIFEST_URL);
  if (!res.ok) {
    throw new Error(
      `Sample-data manifest not found at ${MANIFEST_URL} (HTTP ${res.status}). ` +
        `Make sure the bundles were generated and committed to public/sample-data/.`,
    );
  }
  return res.json();
}

function countResources(bundle: unknown): number {
  if (!bundle || typeof bundle !== "object") return 0;
  const entries = (bundle as { entry?: unknown[] }).entry;
  return Array.isArray(entries) ? entries.length : 0;
}

interface BundleEntry {
  request?: { method?: string };
  resource?: { id?: string };
}

/** Strips resource.id from POST entries: the create interaction ignores client
 * ids, entries reference each other via urn:uuid fullUrls, and servers that do
 * honor them reject a re-run of the same bundle with duplicate-key errors. */
export function stripPostResourceIds(bundle: unknown): unknown {
  if (!bundle || typeof bundle !== "object") return bundle;
  const entries = (bundle as { entry?: BundleEntry[] }).entry;
  if (!Array.isArray(entries)) return bundle;
  for (const entry of entries) {
    if (entry?.request?.method === "POST" && entry.resource?.id !== undefined) {
      delete entry.resource.id;
    }
  }
  return bundle;
}

export async function loadSampleData(
  baseUrl: string,
  onProgress: (p: LoadProgress) => void,
): Promise<LoadSummary> {
  const start = performance.now();
  const manifest = await loadManifest();
  const summary: LoadSummary = { ok: 0, failed: 0, resources: 0, durationMs: 0, errors: [] };

  for (let i = 0; i < manifest.bundles.length; i++) {
    const file = manifest.bundles[i];
    onProgress({ index: i, total: manifest.bundles.length, file, status: "loading" });

    try {
      const bundleRes = await fetch(`${BUNDLE_BASE}${file}`);
      if (!bundleRes.ok) throw new Error(`Failed to fetch ${file}: HTTP ${bundleRes.status}`);
      const bundle = stripPostResourceIds(await bundleRes.json());
      const resourceCount = countResources(bundle);

      // FHIR transaction bundles are POSTed to the server's base URL.
      const res = await fhirFetch("/", { method: "POST", body: JSON.stringify(bundle) }, baseUrl);
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}: ${res.raw.slice(0, 200)}`);
      }

      summary.ok++;
      summary.resources += resourceCount;
      onProgress({
        index: i,
        total: manifest.bundles.length,
        file,
        status: "ok",
        resources: resourceCount,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      summary.failed++;
      summary.errors.push({ file, message });
      onProgress({ index: i, total: manifest.bundles.length, file, status: "fail", message });
    }
  }

  summary.durationMs = Math.round(performance.now() - start);
  return summary;
}
