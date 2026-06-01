import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BaseUrlBar, useBaseUrl } from "@/components/BaseUrlBar";
import { CapabilityPanel } from "@/components/CapabilityPanel";
import { SearchPanel } from "@/components/SearchPanel";
import { InstancePanel } from "@/components/InstancePanel";
import { WritePanel } from "@/components/WritePanel";
import { OperationsPanel } from "@/components/OperationsPanel";
import { RawPanel } from "@/components/RawPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FHIR Explorer — Browse any FHIR R4 server" },
      {
        name: "description",
        content:
          "Interactive UI for exploring FHIR R4 servers: capabilities, search, CRUD, history, $everything, $validate, and raw requests.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [baseUrl, setBaseUrl] = useBaseUrl();
  const [tab, setTab] = useState("search");

  return (
    <div className="min-h-screen bg-background">
      <BaseUrlBar baseUrl={baseUrl} onChange={setBaseUrl} />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="capability">Capability</TabsTrigger>
            <TabsTrigger value="search">Search</TabsTrigger>
            <TabsTrigger value="instance">Read / History</TabsTrigger>
            <TabsTrigger value="write">Create / Update</TabsTrigger>
            <TabsTrigger value="operations">Operations</TabsTrigger>
            <TabsTrigger value="raw">Raw Request</TabsTrigger>
          </TabsList>
          <div className="mt-6 rounded-lg border bg-card p-5 shadow-sm">
            <TabsContent value="capability" className="m-0">
              <CapabilityPanel baseUrl={baseUrl} />
            </TabsContent>
            <TabsContent value="search" className="m-0">
              <SearchPanel baseUrl={baseUrl} />
            </TabsContent>
            <TabsContent value="instance" className="m-0">
              <InstancePanel baseUrl={baseUrl} />
            </TabsContent>
            <TabsContent value="write" className="m-0">
              <WritePanel baseUrl={baseUrl} />
            </TabsContent>
            <TabsContent value="operations" className="m-0">
              <OperationsPanel baseUrl={baseUrl} />
            </TabsContent>
            <TabsContent value="raw" className="m-0">
              <RawPanel baseUrl={baseUrl} />
            </TabsContent>
          </div>
        </Tabs>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Tip: if requests fail with a network error, ensure the FHIR server allows CORS from this
          origin.
        </p>
      </main>
    </div>
  );
}
