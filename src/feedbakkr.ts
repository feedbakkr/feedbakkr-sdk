import { FeedbakkrError } from "./errors.js";
import type { FeedbakkrMessage, FeedbakkrOptions, SubmitArgs, SubmitByIdArgs } from "./types.js";

const DEFAULT_BASE_URL = "https://api.feedbakkr.com";
const DEFAULT_RETRIES = 2;

/**
 * Detect whether the SDK is currently running inside a browser
 * window. The check is deliberately simple: if `window` and
 * `window.document` exist, treat it as a browser.
 *
 * Cloudflare Workers, Node, Bun, and Deno all return `false` here.
 */
function isBrowserRuntime(): boolean {
	return (
		typeof globalThis !== "undefined" &&
		typeof (globalThis as { window?: unknown }).window !== "undefined" &&
		typeof (globalThis as { window?: { document?: unknown } }).window?.document !== "undefined"
	);
}

/**
 * The Feedbakkr client.
 *
 * @example Browser
 * ```ts
 * const fbk = new Feedbakkr({ publishableKey: import.meta.env.VITE_FBK_KEY });
 * await fbk.submit({ channelSlug: "feedback", fields: { name: "Ada" } });
 * ```
 *
 * @example Server
 * ```ts
 * const fbk = new Feedbakkr({ secretKey: process.env.FBK_SECRET_KEY! });
 * await fbk.submit({ channelSlug: "report-abuse", fields });
 * ```
 *
 * @example Submit by channel ID (REST-conventional alternative)
 * ```ts
 * await fbk.submitById({ channelId: "01J9…", fields });
 * ```
 */
export class Feedbakkr {
	readonly #apiKey: string;
	readonly #baseUrl: string;
	readonly #fetch: typeof globalThis.fetch;
	readonly #retries: number;

	constructor(options: FeedbakkrOptions) {
		const { publishableKey, secretKey } = options;

		if (publishableKey && secretKey) {
			throw new FeedbakkrError({
				code: "INVALID_CONFIG",
				message: "Pass exactly one of `publishableKey` or `secretKey`, not both.",
				status: 0,
			});
		}

		if (!publishableKey && !secretKey) {
			throw new FeedbakkrError({
				code: "INVALID_CONFIG",
				message: "Pass either a `publishableKey` (browser) or a `secretKey` (server).",
				status: 0,
			});
		}

		if (secretKey && isBrowserRuntime()) {
			throw new FeedbakkrError({
				code: "SECRET_KEY_IN_BROWSER",
				message:
					"Refusing to use a secret key in a browser. Secret keys must only be used from server code. Use a publishable key instead.",
				status: 0,
			});
		}

		const key = (publishableKey ?? secretKey) as string;

		// Sanity check the key shape so misconfigurations fail loudly at
		// construction time rather than on the first request.
		// Client keys: fbk_ci_dev_ / fbk_ci_live_
		// Secret keys: fbk_sk_dev_ / fbk_sk_live_
		const validPrefixes = ["fbk_ci_dev_", "fbk_ci_live_", "fbk_sk_dev_", "fbk_sk_live_"];
		if (!validPrefixes.some((p) => key.startsWith(p))) {
			throw new FeedbakkrError({
				code: "INVALID_KEY_FORMAT",
				message: "Feedbakkr API keys start with `fbk_ci_` (client) or `fbk_sk_` (secret).",
				status: 0,
			});
		}

		this.#apiKey = key;
		this.#baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
		// Bind fetch to globalThis to avoid "Illegal invocation" in
		// Cloudflare Workers where fetch loses its `this` reference.
		this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
		this.#retries = options.retries ?? DEFAULT_RETRIES;

		if (typeof this.#fetch !== "function") {
			throw new FeedbakkrError({
				code: "FETCH_UNAVAILABLE",
				message:
					"No `fetch` implementation found. Pass one explicitly via the `fetch` option, or use a runtime that provides global `fetch` (Node 20+, Bun, Deno, modern browsers, Cloudflare Workers).",
				status: 0,
			});
		}
	}

