/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { z } from 'zod';

const SandboxErrorSchema = z.object({
	recoverable: z.boolean(),
	errorReason: z.string(),
});

const ErrorWithMessageSchema = z.object({ message: z.string().min(1) });

type SanitizedSandboxError = z.infer<typeof SandboxErrorSchema>;

function parseJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

export function sanitizeSandboxError(error: unknown): SanitizedSandboxError {
	if (typeof error === 'string') {
		const structured = SandboxErrorSchema.safeParse(parseJson(error));
		return structured.success
			? structured.data
			: { recoverable: false, errorReason: error };
	}
	const structured = SandboxErrorSchema.safeParse(error);
	if (structured.success) {
		return structured.data;
	}
	const withMessage = ErrorWithMessageSchema.safeParse(error);
	if (withMessage.success) {
		return sanitizeSandboxError(withMessage.data.message);
	}
	return { recoverable: false, errorReason: String(error) };
}
