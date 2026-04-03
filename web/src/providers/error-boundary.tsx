/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Copy } from "lucide-react";
import type { FallbackProps } from "react-error-boundary";
import { Button, Modal, ModalBody, ModalContent, ModalFooter } from "@/components/ui";

export function ErrorBoundaryProvider({ error, resetErrorBoundary }: FallbackProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.error(error);
  });

  const errorText =
    error instanceof Error
      ? `${error.name}: ${error.message}\n\n${error.stack ?? ""}`
      : String(error);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(errorText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [errorText]);

  return (
    <div className="fixed inset-0 bg-bg">
      <Modal open>
        <ModalContent size="md" showClose={false}>
          <div className="flex items-center gap-3 px-4 pt-4 pb-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
              <AlertTriangle className="h-4 w-4 text-red-400" />
            </div>
            <h2 className="font-medium text-base text-text-primary leading-none">
              Something went wrong
            </h2>
          </div>
          <ModalBody>
            <p className="text-[13px] text-text-secondary">
              Sorry, we couldn&apos;t load the page. This might be a temporary issue. Please try
              again, and if the problem continues, reach out to support.
            </p>
            <div className="mt-3 rounded-lg border border-border bg-surface-1">
              <div className="flex items-center justify-between border-border border-b px-3 py-1.5">
                <span className="font-mono text-[11px] text-text-icon">Error details</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] text-text-icon transition-colors hover:bg-surface-active hover:text-text-primary"
                  title="Copy error"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="scrollbar-none max-h-36 overflow-y-auto whitespace-pre-wrap break-all p-3 font-mono text-[11px] text-text-muted leading-relaxed">
                {errorText}
              </pre>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="default" onClick={() => window.location.reload()}>
              Reload Page
            </Button>
            <Button variant="primary" onClick={resetErrorBoundary}>
              Try Again
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