	/**
	 * Submit a feedback message to a channel by slug.
	 *
	 * Slugs are stable code constants. Hits `POST /v1/submit/<slug>`.
	 *
	 * Throws {@link FeedbakkrError} on any non-2xx response, with the
	 * stable error `code` from the API as documented at
	 * https://feedbakkr.com/docs/build/errors.
	 */
	async submit(args: SubmitArgs): Promise<FeedbakkrMessage> {
		if (!args.channelSlug || typeof args.channelSlug !== "string") {
			throw new FeedbakkrError({
				code: "INVALID_ARGUMENT",
				message: "`channelSlug` is required and must be a string.",
				status: 0,
			});
		}
		this.#validateFields(args.fields);
		return this.#submitTo(
			`/v1/submit/${encodeURIComponent(args.channelSlug)}`,
			args.fields,
			args.turnstileToken,
			args.signal,
		);
	}

	/**
	 * Submit a feedback message by channel ID. REST-conventional
	 * alternative path. Hits `POST /v1/channels/<id>/submit`. Same auth,
	 * payload, and result as {@link submit} — only the channel-resolution
	 * step differs server-side.
	 */
	async submitById(args: SubmitByIdArgs): Promise<FeedbakkrMessage> {
		if (!args.channelId || typeof args.channelId !== "string") {
			throw new FeedbakkrError({
				code: "INVALID_ARGUMENT",
				message: "`channelId` is required and must be a string.",
				status: 0,
			});
		}
		this.#validateFields(args.fields);
		return this.#submitTo(
			`/v1/channels/${encodeURIComponent(args.channelId)}/submit`,
			args.fields,
			args.turnstileToken,
			args.signal,
		);
	}

	#validateFields(fields: unknown): void {
		if (!fields || typeof fields !== "object") {
			throw new FeedbakkrError({
				code: "INVALID_ARGUMENT",
				message: "`fields` is required and must be an object.",
				status: 0,
			});
		}
	}

	async #submitTo(
		path: string,
		fields: unknown,
		turnstileToken: string | undefined,
		signal: AbortSignal | undefined,
	): Promise<FeedbakkrMessage> {
		const payload: Record<string, unknown> = { fields };
		if (turnstileToken) payload.turnstileToken = turnstileToken;
		const body = JSON.stringify(payload);

		const response = await this.#requestWithRetry(path, body, signal);

		// Parse the JSON body. The API always returns JSON for both
		// success and error responses.
		const json = (await response.json().catch(() => null)) as
			| FeedbakkrMessage
			| { code?: string; message?: string; details?: Record<string, unknown> }
			| null;

		if (!response.ok) {
			throw new FeedbakkrError({
				code: (json && "code" in json && json.code) || `HTTP_${response.status}`,
				message:
					(json && "message" in json && json.message) ||
					`Feedbakkr submission failed with HTTP ${response.status}.`,
				status: response.status,
				details:
					json && "details" in json && typeof json.details === "object" && json.details !== null
						? (json.details as Record<string, unknown>)
						: undefined,
			});
		}

		if (!json || typeof json !== "object" || !("id" in json)) {
			throw new FeedbakkrError({
				code: "MALFORMED_RESPONSE",
				message: "Feedbakkr returned a 2xx response that was not a valid message object.",
				status: response.status,
			});
		}

		return json as FeedbakkrMessage;
	}

	/**
	 * POST with retry on 429 and 5xx. Honours `Retry-After` for 429.
	 * Other errors propagate immediately.
	 */
	async #requestWithRetry(
		path: string,
		body: string,
		signal: AbortSignal | undefined,
	): Promise<Response> {
		const url = `${this.#baseUrl}${path}`;
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			Authorization: `Bearer ${this.#apiKey}`,
		};

		let attempt = 0;
		// `attempt` runs from 0 to `this.#retries` inclusive — that's
		// (retries + 1) total attempts.
		while (attempt <= this.#retries) {
			let response: Response;
			try {
				response = await this.#fetch(url, {
					method: "POST",
					headers,
					body,
					signal,
				});
			} catch (err) {
				// Network failure (DNS, TCP reset, etc). Retry like a 5xx.
				if (attempt >= this.#retries) {
					throw new FeedbakkrError({
						code: "NETWORK_ERROR",
						message:
							err instanceof Error
								? `Network error contacting Feedbakkr: ${err.message}`
								: "Network error contacting Feedbakkr.",
						status: 0,
					});
				}
				await sleep(backoffMs(attempt));
				attempt++;
				continue;
			}

			const retryable = response.status === 429 || response.status >= 500;
			if (!retryable || attempt >= this.#retries) return response;

			// Honour Retry-After if the server provided one.
			const retryAfter = Number(response.headers.get("Retry-After") ?? "");
			const waitMs =
				Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoffMs(attempt);
			await sleep(waitMs);
			attempt++;
		}

		// Unreachable — the loop always returns inside — but satisfies TypeScript.
		throw new FeedbakkrError({
			code: "NETWORK_ERROR",
			message: "Request failed after all retries.",
			status: 0,
		});
	}
}

function backoffMs(attempt: number): number {
	// 250ms, 500ms, 1s, 2s, …
	return 250 * 2 ** attempt;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
