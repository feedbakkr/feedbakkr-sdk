import { submitClientMessage } from "./client/submit-client-message.js";
import { submitServerMessage } from "./server/submit-server-message.js";
import { FeedbakkrError } from "./shared/errors.js";
import type { FeedbakkrConfig, SubmitMessageInput, SubmitMessageResult } from "./shared/types.js";

/**
 * A configured Feedbakkr client for submitting messages.
 *
 * Use {@link createFeedbakkrClient} to create an instance.
 */
export interface FeedbakkrClient {
	/**
	 * Submit a message using the configured API key.
	 * Automatically uses the client or server flow based on the key prefix.
	 */
	submit(input: SubmitMessageInput): Promise<SubmitMessageResult>;
}

/**
 * Create a Feedbakkr client for submitting messages.
 *
 * @example
 * ```ts
 * import { createFeedbakkrClient } from "@feedbakkr/sdk";
 *
 * const client = createFeedbakkrClient({
 *   apiKey: "fbk_sk_live_...",
 * });
 *
 * const result = await client.submit({
 *   channelId: "your-channel-id",
 *   fields: { name: "Jane", message: "Hello!" },
 * });
 * ```
 */
export function createFeedbakkrClient(config: FeedbakkrConfig): FeedbakkrClient {
	if (!config.apiKey) {
		throw FeedbakkrError.configError("apiKey is required");
	}

	const isClientKey = config.apiKey.startsWith("fbk_ci_");

	return {
		submit(input) {
			return isClientKey
				? submitClientMessage(config, input)
				: submitServerMessage(config, input);
		},
	};
}
