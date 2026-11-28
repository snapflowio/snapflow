/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { errorMessage } from '../../common/utils/error/error.util';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { TURNSTILE_SITEVERIFY } from '../constants/human-verification.constants';

const siteverifyResponseSchema = z.object({
	success: z.boolean(),
	hostname: z.string().optional(),
	action: z.string().optional(),
});

@Injectable()
export class HumanVerificationService {
	private readonly logger = new Logger(HumanVerificationService.name);

	constructor(private readonly config: TypedConfigService) {}

	async verify(
		token: string,
		remoteIp: string | undefined,
		expectedAction: string
	): Promise<boolean> {
		const body = new URLSearchParams({
			secret: this.config.get('humanVerification').secretKey,
			response: token,
			...(remoteIp && { remoteip: remoteIp }),
		});
		try {
			const response = await fetch(TURNSTILE_SITEVERIFY.url, {
				method: 'POST',
				body,
				signal: AbortSignal.timeout(TURNSTILE_SITEVERIFY.timeoutMilliseconds),
			});
			if (!response.ok) {
				await response.body?.cancel();
				throw new Error(`Turnstile answered HTTP ${response.status}`);
			}
			const result = siteverifyResponseSchema.parse(await response.json());
			return result.success && this.trusted(result, expectedAction);
		} catch (error) {
			this.logger.warn(
				`Could not verify a Turnstile token: ${errorMessage(error)}`
			);
			return false;
		}
	}

	private trusted(
		result: z.infer<typeof siteverifyResponseSchema>,
		expectedAction: string
	): boolean {
		if (!this.config.get('deployment').hosted) return true;
		const hostnames = new Set(
			this.config
				.get('trustedBrowserOrigins')
				.map((origin) => new URL(origin).hostname)
		);
		return (
			result.action === expectedAction &&
			result.hostname !== undefined &&
			hostnames.has(result.hostname)
		);
	}
}
