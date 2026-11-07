/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	Injectable,
	Logger,
	ServiceUnavailableException,
} from '@nestjs/common';
import type { Address } from 'viem';
import { z } from 'zod';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { PaymentWalletErrorCode } from '../constants/payment-wallet.constants';
import {
	SANCTIONS_API_KEY_HEADER,
	SANCTIONS_REQUEST_TIMEOUT_MILLISECONDS,
} from '../constants/settlement.constants';
import type { PaymentWallet } from '../entities/payment-wallet.entity';
import { SanctionsStatus } from '../enums/sanctions-status.enum';

const sanctionsResponseSchema = z.object({
	identifications: z.array(z.unknown()),
});

export type SanctionsScreening = Pick<
	PaymentWallet,
	'sanctionsStatus' | 'sanctionsCheckedAt'
>;

@Injectable()
export class SanctionsScreeningService {
	private readonly logger = new Logger(SanctionsScreeningService.name);

	constructor(private readonly config: TypedConfigService) {}

	// Fails closed: an unreachable or malformed screening answer never lets an
	// address through as clear.
	async screen(address: Address): Promise<SanctionsScreening> {
		const { apiKey, apiUrl } = this.config.get('settlement.sanctions');
		if (!apiKey) {
			return {
				sanctionsStatus: SanctionsStatus.UNCHECKED,
				sanctionsCheckedAt: null,
			};
		}
		const identifications = await this.identifications(apiUrl, apiKey, address);
		return {
			sanctionsStatus:
				identifications.length > 0
					? SanctionsStatus.BLOCKED
					: SanctionsStatus.CLEAR,
			sanctionsCheckedAt: new Date(),
		};
	}

	private async identifications(
		apiUrl: string,
		apiKey: string,
		address: Address
	): Promise<readonly unknown[]> {
		try {
			const response = await fetch(`${apiUrl}/${address}`, {
				headers: { [SANCTIONS_API_KEY_HEADER]: apiKey },
				signal: AbortSignal.timeout(SANCTIONS_REQUEST_TIMEOUT_MILLISECONDS),
			});
			if (!response.ok) {
				await response.body?.cancel();
				throw new Error(`Sanctions API answered HTTP ${response.status}`);
			}
			return sanctionsResponseSchema.parse(await response.json())
				.identifications;
		} catch (error) {
			this.logger.error(`Could not screen ${address} for sanctions`, error);
			throw new ServiceUnavailableException({
				code: PaymentWalletErrorCode.SANCTIONS_SCREENING_UNAVAILABLE,
				message: 'Sanctions screening is unavailable; retry shortly',
			});
		}
	}
}
