/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { LocationModule } from '../location/location.module';
import { OrganizationModule } from '../organization/organization.module';
import { SettlementChainModule } from '../settlement/settlement-chain.module';
import { SettlementFundsModule } from '../settlement/settlement-funds.module';
import { UserModule } from '../user/user.module';
import { betterAuthProvider } from './better-auth/better-auth.provider';
import { AccountDeletionController } from './controllers/account-deletion.controller';
import { ApiKeyController } from './controllers/api-key.controller';
import { OrganizationDeletionController } from './controllers/organization-deletion.controller';
import { Account } from './entities/account.entity';
import { ApiKey } from './entities/api-key.entity';
import { Passkey } from './entities/passkey.entity';
import { Session } from './entities/session.entity';
import { TwoFactor } from './entities/two-factor.entity';
import { AdministratorBootstrapService } from './services/administrator-bootstrap.service';
import { AuthAddonService } from './services/auth-addon.service';
import { DisposableEmailService } from './services/disposable-email.service';
import { HumanVerificationService } from './services/human-verification.service';
import { MachineEnrollmentKeyService } from './services/machine-enrollment-key.service';
import { OrganizationAccessService } from './services/organization-access.service';
import { OrganizationApiKeyRevocationService } from './services/organization-api-key-revocation.service';
import { OrganizationDeletionService } from './services/organization-deletion.service';

@Module({
	imports: [
		MikroOrmModule.forFeature([Account, ApiKey, Passkey, Session, TwoFactor]),
		AuditModule,
		LocationModule,
		OrganizationModule,
		SettlementChainModule,
		SettlementFundsModule,
		UserModule,
	],
	controllers: [
		AccountDeletionController,
		ApiKeyController,
		OrganizationDeletionController,
	],
	providers: [
		betterAuthProvider,
		AdministratorBootstrapService,
		AuthAddonService,
		DisposableEmailService,
		HumanVerificationService,
		MachineEnrollmentKeyService,
		OrganizationAccessService,
		OrganizationApiKeyRevocationService,
		OrganizationDeletionService,
	],
	exports: [
		AdministratorBootstrapService,
		AuthAddonService,
		DisposableEmailService,
		HumanVerificationService,
		MachineEnrollmentKeyService,
		OrganizationAccessService,
	],
})
export class AuthModule {}
