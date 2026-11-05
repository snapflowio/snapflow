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
import { BillingModule } from '../billing/billing.module';
import { EncryptionModule } from '../infra/encryption/encryption.module';
import { RedisConnectionModule } from '../infra/redis/redis.module';
import { MachineJobModule } from '../machine-job/machine-job.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { NetworkingModule } from '../networking/networking.module';
import { SandboxModule } from '../sandbox/sandbox.module';
import { SettingsModule } from '../settings/settings.module';
import { SettlementModule } from '../settlement/settlement.module';
import { AdminVerificationController } from './controllers/admin-verification.controller';
import { EdgeSpeedtestController } from './controllers/edge-speedtest.controller';
import { HostVerificationController } from './controllers/host-verification.controller';
import { MachineBenchmark } from './entities/machine-benchmark.entity';
import { MachineFingerprintComponent } from './entities/machine-fingerprint-component.entity';
import { MachineSpotCheck } from './entities/machine-spot-check.entity';
import { VerificationReview } from './entities/verification-review.entity';
import { BenchmarkAppraisalService } from './services/benchmark-appraisal.service';
import { BenchmarkReleaseService } from './services/benchmark-release.service';
import { FingerprintService } from './services/fingerprint.service';
import { MachineBenchmarkService } from './services/machine-benchmark.service';
import { MachineTierService } from './services/machine-tier.service';
import { NetworkMeterAuditService } from './services/network-meter-audit.service';
import { SpeedtestReceiptService } from './services/speedtest-receipt.service';
import { SpeedtestTokenService } from './services/speedtest-token.service';
import { SpotCheckCanaryService } from './services/spot-check-canary.service';
import { SpotCheckCompletionService } from './services/spot-check-completion.service';
import { SpotCheckExecutorService } from './services/spot-check-executor.service';
import { SpotCheckFailureService } from './services/spot-check-failure.service';
import { SpotCheckLaunchService } from './services/spot-check-launch.service';
import { SpotCheckRunService } from './services/spot-check-run.service';
import { SpotCheckSchedulerService } from './services/spot-check-scheduler.service';
import { SpotCheckToolboxService } from './services/spot-check-toolbox.service';
import { VerificationReviewService } from './services/verification-review.service';

@Module({
	imports: [
		MikroOrmModule.forFeature([
			MachineBenchmark,
			MachineFingerprintComponent,
			MachineSpotCheck,
			VerificationReview,
		]),
		BillingModule,
		EncryptionModule,
		MachineJobModule,
		MarketplaceModule,
		NetworkingModule,
		RedisConnectionModule,
		SandboxModule,
		SettingsModule,
		SettlementModule,
	],
	controllers: [
		AdminVerificationController,
		EdgeSpeedtestController,
		HostVerificationController,
	],
	providers: [
		BenchmarkAppraisalService,
		BenchmarkReleaseService,
		FingerprintService,
		MachineBenchmarkService,
		MachineTierService,
		SpeedtestReceiptService,
		SpeedtestTokenService,
		SpotCheckCanaryService,
		NetworkMeterAuditService,
		SpotCheckCompletionService,
		SpotCheckLaunchService,
		SpotCheckRunService,
		SpotCheckExecutorService,
		SpotCheckFailureService,
		SpotCheckSchedulerService,
		SpotCheckToolboxService,
		VerificationReviewService,
	],
	exports: [
		MachineBenchmarkService,
		MachineTierService,
		BenchmarkAppraisalService,
		SpotCheckExecutorService,
		SpotCheckSchedulerService,
		NetworkMeterAuditService,
	],
})
export class VerificationModule {}
