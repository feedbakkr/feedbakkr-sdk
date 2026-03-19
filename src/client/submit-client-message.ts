import { FeedbakkrError } from "../shared/errors.js";
import { apiPost } from "../shared/fetch.js";
import type { FeedbakkrConfig, SubmitMessageInput, SubmitMessageResult } from "../shared/types.js";

/**
 * Submit a message from a browser/client environment using a client (publishable) key.
 *
 * Client keys are prefixed with `fbk_ci_dev_` or `fbk_ci_live_`.
 * The browser's Origin header is validated against the channel's allowed origins.
 *
 * @throws {FeedbakkrError} On validation, network, or API errors.
 */
export async function submitClientMessage(
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
