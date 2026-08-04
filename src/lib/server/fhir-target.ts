import { z } from "zod";

const fhirBaseUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "The FHIR base URL must use HTTP or HTTPS.");

export async function resolveFhirTarget(input: unknown): Promise<string> {
  const result = fhirBaseUrlSchema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "A valid FHIR base URL is required.");
  }

  return result.data;
}
