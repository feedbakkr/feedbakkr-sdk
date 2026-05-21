import { FeedbakkrError } from "../shared/errors.js";
import { apiPost } from "../shared/fetch.js";
import { resolveSubmitPath } from "../shared/submit-url.js";
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

	return apiPost<SubmitMessageResult>({
		apiKey: config.apiKey,
		baseUrl: config.baseUrl,
		fetch: config.fetch,
		// Throws config error if neither channelSlug nor channelId was provided.
		path: resolveSubmitPath(input),
		// Channel addressing lives in the URL — body carries only fields.
		body: { fields: input.fields },
	});
}
