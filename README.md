# @feedbakkr/sdk

The official JavaScript / TypeScript SDK for [Feedbakkr](https://feedbakkr.com).
A thin, dependency-free wrapper around the public Submit API that works in
every modern runtime: browsers, Node 20+, Bun, Deno, and Cloudflare Workers.

## Install

```bash
pnpm add @feedbakkr/sdk
# or
npm install @feedbakkr/sdk
```

## Quick start — browser

Use a **publishable key** (`fbk_ci_*`). The SDK refuses to attach a secret
key in a browser to prevent leaks.

```ts
import { Feedbakkr } from "@feedbakkr/sdk";

const fbk = new Feedbakkr({
  publishableKey: import.meta.env.VITE_FBK_KEY, // fbk_ci_live_*
});

await fbk.submit({
  channelSlug: "contact-form",
  fields: {
    name: "Ada Lovelace",
    email: "ada@example.com",
    message: "Love this!",
  },
});
```

## Quick start — server

Use a **secret key** (`fbk_sk_*`). Secret keys bypass origin checks; the
server rejects requests that carry an `Origin` header, so accidentally
shipping a secret key to the browser stops working rather than silently
leaking quota.

```ts
import { Feedbakkr } from "@feedbakkr/sdk";

const fbk = new Feedbakkr({
  secretKey: process.env.FBK_SECRET_KEY!, // fbk_sk_live_*
});

const message = await fbk.submit({
  channelSlug: "contact-form",
  fields: {
    name: "Ada",
    message: "From the server",
  },
});

console.log(`Submitted message ${message.id}`);
```

## Addressing a channel by ID

Slug is the primary path because it's stable and readable. If you already
hold a channel ULID, use `submitById()` — same auth, same body, same result.

```ts
await fbk.submitById({
  channelId: "01J9AXXXXXXXXXXXXXXXXXXXXX",
  fields: { ... },
});
```

## Bot protection (Turnstile)

If the channel has Turnstile enabled, pass the token along with the
submission:

```ts
await fbk.submit({
  channelSlug: "contact-form",
  fields: { name, email, message },
  turnstileToken, // from the Cloudflare Turnstile widget
});
```

## Error handling

All errors — both API responses and local validation — throw `FeedbakkrError`
with a stable `code`, an HTTP `status`, and an optional `details` object.

Match on `code`, not on `message` (which is human-readable and may change).

```ts
import { Feedbakkr, FeedbakkrError } from "@feedbakkr/sdk";

try {
  await fbk.submit({ channelSlug, fields });
} catch (err) {
  if (err instanceof FeedbakkrError) {
    switch (err.code) {
      case "VALIDATION_ERROR":
        // err.details.fieldErrors is keyed by schema field name
        return renderFieldErrors(err.details);
      case "RATE_LIMITED":
      case "QUOTA_EXCEEDED":
        // The SDK already retried per its config. Back off in your UI.
        return showRetryBanner();
      case "BOT_CHECK_REQUIRED":
        // Missing turnstileToken. Re-run the Turnstile challenge.
        return reRunChallenge();
      case "FORBIDDEN":
        // Origin not on the allowed list, or secret key sent from browser.
        return;
    }
    return;
  }
  throw err;
}
```

Local SDK-side codes:

| Code | When |
|---|---|
| `INVALID_CONFIG` | Both `publishableKey` and `secretKey` passed (or neither) |
| `SECRET_KEY_IN_BROWSER` | Secret key construction attempted in a browser global |
| `INVALID_KEY_FORMAT` | Key doesn't start with one of the four valid prefixes |
| `FETCH_UNAVAILABLE` | Runtime has no global `fetch` and none was passed |
| `INVALID_ARGUMENT` | `channelSlug` / `channelId` / `fields` missing or wrong type |
| `MALFORMED_RESPONSE` | API returned 2xx with an unparseable body |
| `NETWORK_ERROR` | Request never reached the server after all retries |

API-side codes (returned by the server) are documented at
<https://feedbakkr.com/docs/build/errors>.

## Retries

By default the SDK retries 429 and 5xx responses up to **2 times** with
exponential backoff (250 ms, 500 ms, 1 s, …) and honours the `Retry-After`
header on 429. Set `retries: 0` to disable.

```ts
const fbk = new Feedbakkr({
  publishableKey: import.meta.env.VITE_FBK_KEY,
  retries: 0, // fail fast — let your own code retry
});
```

## Aborting a submission

`submit()` and `submitById()` both accept an `AbortSignal`:

```ts
const controller = new AbortController();
setTimeout(() => controller.abort(), 5_000);

await fbk.submit({
  channelSlug,
  fields,
  signal: controller.signal,
});
```

## Key types

Four key prefixes — one for each combination of (where it's used, which
environment it writes to).

| Prefix | Where | Environment |
|---|---|---|
| `fbk_ci_dev_…` | Browser / public clients | Writes to dev |
| `fbk_ci_live_…` | Browser / public clients | Writes to live |
| `fbk_sk_dev_…` | Server only | Writes to dev |
| `fbk_sk_live_…` | Server only | Writes to live |

`_ci_` stands for "client-issuable" — these are publishable keys, safe in
HTML or a bundled JS file. `_sk_` is "secret" — treat them like database
passwords. The SDK validates the prefix at construction so misconfigured
keys fail loudly before any network call.

## Successful response shape

```ts
interface FeedbakkrMessage {
  id: string;                                // ULID
  environment: "dev" | "live";               // derived from the key
  channelId: string;                         // ULID of the channel
  lifecycleState: "active" | "quota_held";   // see below
  createdAt: string;                         // ISO 8601 UTC
}
```

- `active` — the message is in the inbox.
- `quota_held` — accepted but held back because the workspace is over its
  plan quota. Becomes visible after a billing cycle reset or a plan
  upgrade. Not an error — the caller doesn't need to do anything special.

## Constructor options

| Option | Type | Notes |
|---|---|---|
| `publishableKey` | `string?` | Browser. Mutually exclusive with `secretKey`. |
| `secretKey` | `string?` | Server only. Refused in the browser. |
| `baseUrl` | `string?` | Defaults to `https://api.feedbakkr.com`. Useful for staging or self-hosted. |
| `fetch` | `function?` | Custom fetch. Defaults to global `fetch`. |
| `retries` | `number?` | Number of retries on 429 and 5xx. Defaults to `2`. Set to `0` to disable. |

## Runtime compatibility

- **Browsers**: every modern browser with `fetch`.
- **Node.js**: v20+ (native `fetch`). For older versions, pass a `fetch`
  polyfill via the `fetch` option.
- **Edge / Workers**: Cloudflare Workers, Vercel Edge, Deno, Bun all work
  out of the box.

## License

MIT.
