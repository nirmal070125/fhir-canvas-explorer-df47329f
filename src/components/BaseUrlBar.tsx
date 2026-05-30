import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DEFAULT_BASE_URL, getBaseUrl, setBaseUrl, fhirFetch } from "@/lib/fhir-client";
import { CheckCircle2, XCircle, Loader2, Server } from "lucide-react";
import { LoadSampleDataButton } from "./LoadSampleDataButton";

interface Props {
  baseUrl: string;
  onChange: (url: string) => void;
}

export function BaseUrlBar({ baseUrl, onChange }: Props) {
  const [value, setValue] = useState(baseUrl);
  const [status, setStatus] = useState<"idle" | "checking" | "ok" | "fail">("idle");
  const [info, setInfo] = useState<string>("");

  useEffect(() => setValue(baseUrl), [baseUrl]);

  async function ping(url: string) {
    setStatus("checking");
    setInfo("");
    try {
      const res = await fhirFetch("/metadata", {}, url);
      if (res.ok) {
        const body = res.body as any;
        setStatus("ok");
        setInfo(
          `FHIR ${body?.fhirVersion ?? "?"} · ${body?.software?.name ?? "server"} · ${res.durationMs}ms`,
        );
      } else {
        setStatus("fail");
        setInfo(`HTTP ${res.status}`);
      }
    } catch (e: any) {
      setStatus("fail");
      setInfo(e?.message || "Network error (check CORS / server running)");
    }
  }

  useEffect(() => {
    ping(baseUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl]);

  function save() {
    const clean = value.trim().replace(/\/$/, "");
    setBaseUrl(clean);
    onChange(clean);
  }

  return (
    <div className="border-b bg-card">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2 pr-2">
            <Server className="h-5 w-5 text-primary" />
            <span className="font-semibold">FHIR Explorer</span>
          </div>
          <div className="flex-1 min-w-[280px]">
            <Label htmlFor="base" className="text-xs text-muted-foreground">
              Base URL
            </Label>
            <Input
              id="base"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder={DEFAULT_BASE_URL}
              className="font-mono text-sm"
            />
          </div>
          <Button onClick={save} variant="default">
            Connect
          </Button>
          <div className="flex items-center gap-2 text-sm">
            {status === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {status === "ok" && <CheckCircle2 className="h-4 w-4 text-primary" />}
            {status === "fail" && <XCircle className="h-4 w-4 text-destructive" />}
            <span className="text-muted-foreground">{info || "—"}</span>
          </div>
        </div>
        <div className="mt-3 border-t pt-3">
          <LoadSampleDataButton baseUrl={baseUrl} />
        </div>
      </div>
    </div>
  );
}

export function useBaseUrl() {
  const [baseUrl, set] = useState<string>(DEFAULT_BASE_URL);
  useEffect(() => set(getBaseUrl()), []);
  return [baseUrl, set] as const;
}
