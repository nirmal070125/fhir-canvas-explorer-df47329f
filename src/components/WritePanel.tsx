import { useEffect, useState } from "react";
import { fhirFetch, encodeFhirPathSegment, type FhirResponse } from "@/lib/fhir-client";
import { PanelSplit } from "./PanelSplit";
import { useExplorerBus } from "@/lib/explorer-bus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponseView } from "./ResponseView";
import { JsonEditor } from "./JsonEditor";
import { ResourceCombobox } from "./ResourceCombobox";
import { ChoiceCards } from "./ChoiceCards";
import { RequestPreviewBar } from "./RequestPreviewBar";

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
  const bus = useExplorerBus();

  // "Edit this resource" from the Read tab lands here fully prefilled.
  useEffect(() => {
    if (bus?.tab !== "write") return;
    const p = bus?.consumeWritePrefill();
    if (p) {
      setOp(p.op);
      setType(p.type);
      setId(p.id);
      setBody(p.body);
      setIfMatch(p.ifMatch ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bus?.tab, bus?.writePrefill]);

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

  const ops: { value: Op; label: string; desc: string }[] = [
    { value: "create", label: "Create", desc: "POST a new resource" },
    { value: "update", label: "Update", desc: "PUT a full replacement" },
    { value: "patch", label: "Patch", desc: "Merge-patch selected fields" },
    { value: "delete", label: "Delete", desc: "Soft-delete by id" },
    { value: "validate", label: "$validate", desc: "Check without storing" },
  ];

  const usesId = op !== "create" && op !== "validate";
  const usesIfMatch = op === "update";
  const usesBody = op !== "delete";

  const methodFor: Record<Op, string> = {
    create: "POST",
    update: "PUT",
    patch: "PATCH",
    delete: "DELETE",
    validate: "POST",
  };
  const previewPath =
    op === "create"
      ? `/${type}`
      : op === "validate"
        ? `/${type}/$validate`
        : `/${type}/${id || "{id}"}`;

  const form = (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Interaction</Label>
        <ChoiceCards choices={ops} value={op} onChange={setOp} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
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
        {usesId && (
          <div className="space-y-1.5">
            <Label>ID</Label>
            <Input
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="resource id"
              className="font-mono text-sm"
            />
          </div>
        )}
        {usesIfMatch && (
          <div className="space-y-1.5">
            <Label>
              If-Match <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              value={ifMatch}
              onChange={(e) => setIfMatch(e.target.value)}
              placeholder={'W/"2"'}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Version ETag — server rejects the update with 412 if the resource changed.
            </p>
          </div>
        )}
      </div>

      {usesBody && (
        <div className="space-y-1.5">
          <Label>Body ({op === "patch" ? "JSON Merge Patch" : "FHIR JSON"})</Label>
          <JsonEditor value={body} onChange={setBody} rows={14} ariaLabel="Request body" />
        </div>
      )}

      <RequestPreviewBar method={methodFor[op]} path={previewPath}>
        <Button onClick={run} disabled={loading} size="sm">
          {loading ? "Sending…" : "Send"}
        </Button>
      </RequestPreviewBar>
    </div>
  );

  return <PanelSplit form={form} response={<ResponseView res={res} />} />;
}
