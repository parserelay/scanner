import { ParseRelayClient } from "@parserelay/client";
import {
  type DocType,
  type Engine,
  type OcrConfig,
  type ScanEnvelope,
  type ScanSchema,
  isEnvelope,
} from "@parserelay/core";
import { useCallback, useMemo, useRef, useState } from "react";

export interface DeadSimpleMicroScannerProps<Fields = Record<string, unknown>> {
  /** API key for the hosted ParseRelay API. */
  apiKey: string;
  /** Override the API base URL (self-host / staging). */
  baseUrl?: string;

  /** Field-list shorthand passed through as the request `schema`. */
  fields?: string[];
  /** Full JSON Schema (or field-list). Takes precedence over `fields`. */
  schema?: ScanSchema;
  /** Optional document-type hint. */
  docType?: DocType;
  /** Extraction mode. Defaults to "auto". */
  engine?: Engine;
  /** OCR backend selection (e.g. `{ backend: "glm" }`) or passthrough text. Omit for the server default. */
  ocr?: OcrConfig;
  /** Pin a specific model (omit for the server default). */
  model?: string;
  /** Bring-your-own provider key → billed for plumbing only. */
  modelKey?: string;

  /** Fired with the parsed envelope once a scan completes. */
  onResult?: (envelope: ScanEnvelope<Fields>) => void;
  /** Convenience: fired with the low-confidence field names, to gate UI. */
  onNeedsReview?: (fields: string[]) => void;
  /** Fired on a failed scan or transport error. */
  onError?: (error: Error) => void;

  /**
   * Capture hint for the file input. "environment" opens the rear camera on
   * mobile; omit to allow gallery/file selection. Pass `false` to disable.
   */
  capture?: "environment" | "user" | false;

  /** Optional label/children for the trigger button. */
  children?: React.ReactNode;
  /** Optional className passthrough for the wrapper. Styling is yours. */
  className?: string;
}

type Status = "idle" | "reading" | "scanning" | "done" | "error";

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("file read failed"));
    reader.readAsDataURL(file);
  });
}

/**
 * <DeadSimpleMicroScanner /> — capture or upload an image, scan it, get
 * structured fields back. A thin, unstyled client over the ParseRelay API;
 * bring your own styling via `className` / `children`.
 *
 * Note: this is the synchronous path (no `relay`). For fire-and-forget,
 * call the API with a `relay` config server-side and receive the envelope
 * at your webhook.
 */
export function DeadSimpleMicroScanner<Fields = Record<string, unknown>>(
  props: DeadSimpleMicroScannerProps<Fields>,
) {
  const {
    apiKey,
    baseUrl,
    fields,
    schema,
    docType,
    engine = "auto",
    ocr,
    model,
    modelKey,
    onResult,
    onNeedsReview,
    onError,
    capture = "environment",
    children,
    className,
  } = props;

  const [status, setStatus] = useState<Status>("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  // Recreate when credentials change so key rotation / env toggle takes effect.
  const client = useMemo(() => new ParseRelayClient({ apiKey, baseUrl }), [apiKey, baseUrl]);

  const handleFile = useCallback(
    async (file: File) => {
      try {
        setStatus("reading");
        const image = await fileToDataUri(file);

        setStatus("scanning");
        const result = await client.scan<Fields>({
          image,
          schema: schema ?? fields,
          doc_type: docType,
          engine,
          ocr,
          model,
          model_key: modelKey,
        });

        // The component uses the synchronous path: isEnvelope rejects BOTH the
        // async {accepted} and the dry_run response shapes.
        if (!isEnvelope(result)) {
          throw new Error("Unexpected non-envelope response; the component expects the sync path.");
        }

        const envelope = result as ScanEnvelope<Fields>;
        setStatus("done");
        onResult?.(envelope);
        if (envelope.needs_review.length > 0) {
          onNeedsReview?.(envelope.needs_review);
        }
      } catch (err) {
        setStatus("error");
        onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [
      client,
      fields,
      schema,
      docType,
      engine,
      ocr,
      model,
      modelKey,
      onResult,
      onNeedsReview,
      onError,
    ],
  );

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
      // reset so selecting the same file again re-triggers change
      e.target.value = "";
    },
    [handleFile],
  );

  return (
    <div className={className} data-parserelay-status={status}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        {...(capture ? { capture } : {})}
        onChange={onChange}
        style={{ display: "none" }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status === "reading" || status === "scanning"}
      >
        {children ??
          (status === "scanning" ? "Scanning…" : status === "reading" ? "Reading…" : "Scan")}
      </button>
    </div>
  );
}

export default DeadSimpleMicroScanner;
export type { ScanEnvelope } from "@parserelay/core";
