import { useEffect, useState } from "react";
import { fhirFetch, encodeFhirPathSegment, type FhirResponse } from "@/lib/fhir-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil } from "lucide-react";
import { ResponseView } from "./ResponseView";
import { ResourceCombobox } from "./ResourceCombobox";
import { PanelSplit } from "./PanelSplit";
import { ChoiceCards } from "./ChoiceCards";
import { RequestPreviewBar } from "./RequestPreviewBar";
import { useExplorerBus } from "@/lib/explorer-bus";

type Op = "read" | "vread" | "history" | "type-history" | "system-history" | "everything";

export function InstancePanel({ baseUrl }: { baseUrl: string }) {
  const [op, setOp] = useState<Op>("read");
  const [type, setType] = useState("Patient");
  const [id, setId] = useState("");
  const [vid, setVid] = useState("1");
  const [extra, setExtra] = useState("");
  const [res, setRes] = useState<FhirResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const bus = useExplorerBus();

  // Reference clicks in a JSON view land here with a type+id to read.
  useEffect(() => {
    if (bus?.tab !== "instance") return;
    const p = bus?.consumeReadPrefill();
    if (p) {
      setOp("read");
      setType(p.type);
      setId(p.id);
      void runWith("read", p.type, p.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bus?.tab, bus?.readPrefill]);

  async function runWith(op: Op, type: string, id: string) {
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
      case "system-history":
        path = `/_history`;
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

  const run = () => runWith(op, type, id);

  const ops: { value: Op; label: string; desc: string }[] = [
    { value: "read", label: "Read", desc: "Current version of one resource" },
    { value: "vread", label: "VRead", desc: "One specific version" },
    { value: "history", label: "Instance History", desc: "All versions of one resource" },
    { value: "type-history", label: "Type History", desc: "Changes across a resource type" },
    { value: "system-history", label: "System History", desc: "Changes across the whole server" },
    { value: "everything", label: "$everything", desc: "Patient record + linked resources" },
  ];

  const usesType = op !== "system-history";
  const usesId = op !== "type-history" && op !== "system-history";
  const usesVid = op === "vread";

  const previewPath = (() => {
    switch (op) {
      case "read":
        return `/${type}/${id || "{id}"}`;
      case "vread":
        return `/${type}/${id || "{id}"}/_history/${vid || "{vid}"}`;
      case "history":
        return `/${type}/${id || "{id}"}/_history`;
      case "type-history":
        return `/${type}/_history`;
      case "system-history":
        return `/_history`;
      case "everything":
        return `/${type}/${id || "{id}"}/$everything`;
    }
  })();

  // "Edit this resource" on a successful read jumps to Create/Update with body, id and ETag prefilled.
  const readBody = res?.body as any;
  const canEdit =
    op === "read" &&
    res?.ok &&
    readBody &&
    typeof readBody === "object" &&
    typeof readBody.resourceType === "string" &&
    readBody.resourceType !== "Bundle" &&
    readBody.resourceType !== "OperationOutcome";

  function editCurrent() {
    if (!canEdit) return;
    bus?.openWrite({
      op: "update",
      type: readBody.resourceType,
      id: readBody.id ?? id,
      body: JSON.stringify(readBody, null, 2),
      ifMatch: res?.headers["etag"] ?? "",
    });
  }

  const form = (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Interaction</Label>
        <ChoiceCards choices={ops} value={op} onChange={setOp} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {usesType && (
          <div className="space-y-1.5">
            <Label htmlFor="instance-type">Resource Type</Label>
            <ResourceCombobox
              id="instance-type"
              value={type}
              onChange={setType}
              baseUrl={baseUrl}
            />
          </div>
        )}
        {usesId && (
          <div className="space-y-1.5">
            <Label>ID</Label>
            <Input
              value={id}
              onChange={(e) => setId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder="resource id"
              className="font-mono text-sm"
            />
          </div>
        )}
        {usesVid && (
          <div className="space-y-1.5">
            <Label>Version</Label>
            <Input
              value={vid}
              onChange={(e) => setVid(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder="version id"
              className="font-mono text-sm"
            />
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Extra query <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Input
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="_count=20&_since=2024-01-01T00:00:00Z"
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Appended to the request as-is — paging, _since, _count, …
        </p>
      </div>

      <RequestPreviewBar
        method="GET"
        path={previewPath + (extra.trim() ? `?${extra.trim().replace(/^\?/, "")}` : "")}
      >
        <Button onClick={run} disabled={loading} size="sm">
          {loading ? "Loading…" : "Run"}
        </Button>
      </RequestPreviewBar>
    </div>
  );

  const response = (
    <div className="space-y-3">
      {canEdit && (
        <Button size="sm" variant="secondary" onClick={editCurrent}>
          <Pencil className="mr-1 h-4 w-4" />
          Edit this resource
        </Button>
      )}
      <ResponseView res={res} />
    </div>
  );

  return <PanelSplit form={form} response={response} />;
}
