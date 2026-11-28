/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { RECEIPT_ISSUE_LOCK_KEY } from '../constants/billing-receipt.constants';

export async function lockReceiptIssuing(
	manager: EntityManager
): Promise<void> {
	await manager.execute('SELECT pg_advisory_xact_lock(?)', [
		RECEIPT_ISSUE_LOCK_KEY.toString(),
	]);
}

export async function nextReceiptSequence(
	manager: EntityManager
): Promise<number> {
	const [row] = await manager.execute<{ next: number }[]>(
		'SELECT COALESCE(MAX(sequence), 0) + 1 AS next FROM "billing_receipt"'
	);
	if (!row) throw new Error('The receipt sequence query returned no row');
	return Number(row.next);
}
