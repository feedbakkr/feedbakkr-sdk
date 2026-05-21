import { FeedbakkrError } from "./errors.js";
import type { SubmitMessageInput } from "./types.js";

/**
 * Pick the submission URL based on which channel identifier the caller
 * provided. Slug is the server's primary external path; the ID route is
 * the REST-conventional fallback. Both terminate in the same handler.
 */
export function resolveSubmitPath(input: SubmitMessageInput): string {
	if (input.channelSlug) {
		return `/v1/submit/${encodeURIComponent(input.channelSlug)}`;
	}
	if (input.channelId) {
		return `/v1/channels/${encodeURIComponent(input.channelId)}/submit`;
	}
	throw FeedbakkrError.configError("channelSlug or channelId is required");
}
