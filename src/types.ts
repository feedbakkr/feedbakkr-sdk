/** Plain JSON object — what users put inside `fields`. */
export type FeedbakkrFields = Record<string, unknown>;

/** Successful submit response. Same shape regardless of which submit path was used. */
export interface FeedbakkrMessage {
	/** ULID of the new message. */
	id: string;
	/** Derived from the API key used. */
	environment: "dev" | "live";
	/** The channel the message was submitted to. */
	channelId: string;
	/**
	 * What the API did with the message after accepting it.
	 * - `active` — the message is in the inbox (normal path).
	 * - `quota_held` — accepted but held back because the workspace is over
	 *   its plan quota; becomes visible after a billing cycle reset or plan
	 *   upgrade.
	 */
	lifecycleState: "active" | "quota_held";
	/** ISO 8601 UTC timestamp. */
	createdAt: string;
}

/**
 * Submit by slug — preferred. Hits `POST /v1/submit/<slug>`. Slugs are
 * stable code constants; channels with the same slug across project
 * environments resolve to the env-specific channel via the API key's
 * project binding.
 */
export interface SubmitArgs {
	/** Channel slug (lowercase, hyphens). Stable across renames within a project. */
	channelSlug: string;
	/** Field values keyed by the schema's field `k` values. */
	fields: FeedbakkrFields;
	/**
	 * Cloudflare Turnstile token for bot protection. Required when the
	 * channel has Turnstile configured and you're using a publishable key.
	 * Ignored for secret key submissions.
	 */
	turnstileToken?: string;
	/**
	 * Optional AbortSignal — pass through from your component's
	 * lifecycle (e.g. React StrictMode unmount, route change).
	 */
	signal?: AbortSignal;
}

/**
 * Submit by channel ID — REST-conventional fallback. Hits
 * `POST /v1/channels/<id>/submit`. Same auth + payload + result; only
 * the channel-resolution step differs server-side.
 */
export interface SubmitByIdArgs {
	/** ULID of the channel to submit to. */
	channelId: string;
	fields: FeedbakkrFields;
	turnstileToken?: string;
	signal?: AbortSignal;
}

/**
 * Constructor options for the Feedbakkr client.
 *
 * Pass exactly one of `publishableKey` (browser-safe) or `secretKey`
 * (server-only). The SDK refuses to attach a secret key in the browser
 * to prevent accidental leaks.
 */
export interface FeedbakkrOptions {
	/** Publishable key (`fbk_ci_…`). Safe for browser code. */
	publishableKey?: string;
	/** Secret key (`fbk_sk_…`). Server-only. */
	secretKey?: string;
	/**
	 * Override the API base URL. Defaults to `https://api.feedbakkr.com`.
	 * Useful when pointing at staging / dev / a self-hosted instance.
	 */
	baseUrl?: string;
	/**
	 * Custom fetch implementation. Defaults to `globalThis.fetch`.
	 * The runtime must provide one (Node 20+, Bun, Deno, modern
	 * browsers, Cloudflare Workers all do).
	 */
	fetch?: typeof globalThis.fetch;
	/**
	 * How many times to retry on 429 and 5xx responses. Defaults to 2.
	 * Set to 0 to disable.
	 */
	retries?: number;
}
