# @parserelay/scanner

A dead-simple, drop-in scanner component for [ParseRelay](https://parserelay.app). Capture or upload an image and get structured, confidence-scored fields back. Unstyled by design — bring your own CSS via `className` / `children`.

```tsx
import { DeadSimpleMicroScanner } from "@parserelay/scanner";

<DeadSimpleMicroScanner
  apiKey={process.env.NEXT_PUBLIC_PARSERELAY_KEY!}
  fields={["merchant", "total", "date"]}
  docType="receipt"
  engine="auto"
  onResult={(envelope) => {
    // { fields, confidence, needs_review, raw_text, meta }
    console.log(envelope.fields, envelope.confidence);
  }}
  onNeedsReview={(low) => console.log("review these:", low)}
/>
```

This uses the synchronous scan path. For fire-and-forget delivery, call the
API with a `relay` config server-side and receive the envelope at your webhook.

> Angular / framework-agnostic wrappers are planned. For now, non-React apps
> can use [`@parserelay/client`](../client) directly.
