/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { FundingNoticeKind } from '../../billing/constants/funding.constants';
import {
	type FundingNotice,
	FundingNoticeEvent,
} from '../../billing/events/funding-notice.event';
import { addSeconds } from '../../common/utils/time.util';
import { TypedConfigService } from '../../config/services/typed-config.service';
import {
	databaseNow,
	parseDatabaseTimestamp,
} from '../../infra/database/utils/database-time.util';
import { configuredEscrow } from '../../settlement/utils/escrow/escrow-identity.util';
import { SIGNER_NOTICE_SCAN } from '../constants/notice.constants';
import { enqueueFundingNotice, noticeKey } from '../utils/notice-outbox.util';

const SIGNERS_NEEDING_NOTICE_SQL = `
	SELECT delegated."organizationId" AS "organizationId",
	       escrow_grant.id AS "grantId",
	       escrow_grant."expiresAt" AS "expiresAt",
	       (escrow_grant."revokedAt" IS NOT NULL OR escrow_grant."thawEndsAt" IS NOT NULL) AS revoked
	FROM delegated_signer delegated
	JOIN escrow_signer escrow_grant
	  ON escrow_grant."chainId" = delegated."chainId"
	 AND escrow_grant."contractAddress" = delegated."contractAddress"
	 AND escrow_grant."signerAddress" = delegated."signerAddress"
	WHERE delegated."retiredAt" IS NULL
	  AND delegated."chainId" = ?
	  AND delegated."contractAddress" = ?
	  AND (escrow_grant."revokedAt" IS NOT NULL
	       OR escrow_grant."thawEndsAt" IS NOT NULL
	       OR escrow_grant."expiresAt" <= ?)`;

interface SignerNeedingNotice {
	organizationId: string;
	grantId: string;
	expiresAt: unknown;
	revoked: boolean;
}

function signerNotice(
	signer: SignerNeedingNotice,
	now: Date
): { noticeId: string; notice: FundingNotice } {
	if (signer.revoked) {
		const kind = FundingNoticeKind.SIGNER_REVOKED;
		return { noticeId: noticeKey(kind, signer.grantId), notice: { kind } };
	}
	const expiresAt = parseDatabaseTimestamp(signer.expiresAt);
	const kind =
		expiresAt <= now
			? FundingNoticeKind.SIGNER_EXPIRED
			: FundingNoticeKind.SIGNER_EXPIRING;
	return {
		noticeId: noticeKey(kind, signer.grantId, expiresAt.getTime()),
		notice: { kind, expiresAt: expiresAt.toISOString() },
	};
}

@Injectable()
export class SignerNoticeScanService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly config: TypedConfigService
	) {}

	async scan(): Promise<void> {
		const manager = this.entityManager.fork();
		const now = await databaseNow(manager);
		const escrow = configuredEscrow(this.config);
		const signers = await manager.execute<SignerNeedingNotice[]>(
			SIGNERS_NEEDING_NOTICE_SQL,
			[
				escrow.chainId,
				escrow.contractAddress,
				addSeconds(now, SIGNER_NOTICE_SCAN.expiringWithinSeconds),
			]
		);
		for (const signer of signers) {
			const { noticeId, notice } = signerNotice(signer, now);
			await enqueueFundingNotice(
				manager,
				new FundingNoticeEvent(signer.organizationId, noticeId, notice, now)
			);
		}
	}
}
