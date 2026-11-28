/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { FilterQuery } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { AuditLog } from '../../audit/entities/audit-log.entity';
import { Account } from '../../auth/entities/account.entity';
import { ApiKey } from '../../auth/entities/api-key.entity';
import { Passkey } from '../../auth/entities/passkey.entity';
import { Session } from '../../auth/entities/session.entity';
import { BillingProfile } from '../../billing/entities/billing-profile.entity';
import { BillingReceipt } from '../../billing/entities/billing-receipt.entity';
import { DockerRegistry } from '../../docker-registry/entities/docker-registry.entity';
import { Machine } from '../../machine/entities/machine.entity';
import { HostProfile } from '../../marketplace/entities/host-profile.entity';
import { CustomDomain } from '../../networking/entities/custom-domain.entity';
import { Invitation } from '../../organization/entities/invitation.entity';
import { Member } from '../../organization/entities/member.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { Secret } from '../../secrets/entities/secret.entity';
import { PaymentWallet } from '../../settlement/entities/payment-wallet.entity';
import { UserWallet } from '../../settlement/entities/user-wallet.entity';
import { Snapshot } from '../../snapshot/entities/snapshot.entity';
import { User } from '../../user/entities/user.entity';
import { Volume } from '../../volume/entities/volume.entity';
import { WebhookEndpoint } from '../../webhook/entities/webhook-endpoint.entity';
import { DATA_EXPORT } from '../constants/data-export.constants';
import { exportRows, exportRowsInPages } from '../utils/export-rows.util';

const AUDIT_LOG_FIELDS = [
	'id',
	'actorDisplayName',
	'actorEmail',
	'organizationId',
	'action',
	'targetType',
	'targetId',
	'statusCode',
	'ipAddress',
	'userAgent',
	'createdAt',
] as const;

const AUDIT_LOG_ORDER = { createdAt: 'asc', id: 'asc' } as const;

function exportAuditLogs(manager: EntityManager, where: FilterQuery<AuditLog>) {
	return exportRowsInPages(
		manager,
		AuditLog,
		where,
		AUDIT_LOG_FIELDS,
		AUDIT_LOG_ORDER,
		DATA_EXPORT.AUDIT_LOG_PAGE_SIZE
	);
}

@Injectable()
export class DataExportService {
	constructor(private readonly entityManager: EntityManager) {}

	async account(userId: string) {
		const manager = this.entityManager.fork();
		const [user, logins, sessions, passkeys, memberships, wallet, activity] =
			await Promise.all([
				exportRows(manager, User, { id: userId }, [
					'id',
					'name',
					'email',
					'emailVerified',
					'image',
					'twoFactorEnabled',
					'acceptedTermsVersion',
					'termsAcceptedAt',
					'createdAt',
					'updatedAt',
				]),
				exportRows(manager, Account, { user: userId }, [
					'providerId',
					'accountId',
					'createdAt',
				]),
				exportRows(manager, Session, { user: userId }, [
					'ipAddress',
					'userAgent',
					'createdAt',
					'expiresAt',
				]),
				exportRows(manager, Passkey, { user: userId }, [
					'name',
					'deviceType',
					'backedUp',
					'createdAt',
				]),
				exportRows(manager, Member, { userId }, [
					'organizationId',
					'role',
					'createdAt',
				]),
				exportRows(manager, UserWallet, { userId }, [
					'chainId',
					'safeAddress',
					'recoveryOwnerKind',
					'recoveryOwnerAddress',
					'createdAt',
				]),
				exportAuditLogs(manager, { userId }),
			]);
		return {
			user: user[0] ?? null,
			logins,
			sessions,
			passkeys,
			memberships,
			wallet: wallet[0] ?? null,
			activity,
		};
	}

	async organization(organizationId: string) {
		const manager = this.entityManager.fork();
		const where = { organizationId };
		const [
			organization,
			members,
			invitations,
			billingProfile,
			receipts,
			paymentWallets,
			apiKeys,
			machines,
			sandboxes,
			snapshots,
			volumes,
			secrets,
			webhooks,
			registries,
			customDomains,
			hostProfile,
			activity,
		] = await Promise.all([
			exportRows(manager, Organization, { id: organizationId }, [
				'id',
				'name',
				'slug',
				'personal',
				'createdAt',
			]),
			exportRows(manager, Member, where, ['userId', 'role', 'createdAt']),
			exportRows(manager, Invitation, where, [
				'email',
				'role',
				'status',
				'expiresAt',
				'createdAt',
			]),
			exportRows(manager, BillingProfile, where, [
				'legalName',
				'addressLine1',
				'addressLine2',
				'city',
				'region',
				'postalCode',
				'country',
				'taxId',
				'updatedAt',
			]),
			exportRows(manager, BillingReceipt, where, [
				'id',
				'month',
				'sequence',
				'issuedAt',
				'billTo',
				'content',
			]),
			exportRows(manager, PaymentWallet, where, [
				'purpose',
				'address',
				'verifiedAt',
				'createdAt',
			]),
			exportRows(manager, ApiKey, { referenceId: organizationId }, [
				'name',
				'start',
				'enabled',
				'permissions',
				'expiresAt',
				'lastRequest',
				'createdAt',
			]),
			exportRows(manager, Machine, where, [
				'id',
				'name',
				'state',
				'country',
				'city',
				'tier',
				'createdAt',
			]),
			exportRows(manager, Sandbox, where, [
				'id',
				'name',
				'state',
				'snapshot',
				'sandboxClass',
				'createdAt',
			]),
			exportRows(manager, Snapshot, where, [
				'id',
				'name',
				'imageName',
				'state',
				'createdAt',
			]),
			exportRows(manager, Volume, where, [
				'id',
				'name',
				'sizeGiB',
				'state',
				'createdAt',
			]),
			exportRows(manager, Secret, where, [
				'name',
				'description',
				'createdAt',
				'updatedAt',
			]),
			exportRows(manager, WebhookEndpoint, where, [
				'url',
				'description',
				'eventTypes',
				'enabled',
				'createdAt',
			]),
			exportRows(manager, DockerRegistry, where, [
				'id',
				'name',
				'url',
				'username',
				'project',
				'registryType',
				'createdAt',
				'updatedAt',
			]),
			exportRows(manager, CustomDomain, where, [
				'id',
				'sandboxId',
				'exposureId',
				'hostname',
				'state',
				'activatedAt',
				'createdAt',
				'updatedAt',
			]),
			exportRows(manager, HostProfile, where, [
				'displayName',
				'description',
				'hostTermsVersion',
				'hostTermsAcceptedAt',
				'hostTermsAcceptedBy',
				'createdAt',
				'updatedAt',
			]),
			exportAuditLogs(manager, where),
		]);
		return {
			organization: organization[0] ?? null,
			members,
			invitations,
			billingProfile: billingProfile[0] ?? null,
			receipts,
			paymentWallets,
			apiKeys,
			machines,
			sandboxes,
			snapshots,
			volumes,
			secrets,
			webhooks,
			registries,
			customDomains,
			hostProfile: hostProfile[0] ?? null,
			activity,
		};
	}
}
