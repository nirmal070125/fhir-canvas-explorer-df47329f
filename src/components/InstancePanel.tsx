import { useState } from "react";
import { fhirFetch, encodeFhirPathSegment, type FhirResponse } from "@/lib/fhir-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponseView } from "./ResponseView";
import { ResourceCombobox } from "./ResourceCombobox";

type Op = "read" | "vread" | "history" | "type-history" | "everything";

export function InstancePanel({ baseUrl }: { baseUrl: string }) {
  const [op, setOp] = useState<Op>("read");
  const [type, setType] = useState("Patient");
  const [id, setId] = useState("");
  const [vid, setVid] = useState("1");
  const [extra, setExtra] = useState("");
  const [res, setRes] = useState<FhirResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    const t = encodeFhirPathSegment(type);
    const i = encodeFhirPathSegment(id);
    const v = encodeFhirPathSegment(vid);
    let path = "";
    switch (op) {
      case "read":
        path = `/${t}/${i}`;
        break;
      case "vread":
        path = `/${t}/${i}/_history/${v}`;
        break;
      case "history":
        path = `/${t}/${i}/_history`;
        break;
      case "type-history":
        path = `/${t}/_history`;
        break;
      case "everything":
        path = `/${t}/${i}/$everything`;
        break;
    }
    if (extra.trim()) path += (path.includes("?") ? "&" : "?") + extra.trim().replace(/^\?/, "");
    try {
      setRes(await fhirFetch(path, {}, baseUrl));
    } catch (e: any) {
      setRes({
        status: 0, ok: false, headers: {}, body: { error: e?.message }, raw: "",
        url: "", method: "GET", durationMs: 0,
      });
    } finally {
      setLoading(false);
    }
  }

  const ops: { value: Op; label: string }[] = [
    { value: "read", label: "Read" },
    { value: "vread", label: "VRead" },
    { value: "history", label: "Instance History" },
    { value: "type-history", label: "Type History" },
    { value: "everything", label: "$everything" },
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

      <div className="grid gap-3 sm:grid-cols-[1fr_2fr_1fr_auto]">
        <div>
          <Label htmlFor="instance-type">Type</Label>
          <ResourceCombobox
            id="instance-type"
            value={type}
            onChange={setType}
            baseUrl={baseUrl}
          />
        </div>
        <div>
          <Label>ID</Label>
          <Input
            value={id}
            onChange={(e) => setId(e.target.value)}
            disabled={op === "type-history"}
            placeholder={op === "type-history" ? "(not used)" : "resource id"}
            className="font-mono text-sm"
          />
        </div>
        <div>
          <Label>Version</Label>
          <Input
            value={vid}
            onChange={(e) => setVid(e.target.value)}
            disabled={op !== "vread"}
          />
        </div>
        <div className="flex items-end">
          <Button onClick={run} disabled={loading}>
            {loading ? "Loading…" : "Run"}
          </Button>
        </div>
      </div>

      <div>
        <Label>Extra query (optional)</Label>
        <Input
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          placeholder="_count=20&_since=2024-01-01T00:00:00Z"
          className="font-mono text-sm"
        />
      </div>

      <ResponseView res={res} />
    </div>
  );
}
