export { createFeedbakkrClient } from "./client.js";
export type { FeedbakkrClient } from "./client.js";

export { submitClientMessage } from "./client/submit-client-message.js";
export { submitServerMessage } from "./server/submit-server-message.js";

export { FeedbakkrError } from "./shared/errors.js";
export type { FeedbakkrErrorKind } from "./shared/errors.js";

export type {
	FeedbakkrConfig,
	SubmitMessageInput,
	SubmitMessageResult,
	ApiErrorBody,
} from "./shared/types.js";
