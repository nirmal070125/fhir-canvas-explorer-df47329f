export const runtime = "nodejs";
// Read the deploy-time env at request time, not build time (would bake in null).
export const dynamic = "force-dynamic";

// Deployment-provided defaults for the client. FHIR_DEFAULT_BASE_URL lets an
// operator point fresh browsers at the deployed FHIR server instead of the
// compiled-in local-dev default.
export async function GET() {
  const defaultFhirBaseUrl = process.env.FHIR_DEFAULT_BASE_URL?.trim() || null;
  return Response.json({ defaultFhirBaseUrl });
}
