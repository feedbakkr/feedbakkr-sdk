# @feedbakkr/sdk

Lightweight SDK for submitting messages to [Feedbakkr](https://feedbakkr.com). Works in browsers, Node.js, and edge runtimes (Cloudflare Workers, Vercel Edge, etc.).

## Installation

```bash
npm install @feedbakkr/sdk
```

## Quick start

```ts
import { createFeedbakkrClient } from "@feedbakkr/sdk";

const feedbakkr = createFeedbakkrClient({
  apiKey: "fbk_sk_live_your-secret-key",
});

const result = await feedbakkr.submit({
  channelId: "your-channel-id",
  fields: {
    name: "Jane Doe",
    email: "jane@example.com",
    message: "Love the new feature!",
  },
});

console.log(result.id); // Message ID
```

## Usage

### Server-side (recommended)

Use a **secret key** (`fbk_sk_*`) from your server. Secret keys must not be exposed to the browser.

```ts
import { createFeedbakkrClient } from "@feedbakkr/sdk";

const feedbakkr = createFeedbakkrClient({
  apiKey: process.env.FEEDBAKKR_SECRET_KEY!,
});

// In your API handler:
const result = await feedbakkr.submit({
  channelId: "01ABC...",
  fields: { name: req.body.name, email: req.body.email },
});
```

### Browser / client-side

Use a **client key** (`fbk_ci_*`) from the browser. The request Origin header is validated against your channel's allowed origins.

```ts
import { createFeedbakkrClient } from "@feedbakkr/sdk";

const feedbakkr = createFeedbakkrClient({
  apiKey: "fbk_ci_live_your-client-key",
});

const result = await feedbakkr.submit({
  channelId: "01ABC...",
  fields: { name: "Jane", message: "Hello!" },
});
```

### Direct function imports

If you prefer not to use the client wrapper:

```ts
import { submitServerMessage, submitClientMessage } from "@feedbakkr/sdk";

const result = await submitServerMessage(
  { apiKey: "fbk_sk_live_..." },
  { channelId: "01ABC...", fields: { name: "Jane" } },
);
```

## Error handling

All errors are thrown as `FeedbakkrError` with a `kind` property:

```ts
import { FeedbakkrError } from "@feedbakkr/sdk";

try {
  await feedbakkr.submit({ channelId: "...", fields: {} });
} catch (err) {
  if (err instanceof FeedbakkrError) {
    switch (err.kind) {
      case "api":
        // API returned an error (err.status, err.code, err.details)
        console.error(`API error ${err.status}: ${err.code} - ${err.message}`);
        break;
      case "network":
        // Fetch/network failure
        console.error("Network error:", err.message);
        break;
      case "config":
        // Invalid configuration (missing apiKey, channelId, etc.)
        console.error("Config error:", err.message);
        break;
    }
  }
}
```

## API reference

### `createFeedbakkrClient(config)`

Creates a configured client. The key prefix determines the submission flow:
- `fbk_ci_*` keys use the client/browser flow
- `fbk_sk_*` keys use the server flow

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | *required* | Your Feedbakkr API key |
| `baseUrl` | `string` | `https://api.feedbakkr.com` | API base URL |
| `fetch` | `typeof fetch` | `globalThis.fetch` | Custom fetch implementation |

### `client.submit(input)`

Submit a message to a channel.

| Field | Type | Description |
|-------|------|-------------|
| `channelId` | `string` | Target channel ID |
| `fields` | `Record<string, unknown>` | Field values matching the channel schema |

Returns `SubmitMessageResult`:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Message ID (ULID) |
| `environment` | `"dev" \| "live"` | Environment the message was submitted to |
| `channelId` | `string` | Channel ID |
| `lifecycleState` | `"active" \| "quota_held"` | Message lifecycle state |
| `createdAt` | `string` | ISO 8601 timestamp |

## Type generation

Use [@feedbakkr/cli](https://github.com/feedbakkr/feedbakkr-cli) to generate TypeScript types from your channel schemas, then pass typed fields to the SDK:

```ts
import type { ContactFormFields } from "./generated/contact-form";

await feedbakkr.submit({
  channelId: "01ABC...",
  fields: { name: "Jane", email: "jane@example.com" } satisfies ContactFormFields,
});
```

## Runtime compatibility

- **Browser**: Full support. Uses `fetch` API.
- **Node.js**: v18+ (native `fetch`). For older versions, pass a `fetch` polyfill.
- **Edge runtimes**: Full support (Cloudflare Workers, Vercel Edge, Deno, Bun).

## License

MIT
