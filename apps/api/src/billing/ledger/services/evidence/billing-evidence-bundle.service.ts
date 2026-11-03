/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash, randomUUID } from 'node:crypto';
import type { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { canonicalJson } from '../../../../common/utils/canonical-json.util';
import { BillingEvidenceBundle } from '../../entities/billing-evidence-bundle.entity';
import {
	type BillingEvidenceBundlePayload,
	BillingEvidenceBundlePayloadSchema,
} from '../../schemas/billing-evidence-bundle.schema';

@Injectable()
export class BillingEvidenceBundleService {
	async record(
		manager: EntityManager,
		payloadInput: BillingEvidenceBundlePayload
	): Promise<BillingEvidenceBundle> {
		const payload = BillingEvidenceBundlePayloadSchema.parse(payloadInput);
		const root = billingEvidenceRoot(payload);
		const existing = await manager.findOne(BillingEvidenceBundle, {
			lineItemId: payload.lineItemId,
		});
		if (existing) {
			if (
				existing.root !== root ||
				canonicalJson(existing.payload) !== canonicalJson(payload)
			) {
				throw new Error(
					`Billing evidence for line ${payload.lineItemId} was replayed with different content`
				);
			}
			return existing;
		}
		const bundle = manager.create(BillingEvidenceBundle, {
			id: randomUUID(),
			lineItemId: payload.lineItemId,
			schemaVersion: payload.schemaVersion,
			kind: payload.kind,
			root,
			payload,
			createdAt: new Date(payload.createdAt),
		});
		manager.persist(bundle);
		return bundle;
	}
}

export function billingEvidenceRoot(
	payloadInput: BillingEvidenceBundlePayload
): string {
	const payload = BillingEvidenceBundlePayloadSchema.parse(payloadInput);
	return createHash('sha256').update(canonicalJson(payload)).digest('hex');
}
