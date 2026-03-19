import { FeedbakkrError } from "../shared/errors.js";
import { apiPost } from "../shared/fetch.js";
import type { FeedbakkrConfig, SubmitMessageInput, SubmitMessageResult } from "../shared/types.js";

/**
 * Submit a message from a server environment using a secret key.
 *
 * Secret keys are prefixed with `fbk_sk_dev_` or `fbk_sk_live_`.
 * Must not be called from a browser — the API rejects requests with an Origin header.
 *
 * @throws {FeedbakkrError} On validation, network, or API errors.
 */
export async function submitServerMessage(
	config: FeedbakkrConfig,
	input: SubmitMessageInput,
): Promise<SubmitMessageResult> {
	if (!config.apiKey) {
		throw FeedbakkrError.configError("apiKey is required");
	}
	if (!input.channelId) {
		throw FeedbakkrError.configError("channelId is required");
	}

	return apiPost<SubmitMessageResult>({
		apiKey: config.apiKey,
		baseUrl: config.baseUrl,
		fetch: config.fetch,
		path: "/v1/submit",
		body: {
			channelId: input.channelId,
			fields: input.fields,
		},
	});
}
