/** Configuration for creating a Feedbakkr client. */
export interface FeedbakkrConfig {
	/** Your Feedbakkr API key (client or secret key). */
	apiKey: string;
	/**
	 * Base URL of the Feedbakkr API.
	 * @default "https://api.feedbakkr.com"
	 */
	baseUrl?: string;
	/**
	 * Custom fetch implementation. Defaults to the global `fetch`.
	 * Useful for testing or custom HTTP handling.
	 */
	fetch?: typeof globalThis.fetch;
}

/** Input for submitting a message. */
export interface SubmitMessageInput {
	/** The channel ID to submit the message to. */
	channelId: string;
	/** Field values matching the channel's published schema. */
	fields: Record<string, unknown>;
}

/** Successful response from a message submission. */
export interface SubmitMessageResult {
	/** The unique message ID (ULID). */
	id: string;
	/** The environment the message was submitted to (dev or live). */
	environment: "dev" | "live";
	/** The channel the message was submitted to. */
	channelId: string;
	/** The lifecycle state of the message. */
	lifecycleState: "active" | "quota_held";
	/** ISO 8601 timestamp of when the message was created. */
	createdAt: string;
}

/** Structured error response from the Feedbakkr API. */
export interface ApiErrorBody {
	/** Machine-readable error code. */
	code: string;
	/** Human-readable error message. */
	message: string;
	/** Additional error details (e.g. field validation errors). */
	details?: unknown;
}
