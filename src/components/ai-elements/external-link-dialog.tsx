"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExternalLink } from "lucide-react";
import type { LinkSafetyModalProps } from "streamdown";

function getDestination(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function ExternalLinkDialog({ isOpen, onClose, onConfirm, url }: LinkSafetyModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm gap-4 rounded-xl p-4">
        <DialogHeader className="pr-7 text-left">
          <DialogTitle className="text-base">Open this link?</DialogTitle>
          <DialogDescription className="text-xs">
            This takes you to{" "}
            <span className="font-medium text-foreground">{getDestination(url)}</span>.
          </DialogDescription>
        </DialogHeader>

        <div
          className="truncate rounded-md border bg-muted/60 px-3 py-2 font-mono text-xs text-muted-foreground"
          title={url}
        >
          {url}
        </div>

        <DialogFooter className="flex-row justify-end gap-2 space-x-0">
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={onConfirm}>
            <ExternalLink />
            Open link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
