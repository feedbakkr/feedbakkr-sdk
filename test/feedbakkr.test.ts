import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Feedbakkr, FeedbakkrError } from "../src/index.js";

const PUB = "fbk_ci_dev_xxxxxxxxxxxxxxxx";
const SECRET = "fbk_sk_dev_xxxxxxxxxxxxxxxx";
const CHANNEL_ID = "01J9AXXXXXXXXXXXXXXXXXXXXX";
const CHANNEL_SLUG = "feedback";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
	return new Response(JSON.stringify(body), {
		status: init.status ?? 200,
		headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
	});
}

function ackBody() {
	return {
		id: "01J9BMXXXXXXXXXXXXXXX",
		environment: "live" as const,
		channelId: CHANNEL_ID,
		lifecycleState: "visible" as const,
		createdAt: "2026-04-08T00:00:00.000Z",
	};
}

/** Run `fn`, expect it to throw a FeedbakkrError with the given code. */
function expectThrowsCode(fn: () => unknown, code: string): void {
	let caught: unknown;
	try {
		fn();
	} catch (e) {
		caught = e;
	}
	expect(caught).toBeInstanceOf(FeedbakkrError);
	expect((caught as FeedbakkrError).code).toBe(code);
}

describe("Feedbakkr — construction", () => {
	it("accepts a publishable key", () => {
		expect(() => new Feedbakkr({ publishableKey: PUB })).not.toThrow();
	});

	it("accepts a secret key in non-browser runtime", () => {
		expect(() => new Feedbakkr({ secretKey: SECRET })).not.toThrow();
	});

	it("rejects when no key is supplied", () => {
		expect(() => new Feedbakkr({})).toThrow(FeedbakkrError);
	});

	it("rejects when both keys are supplied", () => {
		expect(() => new Feedbakkr({ publishableKey: PUB, secretKey: SECRET })).toThrow(FeedbakkrError);
	});

	it("rejects keys with the wrong shape", () => {
		expectThrowsCode(
			() => new Feedbakkr({ publishableKey: "totally-wrong" }),
			"INVALID_KEY_FORMAT",
		);
	});

	it("refuses a secret key in a browser-shaped runtime", () => {
		const original = (globalThis as { window?: unknown }).window;
		(globalThis as { window?: unknown }).window = { document: {} };
		try {
			expectThrowsCode(() => new Feedbakkr({ secretKey: SECRET }), "SECRET_KEY_IN_BROWSER");
		} finally {
			if (original === undefined) {
				delete (globalThis as { window?: unknown }).window;
			} else {
				(globalThis as { window?: unknown }).window = original;
			}
		}
	});

	it("normalises trailing slash on baseUrl", async () => {
		const fetchMock = vi.fn(async () => jsonResponse(ackBody()));
		const fbk = new Feedbakkr({
			publishableKey: PUB,
			baseUrl: "https://dev-api.feedbakkr.com/",
			fetch: fetchMock,
		});
		await fbk.submit({ channelSlug: CHANNEL_SLUG, fields: { name: "Ada" } });
		expect(fetchMock.mock.calls[0]?.[0]).toBe(
			`https://dev-api.feedbakkr.com/v1/submit/${CHANNEL_SLUG}`,
		);
	});
});

