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
import { GeoIpService } from '../../location/services/geo-ip.service';
import { OrganizationService } from '../../organization/services/organization.service';
import { OrganizationOwnershipService } from '../../organization/services/organization-ownership.service';
import { OrganizationQuotaTierService } from '../../organization/services/organization-quota-tier.service';
import { OrganizationSuspensionService } from '../../organization/services/organization-suspension.service';
import { PersonalOrganizationService } from '../../organization/services/personal-organization.service';
import { HeldFundsService } from '../../settlement/services/funds/held-funds.service';
import { SafeWalletChainService } from '../../settlement/services/wallets/safe-wallet-chain.service';
import { UserService } from '../../user/services/user.service';
import { DisposableEmailService } from '../services/disposable-email.service';
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
		OrganizationQuotaTierService,
		OrganizationSuspensionService,
		SafeWalletChainService,
		HeldFundsService,
		DisposableEmailService,
		GeoIpService,
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
		quotaTiers: OrganizationQuotaTierService,
		suspensions: OrganizationSuspensionService,
		walletChain: SafeWalletChainService,
		heldFunds: HeldFundsService,
		disposableEmails: DisposableEmailService,
		geoIp: GeoIpService
	) =>
		createAuthConfig({
			auditService,
			configService,
			disposableEmails,
			emailService,
			eventEmitter,
			geoIp,
			heldFunds,
			orm,
			organizations,
			ownership,
			personalOrganizations,
			quotaTiers,
			redis,
			suspensions,
			userService,
			walletChain,
		}),
};
