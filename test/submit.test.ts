import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createFeedbakkrClient,
	FeedbakkrError,
	submitClientMessage,
	submitServerMessage,
} from "../src/index.js";
import type { FeedbakkrConfig, SubmitMessageResult } from "../src/index.js";

const SUCCESS_RESPONSE: SubmitMessageResult = {
	id: "01JTEST000000000000000001",
	environment: "live",
	channelId: "ch-1",
	lifecycleState: "active",
	createdAt: "2025-01-01T00:00:00.000Z",
};

function mockFetch(status: number, body: unknown): typeof globalThis.fetch {
	return vi.fn().mockResolvedValue({
		ok: status >= 200 && status < 300,
		status,
		json: vi.fn().mockResolvedValue(body),
	});
}

const BASE_CONFIG: FeedbakkrConfig = {
	apiKey: "fbk_sk_live_test-key",
	baseUrl: "https://api.test.com",
};

const BY_SLUG = {
	channelSlug: "contact-form",
	fields: { name: "Jane", message: "Hello!" },
};

const BY_ID = {
	channelId: "ch-1",
	fields: { name: "Jane", message: "Hello!" },
};

describe("submitServerMessage", () => {
	it("hits /v1/submit/{slug} when channelSlug is provided", async () => {
		const fetchFn = mockFetch(201, SUCCESS_RESPONSE);
		const result = await submitServerMessage({ ...BASE_CONFIG, fetch: fetchFn }, BY_SLUG);

		expect(result).toEqual(SUCCESS_RESPONSE);
		expect(fetchFn).toHaveBeenCalledWith(
			"https://api.test.com/v1/submit/contact-form",
			expect.objectContaining({
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer fbk_sk_live_test-key",
				},
				body: JSON.stringify({ fields: BY_SLUG.fields }),
			}),
		);
	});

	it("hits /v1/channels/{id}/submit when channelId is provided", async () => {
		const fetchFn = mockFetch(201, SUCCESS_RESPONSE);
		await submitServerMessage({ ...BASE_CONFIG, fetch: fetchFn }, BY_ID);

		expect(fetchFn).toHaveBeenCalledWith(
			"https://api.test.com/v1/channels/ch-1/submit",
			expect.objectContaining({
				body: JSON.stringify({ fields: BY_ID.fields }),
			}),
		);
	});

	it("URL-encodes the channel identifier", async () => {
		const fetchFn = mockFetch(201, SUCCESS_RESPONSE);
		await submitServerMessage(
			{ ...BASE_CONFIG, fetch: fetchFn },
			{ channelSlug: "needs encoding!", fields: {} },
		);

		expect(fetchFn).toHaveBeenCalledWith(
			"https://api.test.com/v1/submit/needs%20encoding!",
			expect.anything(),
		);
	});

	it("prefers channelSlug when both are provided", async () => {
		const fetchFn = mockFetch(201, SUCCESS_RESPONSE);
		await submitServerMessage(
			{ ...BASE_CONFIG, fetch: fetchFn },
			{ channelSlug: "contact-form", channelId: "ch-1", fields: {} },
		);

		expect(fetchFn).toHaveBeenCalledWith(
			"https://api.test.com/v1/submit/contact-form",
			expect.anything(),
		);
	});

	it("throws FeedbakkrError with kind=api on API error", async () => {
		const fetchFn = mockFetch(400, {
			code: "VALIDATION_ERROR",
			message: "Invalid input",
			details: { fieldErrors: {} },
		});

		await expect(
			submitServerMessage({ ...BASE_CONFIG, fetch: fetchFn }, BY_ID),
		).rejects.toThrow(FeedbakkrError);

		try {
			await submitServerMessage({ ...BASE_CONFIG, fetch: fetchFn }, BY_ID);
		} catch (err) {
			const e = err as FeedbakkrError;
			expect(e.kind).toBe("api");
			expect(e.status).toBe(400);
			expect(e.code).toBe("VALIDATION_ERROR");
			expect(e.message).toBe("Invalid input");
			expect(e.details).toEqual({ fieldErrors: {} });
		}
	});

	it("throws FeedbakkrError with kind=api on 401", async () => {
		const fetchFn = mockFetch(401, {
			code: "UNAUTHORIZED",
			message: "Missing or invalid Authorization header",
		});

		try {
			await submitServerMessage({ ...BASE_CONFIG, fetch: fetchFn }, BY_ID);
		} catch (err) {
			const e = err as FeedbakkrError;
			expect(e.kind).toBe("api");
			expect(e.status).toBe(401);
			expect(e.code).toBe("UNAUTHORIZED");
		}
	});

	it("throws FeedbakkrError with kind=network on fetch failure", async () => {
		const fetchFn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

		try {
			await submitServerMessage(
				{ ...BASE_CONFIG, fetch: fetchFn as typeof globalThis.fetch },
				BY_ID,
			);
		} catch (err) {
			const e = err as FeedbakkrError;
			expect(e.kind).toBe("network");
			expect(e.message).toBe("Failed to fetch");
		}
	});

	it("throws FeedbakkrError with kind=config when apiKey is missing", async () => {
		await expect(
			submitServerMessage({ apiKey: "", fetch: mockFetch(201, {}) }, BY_ID),
		).rejects.toThrow(FeedbakkrError);

		try {
			await submitServerMessage({ apiKey: "", fetch: mockFetch(201, {}) }, BY_ID);
		} catch (err) {
			expect((err as FeedbakkrError).kind).toBe("config");
		}
	});

	it("throws FeedbakkrError with kind=config when neither channelSlug nor channelId is provided", async () => {
		try {
			await submitServerMessage(
				{ ...BASE_CONFIG, fetch: mockFetch(201, {}) },
				{ fields: {} },
			);
		} catch (err) {
			expect((err as FeedbakkrError).kind).toBe("config");
		}
	});

	it("handles non-JSON error response", async () => {
		const fetchFn = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			json: vi.fn().mockRejectedValue(new Error("not JSON")),
		});

		try {
			await submitServerMessage(
				{ ...BASE_CONFIG, fetch: fetchFn as typeof globalThis.fetch },
				BY_ID,
			);
		} catch (err) {
			const e = err as FeedbakkrError;
			expect(e.kind).toBe("api");
			expect(e.status).toBe(500);
			expect(e.code).toBe("UNKNOWN");
		}
	});
});

