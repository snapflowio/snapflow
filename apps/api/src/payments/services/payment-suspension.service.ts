/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
	AUDIT_ACTOR_TYPE,
	AUDIT_CREDENTIAL_TYPE,
} from '../../audit/constants/audit-principal.constants';
import { AuditAction } from '../../audit/enums/audit-action.enum';
import { AuditTarget } from '../../audit/enums/audit-target.enum';
import { AuditService } from '../../audit/services/audit.service';
import { Organization } from '../../organization/entities/organization.entity';
import { OrganizationSuspensionService } from '../../organization/services/organization-suspension.service';
import type { PaymentSuspensionReason } from '../constants/payments.constants';

const PAYMENTS_AUDIT_ACTOR_ID = 'payments';

@Injectable()
export class PaymentSuspensionService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly suspensions: OrganizationSuspensionService,
		private readonly audit: AuditService
	) {}

	async suspend(
		organizationId: string,
		reason: PaymentSuspensionReason,
		evidence: Record<string, string>
	): Promise<void> {
		const organization = await this.entityManager
			.fork()
			.findOne(
				Organization,
				{ id: organizationId },
				{ fields: ['id', 'suspended', 'suspensionReason'] }
			);
		if (!organization) return;
		if (organization.suspended && organization.suspensionReason === reason) {
			return;
		}
		await this.suspensions.suspend(organizationId, { reason });
		await this.audit.createCompletedLog({
			actorType: AUDIT_ACTOR_TYPE.SYSTEM,
			actorId: PAYMENTS_AUDIT_ACTOR_ID,
			credentialType: AUDIT_CREDENTIAL_TYPE.SYSTEM,
			organizationId,
			action: AuditAction.SUSPEND,
			targetType: AuditTarget.ORGANIZATION,
			targetId: organizationId,
			statusCode: HttpStatus.OK,
			metadata: { reason, ...evidence },
		});
	}
}