describe("Feedbakkr — submit by slug (primary path)", () => {
	it("posts to /v1/submit/<slug> with bearer header and body excluding channel id", async () => {
		const fetchMock = vi.fn(async () => jsonResponse(ackBody()));
		const fbk = new Feedbakkr({ publishableKey: PUB, fetch: fetchMock });
		const message = await fbk.submit({
			channelSlug: CHANNEL_SLUG,
			fields: { name: "Ada", message: "Hi" },
		});

		expect(message.id).toBe("01J9BMXXXXXXXXXXXXXXX");
		expect(message.lifecycleState).toBe("visible");

		const [url, init] = fetchMock.mock.calls[0] ?? [];
		expect(url).toBe(`https://api.feedbakkr.com/v1/submit/${CHANNEL_SLUG}`);
		expect(init?.method).toBe("POST");
		const headers = init?.headers as Record<string, string>;
		expect(headers.Authorization).toBe(`Bearer ${PUB}`);
		expect(headers["Content-Type"]).toBe("application/json");
		expect(JSON.parse(init?.body as string)).toEqual({
			fields: { name: "Ada", message: "Hi" },
		});
	});

	it("rejects missing channelSlug before any network call", async () => {
		const fetchMock = vi.fn();
		const fbk = new Feedbakkr({ publishableKey: PUB, fetch: fetchMock });
		await expect(
			// @ts-expect-error — intentional
			fbk.submit({ fields: {} }),
		).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("URL-encodes special characters in the slug", async () => {
		const fetchMock = vi.fn(async () => jsonResponse(ackBody()));
		const fbk = new Feedbakkr({ publishableKey: PUB, fetch: fetchMock });
		// Slug regex would reject these server-side, but the SDK still
		// encodes defensively rather than crash with a URL-injection.
		await fbk.submit({ channelSlug: "foo bar/baz", fields: {} });
		expect(fetchMock.mock.calls[0]?.[0]).toBe(
			"https://api.feedbakkr.com/v1/submit/foo%20bar%2Fbaz",
		);
	});
});

describe("Feedbakkr — submitById (REST-conventional path)", () => {
	it("posts to /v1/channels/<id>/submit", async () => {
		const fetchMock = vi.fn(async () => jsonResponse(ackBody()));
		const fbk = new Feedbakkr({ publishableKey: PUB, fetch: fetchMock });
		const message = await fbk.submitById({
			channelId: CHANNEL_ID,
			fields: { name: "Ada" },
		});

		expect(message.id).toBe("01J9BMXXXXXXXXXXXXXXX");
		const [url, init] = fetchMock.mock.calls[0] ?? [];
		expect(url).toBe(`https://api.feedbakkr.com/v1/channels/${CHANNEL_ID}/submit`);
		expect(JSON.parse(init?.body as string)).toEqual({
			fields: { name: "Ada" },
		});
	});

	it("rejects missing channelId before any network call", async () => {
		const fetchMock = vi.fn();
		const fbk = new Feedbakkr({ publishableKey: PUB, fetch: fetchMock });
		await expect(
			// @ts-expect-error — intentional
			fbk.submitById({ fields: {} }),
		).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe("Feedbakkr — error responses", () => {
	it("throws FeedbakkrError with the API code on 400", async () => {
		const fetchMock = vi.fn(async () =>
			jsonResponse(
				{
					code: "VALIDATION_ERROR",
					message: "fields.email: invalid email format",
					details: { field: "email" },
				},
				{ status: 400 },
			),
		);
		const fbk = new Feedbakkr({ publishableKey: PUB, fetch: fetchMock });
		await expect(fbk.submit({ channelSlug: CHANNEL_SLUG, fields: {} })).rejects.toMatchObject({
			name: "FeedbakkrError",
			code: "VALIDATION_ERROR",
			status: 400,
			details: { field: "email" },
		});
	});

	it("falls back to HTTP_<status> code if the body has no code", async () => {
		const fetchMock = vi.fn(async () => new Response("", { status: 401 }));
		const fbk = new Feedbakkr({ publishableKey: PUB, fetch: fetchMock });
		await expect(fbk.submit({ channelSlug: CHANNEL_SLUG, fields: {} })).rejects.toMatchObject({
			code: "HTTP_401",
			status: 401,
		});
	});

	it("throws MALFORMED_RESPONSE on a 200 with no message body", async () => {
		const fetchMock = vi.fn(async () => new Response("not json", { status: 200 }));
		const fbk = new Feedbakkr({ publishableKey: PUB, fetch: fetchMock });
		await expect(fbk.submit({ channelSlug: CHANNEL_SLUG, fields: {} })).rejects.toMatchObject({
			code: "MALFORMED_RESPONSE",
		});
	});
});

describe("Feedbakkr — retries", () => {
	let originalSetTimeout: typeof globalThis.setTimeout;

	beforeEach(() => {
		originalSetTimeout = globalThis.setTimeout;
		(globalThis as any).setTimeout = (cb: () => void) => {
			cb();
			return 0 as unknown as ReturnType<typeof globalThis.setTimeout>;
		};
	});

	afterEach(() => {
		globalThis.setTimeout = originalSetTimeout;
	});

	it("retries 429 then succeeds", async () => {
		let calls = 0;
		const fetchMock = vi.fn(async () => {
			calls++;
			if (calls === 1) {
				return new Response("", {
					status: 429,
					headers: { "Retry-After": "0" },
				});
			}
			return jsonResponse(ackBody());
		});

		const fbk = new Feedbakkr({ publishableKey: PUB, fetch: fetchMock, retries: 2 });
		const message = await fbk.submit({ channelSlug: CHANNEL_SLUG, fields: { x: 1 } });
		expect(message.id).toBe("01J9BMXXXXXXXXXXXXXXX");
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("retries 5xx then surfaces the final error", async () => {
		const fetchMock = vi.fn(async () => new Response("", { status: 503 }));
		const fbk = new Feedbakkr({ publishableKey: PUB, fetch: fetchMock, retries: 2 });
		await expect(fbk.submit({ channelSlug: CHANNEL_SLUG, fields: {} })).rejects.toMatchObject({
			status: 503,
		});
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("does not retry 4xx other than 429", async () => {
		const fetchMock = vi.fn(async () =>
			jsonResponse({ code: "VALIDATION_ERROR", message: "no" }, { status: 400 }),
		);
		const fbk = new Feedbakkr({ publishableKey: PUB, fetch: fetchMock, retries: 5 });
		await expect(fbk.submit({ channelSlug: CHANNEL_SLUG, fields: {} })).rejects.toMatchObject({
			code: "VALIDATION_ERROR",
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("retries on network errors and gives up after the retry budget", async () => {
		const fetchMock = vi.fn(async () => {
			throw new TypeError("fetch failed");
		});
		const fbk = new Feedbakkr({ publishableKey: PUB, fetch: fetchMock, retries: 2 });
		await expect(fbk.submit({ channelSlug: CHANNEL_SLUG, fields: {} })).rejects.toMatchObject({
			code: "NETWORK_ERROR",
		});
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});
});