describe("submitClientMessage", () => {
	it("hits the slug URL with client key auth", async () => {
		const fetchFn = mockFetch(201, SUCCESS_RESPONSE);
		const result = await submitClientMessage(
			{ apiKey: "fbk_ci_live_test-key", baseUrl: "https://api.test.com", fetch: fetchFn },
			BY_SLUG,
		);

		expect(result).toEqual(SUCCESS_RESPONSE);
		expect(fetchFn).toHaveBeenCalledWith(
			"https://api.test.com/v1/submit/contact-form",
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: "Bearer fbk_ci_live_test-key",
				}),
				body: JSON.stringify({ fields: BY_SLUG.fields }),
			}),
		);
	});

	it("hits the id URL when channelId is provided", async () => {
		const fetchFn = mockFetch(201, SUCCESS_RESPONSE);
		await submitClientMessage(
			{ apiKey: "fbk_ci_live_test-key", baseUrl: "https://api.test.com", fetch: fetchFn },
			BY_ID,
		);

		expect(fetchFn).toHaveBeenCalledWith(
			"https://api.test.com/v1/channels/ch-1/submit",
			expect.anything(),
		);
	});
});

describe("createFeedbakkrClient", () => {
	it("creates a client that submits via server flow for secret keys", async () => {
		const fetchFn = mockFetch(201, SUCCESS_RESPONSE);
		const client = createFeedbakkrClient({
			apiKey: "fbk_sk_dev_test",
			baseUrl: "https://api.test.com",
			fetch: fetchFn,
		});

		const result = await client.submit(BY_ID);
		expect(result).toEqual(SUCCESS_RESPONSE);
	});

	it("creates a client that submits via client flow for client keys", async () => {
		const fetchFn = mockFetch(201, SUCCESS_RESPONSE);
		const client = createFeedbakkrClient({
			apiKey: "fbk_ci_live_test",
			baseUrl: "https://api.test.com",
			fetch: fetchFn,
		});

		const result = await client.submit(BY_SLUG);
		expect(result).toEqual(SUCCESS_RESPONSE);
	});

	it("throws on empty apiKey", () => {
		expect(() => createFeedbakkrClient({ apiKey: "" })).toThrow(FeedbakkrError);
	});

	it("uses default base URL when not provided", async () => {
		const fetchFn = mockFetch(201, SUCCESS_RESPONSE);
		const client = createFeedbakkrClient({ apiKey: "fbk_sk_live_x", fetch: fetchFn });
		await client.submit(BY_SLUG);

		expect(fetchFn).toHaveBeenCalledWith(
			"https://api.feedbakkr.com/v1/submit/contact-form",
			expect.anything(),
		);
	});

	it("strips trailing slash from baseUrl", async () => {
		const fetchFn = mockFetch(201, SUCCESS_RESPONSE);
		const client = createFeedbakkrClient({
			apiKey: "fbk_sk_live_x",
			baseUrl: "https://api.test.com/",
			fetch: fetchFn,
		});
		await client.submit(BY_SLUG);

		expect(fetchFn).toHaveBeenCalledWith(
			"https://api.test.com/v1/submit/contact-form",
			expect.anything(),
		);
	});
});

describe("FeedbakkrError", () => {
	it("has correct name and properties", () => {
		const err = new FeedbakkrError("api", "test", { status: 400, code: "TEST" });
		expect(err.name).toBe("FeedbakkrError");
		expect(err.kind).toBe("api");
		expect(err.status).toBe(400);
		expect(err.code).toBe("TEST");
		expect(err instanceof Error).toBe(true);
	});

	it("fromApiError creates correct error", () => {
		const err = FeedbakkrError.fromApiError(422, {
			code: "FIELD_VALIDATION_ERROR",
			message: "Field validation failed",
			details: { fieldErrors: { name: ["Required"] } },
		});
		expect(err.kind).toBe("api");
		expect(err.status).toBe(422);
		expect(err.details).toEqual({ fieldErrors: { name: ["Required"] } });
	});

	it("networkError creates correct error", () => {
		const err = FeedbakkrError.networkError(new TypeError("fetch failed"));
		expect(err.kind).toBe("network");
		expect(err.message).toBe("fetch failed");
	});

	it("configError creates correct error", () => {
		const err = FeedbakkrError.configError("missing key");
		expect(err.kind).toBe("config");
		expect(err.message).toBe("missing key");
	});
});
