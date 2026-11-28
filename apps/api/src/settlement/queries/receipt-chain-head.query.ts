/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { MACHINE_USAGE_GENESIS_DIGEST } from '../../machine/constants/machine-usage.constants';
import { MachineUsageReceipt } from '../../machine/entities/machine-usage-receipt.entity';
import type { ReceiptChainHead } from '../types/payment-channel.types';
import { receiptDigestWord } from '../utils/vouchers/receipt-chain.util';

export async function receiptChainHead(
	manager: EntityManager,
	placementId: string
): Promise<ReceiptChainHead> {
	const [latest] = await manager.find(
		MachineUsageReceipt,
		{ placementId },
		{
			fields: ['payloadDigest', 'sampledAt'],
			orderBy: { sampledAt: 'DESC', receivedAt: 'DESC' },
			limit: 1,
		}
	);
	return {
		digest: receiptDigestWord(
			latest?.payloadDigest ?? MACHINE_USAGE_GENESIS_DIGEST
		),
		receiptCount: await manager.count(MachineUsageReceipt, { placementId }),
		sampledAt: latest?.sampledAt ?? null,
	};
}
