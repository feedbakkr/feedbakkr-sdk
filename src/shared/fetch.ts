import { FeedbakkrError } from "./errors.js";
import type { ApiErrorBody } from "./types.js";

const DEFAULT_BASE_URL = "https://api.feedbakkr.com";

export interface RequestOptions {
	apiKey: string;
	baseUrl?: string;
	fetch?: typeof globalThis.fetch;
	path: string;
	body: unknown;
}

export async function apiPost<T>(opts: RequestOptions): Promise<T> {
	const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
	const url = `${baseUrl}${opts.path}`;
	const fetchFn = opts.fetch ?? globalThis.fetch;

	let response: Response;
	try {
		response = await fetchFn(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${opts.apiKey}`,
			},
			body: JSON.stringify(opts.body),
		});
	} catch (err) {
		throw FeedbakkrError.networkError(err);
	}

	if (!response.ok) {
		let body: ApiErrorBody;
		try {
			body = (await response.json()) as ApiErrorBody;
		} catch {
			throw new FeedbakkrError("api", `API returned ${response.status}`, {
				status: response.status,
				code: "UNKNOWN",
			});
		}
		throw FeedbakkrError.fromApiError(response.status, body);
	}

	return (await response.json()) as T;
}
