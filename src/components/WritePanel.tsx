import { useState } from "react";
import { fhirFetch, encodeFhirPathSegment, type FhirResponse } from "@/lib/fhir-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ResponseView } from "./ResponseView";
import { ResourceCombobox } from "./ResourceCombobox";

type Op = "create" | "update" | "patch" | "delete" | "validate";

const SAMPLES: Record<string, string> = {
  Patient: JSON.stringify(
    {
      resourceType: "Patient",
      name: [{ family: "Smith", given: ["Alice"] }],
      gender: "female",
      birthDate: "1990-05-15",
    },
    null,
    2,
  ),
  Observation: JSON.stringify(
    {
      resourceType: "Observation",
      status: "final",
      code: { text: "Heart rate" },
      valueQuantity: { value: 72, unit: "beats/min" },
    },
    null,
    2,
  ),
};

export function WritePanel({ baseUrl }: { baseUrl: string }) {
  const [op, setOp] = useState<Op>("create");
  const [type, setType] = useState("Patient");
  const [id, setId] = useState("");
  const [ifMatch, setIfMatch] = useState("");
  const [body, setBody] = useState(SAMPLES.Patient);
  const [res, setRes] = useState<FhirResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    let path = "";
    let method = "POST";
    const headers: Record<string, string> = {};
    let sendBody: string | undefined = body;

    const t = encodeFhirPathSegment(type);
    const i = encodeFhirPathSegment(id);
    switch (op) {
      case "create":
        path = `/${t}`;
        method = "POST";
        break;
      case "update":
        path = `/${t}/${i}`;
        method = "PUT";
        if (ifMatch.trim()) headers["If-Match"] = ifMatch.trim();
        break;
      case "patch":
        path = `/${t}/${i}`;
        method = "PATCH";
        headers["Content-Type"] = "application/merge-patch+json";
        break;
      case "delete":
        path = `/${t}/${i}`;
        method = "DELETE";
        sendBody = undefined;
        break;
      case "validate":
        path = `/${t}/$validate`;
        method = "POST";
        break;
    }

    try {
      setRes(await fhirFetch(path, { method, headers, body: sendBody }, baseUrl));
    } catch (e: any) {
      setRes({
        status: 0, ok: false, headers: {}, body: { error: e?.message }, raw: "",
        url: "", method, durationMs: 0,
      });
    } finally {
      setLoading(false);
    }
  }

  const ops: { value: Op; label: string }[] = [
    { value: "create", label: "Create (POST)" },
    { value: "update", label: "Update (PUT)" },
    { value: "patch", label: "Patch" },
    { value: "delete", label: "Delete" },
    { value: "validate", label: "$validate" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {ops.map((o) => (
          <Button
            key={o.value}
            size="sm"
            variant={op === o.value ? "default" : "outline"}
            onClick={() => setOp(o.value)}
          >
            {o.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="write-type">Resource Type</Label>
          <ResourceCombobox
            id="write-type"
            value={type}
            onChange={(next) => {
              setType(next);
              if (SAMPLES[next]) setBody(SAMPLES[next]);
            }}
            baseUrl={baseUrl}
          />
        </div>
        <div>
          <Label>ID</Label>
          <Input
            value={id}
            onChange={(e) => setId(e.target.value)}
            disabled={op === "create" || op === "validate"}
            className="font-mono text-sm"
          />
        </div>
        <div>
          <Label>If-Match (PUT only)</Label>
          <Input
            value={ifMatch}
            onChange={(e) => setIfMatch(e.target.value)}
            placeholder={'W/"2"'}
            disabled={op !== "update"}
            className="font-mono text-sm"
          />
        </div>
      </div>

      {op !== "delete" && (
        <div>
          <Label>Body ({op === "patch" ? "JSON Merge Patch" : "FHIR JSON"})</Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={16}
            className="font-mono text-xs"
          />
        </div>
      )}

      <Button onClick={run} disabled={loading}>
        {loading ? "Sending…" : `Send ${op.toUpperCase()}`}
      </Button>

      <ResponseView res={res} />
    </div>
  );
}
