import type { ApiErrorBody } from "./types.js";

export type FeedbakkrErrorKind = "api" | "network" | "config";

/**
 * Error thrown by the Feedbakkr SDK.
 *
 * - `kind: "api"` — The API returned a non-2xx response.
 * - `kind: "network"` — A fetch/network error occurred.
 * - `kind: "config"` — Invalid SDK configuration or input.
 */
export class FeedbakkrError extends Error {
	readonly kind: FeedbakkrErrorKind;
	/** HTTP status code (only present for API errors). */
	readonly status?: number;
	/** Machine-readable error code from the API (only present for API errors). */
	readonly code?: string;
	/** Additional error details from the API. */
	readonly details?: unknown;

	constructor(
		kind: FeedbakkrErrorKind,
		message: string,
		opts?: { status?: number; code?: string; details?: unknown },
	) {
		super(message);
		this.name = "FeedbakkrError";
		this.kind = kind;
		this.status = opts?.status;
		this.code = opts?.code;
		this.details = opts?.details;
	}

	static fromApiError(status: number, body: ApiErrorBody): FeedbakkrError {
		return new FeedbakkrError("api", body.message, {
			status,
			code: body.code,
			details: body.details,
		});
	}

	static networkError(cause: unknown): FeedbakkrError {
		const message = cause instanceof Error ? cause.message : "Network request failed";
		return new FeedbakkrError("network", message);
	}

	static configError(message: string): FeedbakkrError {
		return new FeedbakkrError("config", message);
	}
}
