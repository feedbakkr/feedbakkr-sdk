/**
 * Error thrown by the SDK whenever the Feedbakkr API responds with a
 * non-2xx status, *or* when the SDK rejects an operation locally
 * (e.g. attempting to use a secret key in the browser).
 *
 * Always match on `code`, never on `message` — `code` is part of the
 * stable contract documented at https://feedbakkr.com/docs/build/errors,
 * `message` is human-readable and may change between releases.
 */
export class FeedbakkrError extends Error {
	/** Stable error code (e.g. `VALIDATION_ERROR`, `RATE_LIMITED`). */
	readonly code: string;
	/** HTTP status code, or `0` for local errors raised by the SDK itself. */
	readonly status: number;
	/** Optional structured detail from the API (e.g. the offending field name). */
	readonly details?: Record<string, unknown>;

	constructor(opts: {
		code: string;
		message: string;
		status: number;
		details?: Record<string, unknown>;
	}) {
		super(opts.message);
		this.name = "FeedbakkrError";
		this.code = opts.code;
		this.status = opts.status;
		this.details = opts.details;

		// Preserve the prototype chain when transpiled to ES5 (defensive).
		Object.setPrototypeOf(this, FeedbakkrError.prototype);
	}
}
