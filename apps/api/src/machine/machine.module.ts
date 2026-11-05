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
import { DockerRegistryModule } from '../docker-registry/docker-registry.module';
import { ControlWakeModule } from '../infra/control-wake/control-wake.module';
import { EncryptionModule } from '../infra/encryption/encryption.module';
import { RedisConnectionModule } from '../infra/redis/redis.module';
import { LocationModule } from '../location/location.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { SecretsModule } from '../secrets/secrets.module';
import { SettingsModule } from '../settings/settings.module';
import { AdminMachineController } from './controllers/admin-machine.controller';
import { MachineController } from './controllers/machine.controller';
import { MachineSessionController } from './controllers/machine-session.controller';
import { Machine } from './entities/machine.entity';
import { MachineAssessment } from './entities/machine-assessment.entity';
import { MachineObservation } from './entities/machine-observation.entity';
import { MachineQualificationChallenge } from './entities/machine-qualification-challenge.entity';
import { MachineQualificationEvidence } from './entities/machine-qualification-evidence.entity';
import { MachineReliabilityEvent } from './entities/machine-reliability-event.entity';
import { MachineSession } from './entities/machine-session.entity';
import { MachineSnapshotTarget } from './entities/machine-snapshot-target.entity';
import { MachineUsageReceipt } from './entities/machine-usage-receipt.entity';
import { MachineWorkloadOutcome } from './entities/machine-workload-outcome.entity';
import { DesiredSnapshotSetService } from './services/desired-state/desired-snapshot-set.service';
import { MachineDesiredStateService } from './services/desired-state/machine-desired-state.service';
import { MachineDesiredStateRevisionService } from './services/desired-state/machine-desired-state-revision.service';
import { MachineSandboxSecretsService } from './services/desired-state/machine-sandbox-secrets.service';
import { MachineSnapshotCredentialsService } from './services/desired-state/machine-snapshot-credentials.service';
import { MachineSnapshotTargetService } from './services/desired-state/machine-snapshot-target.service';
import { MachineService } from './services/machine.service';
import { MachineAdministrationService } from './services/machine-administration.service';
import { MachineConnectionCredentialService } from './services/machine-connection-credential.service';
import { MachineControlPolicyService } from './services/machine-control-policy.service';
import { MachineDecommissionService } from './services/machine-decommission.service';
import { MachineDirectoryService } from './services/machine-directory.service';
import { MachineHealthService } from './services/machine-health.service';
import { MachineJobNotificationService } from './services/machine-job-notification.service';
import { MachineLocationService } from './services/machine-location.service';
import { MachinePayoutReadinessService } from './services/machine-payout-readiness.service';
import { MachinePlatformObservationService } from './services/machine-platform-observation.service';
import { MachineProofService } from './services/machine-proof.service';
import { MachineRegistrationService } from './services/machine-registration.service';
import { MachineSessionService } from './services/machine-session.service';
import { MachineTrustService } from './services/machine-trust.service';
import { MachineUsageService } from './services/machine-usage.service';
import { MachineAssessmentService } from './services/qualification/machine-assessment.service';
import { MachineQualificationService } from './services/qualification/machine-qualification.service';
import { MachineQualificationAppraisalService } from './services/qualification/machine-qualification-appraisal.service';
import { MachineReassessmentService } from './services/qualification/machine-reassessment.service';
import { MachineReliabilityService } from './services/qualification/machine-reliability.service';
import { MachineReliabilityRetentionService } from './services/qualification/machine-reliability-retention.service';

@Module({
	imports: [
		MikroOrmModule.forFeature([
			Machine,
			MachineAssessment,
			MachineObservation,
			MachineQualificationChallenge,
			MachineQualificationEvidence,
			MachineReliabilityEvent,
			MachineSession,
			MachineSnapshotTarget,
			MachineUsageReceipt,
			MachineWorkloadOutcome,
		]),
		BillingModule,
		ControlWakeModule,
		DockerRegistryModule,
		EncryptionModule,
		MarketplaceModule,
		RedisConnectionModule,
		LocationModule,
		SecretsModule,
		SettingsModule,
	],
	controllers: [
		MachineController,
		MachineSessionController,
		AdminMachineController,
	],
	providers: [
		DesiredSnapshotSetService,
		MachineAdministrationService,
		MachineAssessmentService,
		MachineConnectionCredentialService,
		MachineControlPolicyService,
		MachineDecommissionService,
		MachineDesiredStateRevisionService,
		MachineDesiredStateService,
		MachineHealthService,
		MachineJobNotificationService,
		MachineDirectoryService,
		MachinePayoutReadinessService,
		MachinePlatformObservationService,
		MachineProofService,
		MachineQualificationAppraisalService,
		MachineQualificationService,
		MachineReassessmentService,
		MachineRegistrationService,
		MachineLocationService,
		MachineReliabilityRetentionService,
		MachineReliabilityService,
		MachineSandboxSecretsService,
		MachineService,
		MachineSessionService,
		MachineSnapshotCredentialsService,
		MachineSnapshotTargetService,
		MachineTrustService,
		MachineUsageService,
	],
	exports: [
		MachineAdministrationService,
		MachineAssessmentService,
		MachineControlPolicyService,
		MachineDecommissionService,
		MachineDesiredStateRevisionService,
		MachineDesiredStateService,
		MachineHealthService,
		MachineJobNotificationService,
		MachineDirectoryService,
		MachinePlatformObservationService,
		MachineQualificationAppraisalService,
		MachineQualificationService,
		MachineReassessmentService,
		MachineRegistrationService,
		MachineReliabilityRetentionService,
		MachineReliabilityService,
		MachineSandboxSecretsService,
		MachineService,
		MachineSessionService,
		MachineSnapshotCredentialsService,
		MachineSnapshotTargetService,
		MachineUsageService,
	],
})
export class MachineModule {}
