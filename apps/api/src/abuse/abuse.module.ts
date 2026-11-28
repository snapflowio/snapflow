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
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../infra/email/email.module';
import { RedisConnectionModule } from '../infra/redis/redis.module';
import { MachineModule } from '../machine/machine.module';
import { NetworkingModule } from '../networking/networking.module';
import { OrganizationModule } from '../organization/organization.module';
import { SandboxModule } from '../sandbox/sandbox.module';
import { SettingsModule } from '../settings/settings.module';
import { AbuseAppealController } from './controllers/abuse-appeal.controller';
import { AbuseReportController } from './controllers/abuse-report.controller';
import { AdminAbuseCaseController } from './controllers/admin-abuse-case.controller';
import { AdminAbuseReportController } from './controllers/admin-abuse-report.controller';
import { HostIspComplaintController } from './controllers/host-isp-complaint.controller';
import { MachineAbuseReportController } from './controllers/machine-abuse-report.controller';
import { SignedInAbuseReportController } from './controllers/signed-in-abuse-report.controller';
import { AbuseCase } from './entities/abuse-case.entity';
import { AbuseCaseActionRecord } from './entities/abuse-case-action.entity';
import { AbuseEvidence } from './entities/abuse-evidence.entity';
import { AbuseHostname } from './entities/abuse-hostname.entity';
import { AbuseReport } from './entities/abuse-report.entity';
import { MachineConnectionCoverage } from './entities/machine-connection-coverage.entity';
import { MachinePublicAddress } from './entities/machine-public-address.entity';
import { SandboxConnectionRecord } from './entities/sandbox-connection-record.entity';
import { AbuseAppealService } from './services/abuse-appeal.service';
import { AbuseCaseService } from './services/abuse-case.service';
import { AbuseCaseActionService } from './services/abuse-case-action.service';
import { AbuseCounterNoticeService } from './services/abuse-counter-notice.service';
import { AbuseEvidenceService } from './services/abuse-evidence.service';
import { AbuseIntakeService } from './services/abuse-intake.service';
import { AbuseLadderService } from './services/abuse-ladder.service';
import { AbuseReportService } from './services/abuse-report.service';
import { AbuseReportReviewService } from './services/abuse-report-review.service';
import { IspComplaintService } from './services/isp-complaint.service';

@Module({
	imports: [
		MikroOrmModule.forFeature([
			AbuseCase,
			AbuseCaseActionRecord,
			AbuseEvidence,
			AbuseHostname,
			AbuseReport,
			MachineConnectionCoverage,
			MachinePublicAddress,
			SandboxConnectionRecord,
		]),
		AuthModule,
		EmailModule,
		MachineModule,
		NetworkingModule,
		OrganizationModule,
		RedisConnectionModule,
		SandboxModule,
		SettingsModule,
	],
	controllers: [
		AbuseAppealController,
		AbuseReportController,
		AdminAbuseCaseController,
		AdminAbuseReportController,
		HostIspComplaintController,
		MachineAbuseReportController,
		SignedInAbuseReportController,
	],
	providers: [
		AbuseAppealService,
		AbuseCaseActionService,
		AbuseCaseService,
		AbuseCounterNoticeService,
		AbuseEvidenceService,
		AbuseIntakeService,
		AbuseLadderService,
		AbuseReportReviewService,
		AbuseReportService,
		IspComplaintService,
	],
	exports: [AbuseCaseService, AbuseCounterNoticeService],
})
export class AbuseModule {}
