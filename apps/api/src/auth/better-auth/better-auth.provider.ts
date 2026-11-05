/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MikroORM } from '@mikro-orm/postgresql';
import { type FactoryProvider, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import type Redis from 'ioredis';
import { AuditService } from '../../audit/services/audit.service';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { EmailService } from '../../infra/email/services/email.service';
import { OrganizationService } from '../../organization/services/organization.service';
import { OrganizationOwnershipService } from '../../organization/services/organization-ownership.service';
import { OrganizationQuotaService } from '../../organization/services/organization-quota.service';
import { OrganizationSuspensionService } from '../../organization/services/organization-suspension.service';
import { PersonalOrganizationService } from '../../organization/services/personal-organization.service';
import { UserService } from '../../user/services/user.service';
import { type Auth, createAuthConfig } from './better-auth.config';

export const BETTER_AUTH = Symbol('BETTER_AUTH');

export const InjectBetterAuth = () => Inject(BETTER_AUTH);

export const betterAuthProvider: FactoryProvider<Auth> = {
	provide: BETTER_AUTH,
	inject: [
		TypedConfigService,
		EventEmitter2,
		MikroORM,
		getRedisConnectionToken(),
		EmailService,
		AuditService,
		UserService,
		OrganizationService,
		PersonalOrganizationService,
		OrganizationOwnershipService,
		OrganizationQuotaService,
		OrganizationSuspensionService,
	],
	useFactory: (
		configService: TypedConfigService,
		eventEmitter: EventEmitter2,
		orm: MikroORM,
		redis: Redis,
		emailService: EmailService,
		auditService: AuditService,
		userService: UserService,
		organizations: OrganizationService,
		personalOrganizations: PersonalOrganizationService,
		ownership: OrganizationOwnershipService,
		quotas: OrganizationQuotaService,
		suspensions: OrganizationSuspensionService
	) =>
		createAuthConfig({
			auditService,
			configService,
			emailService,
			eventEmitter,
			orm,
			organizations,
			ownership,
			personalOrganizations,
			quotas,
			redis,
			suspensions,
			userService,
		}),
};
