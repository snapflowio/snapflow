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
import { BillingModule } from '../billing/billing.module';
import { CloudflareModule } from '../cloudflare/cloudflare.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { ControlWakeModule } from '../infra/control-wake/control-wake.module';
import { RedisConnectionModule } from '../infra/redis/redis.module';
import { MachineModule } from '../machine/machine.module';
import { NetworkUsageModule } from '../network-usage/network-usage.module';
import { SandboxModule } from '../sandbox/sandbox.module';
import { SettingsModule } from '../settings/settings.module';
import { AdminEdgeController } from './controllers/admin-edge.controller';
import { AdminExposureCutoverController } from './controllers/admin-exposure-cutover.controller';
import { EdgeHeartbeatController } from './controllers/edge-heartbeat.controller';
import { EdgeIdentityController } from './controllers/edge-identity.controller';
import { EdgeProtectedAccessController } from './controllers/edge-protected-access.controller';
import { EdgeRouteController } from './controllers/edge-route.controller';
import { EdgeUsageController } from './controllers/edge-usage.controller';
import { ExposureController } from './controllers/exposure.controller';
import { MachineTunnelController } from './controllers/machine-tunnel.controller';
import { SshAccessController } from './controllers/ssh-access.controller';
import { SshRelayController } from './controllers/ssh-relay.controller';
import { CustomDomain } from './entities/custom-domain.entity';
import { Edge } from './entities/edge.entity';
import { EdgeSession } from './entities/edge-session.entity';
import { EdgeUsageCheckpoint } from './entities/edge-usage-checkpoint.entity';
import { Exposure } from './entities/exposure.entity';
import { ExposureBackend } from './entities/exposure-backend.entity';
import { ExposureReconciliation } from './entities/exposure-reconciliation.entity';
import { MachineEdgeBinding } from './entities/machine-edge-binding.entity';
import { ControlSnapshotRefreshService } from './services/control-snapshot-refresh.service';
import { EdgeService } from './services/edge/edge.service';
import { EdgeActivityService } from './services/edge/edge-activity.service';
import { EdgeEnrollmentService } from './services/edge/edge-enrollment.service';
import { EdgeHeartbeatService } from './services/edge/edge-heartbeat.service';
import { EdgeListenerAllocationService } from './services/edge/edge-listener-allocation.service';
import { EdgePlacementService } from './services/edge/edge-placement.service';
import { EdgeRouteSnapshotService } from './services/edge/edge-route-snapshot.service';
import { EdgeSessionService } from './services/edge/edge-session.service';
import { EdgeSettingsRefreshService } from './services/edge/edge-settings-refresh.service';
import { EdgeUsageService } from './services/edge/edge-usage.service';
import { ExposureService } from './services/exposure/exposure.service';
import { ExposureActivationService } from './services/exposure/exposure-activation.service';
import { ExposureCutoverService } from './services/exposure/exposure-cutover.service';
import { ExposureDeactivationService } from './services/exposure/exposure-deactivation.service';
import { ExposureDnsReconcilerService } from './services/exposure/exposure-dns-reconciler.service';
import { ExposureManagedDnsService } from './services/exposure/exposure-managed-dns.service';
import { ExposureMaterializationLockService } from './services/exposure/exposure-materialization-lock.service';
import { ExposureMaterializerService } from './services/exposure/exposure-materializer.service';
import { ExposureProvisioningService } from './services/exposure/exposure-provisioning.service';
import { ExposureReconciliationQueueService } from './services/exposure/exposure-reconciliation-queue.service';
import { ExposureReconciliationWorkerService } from './services/exposure/exposure-reconciliation-worker.service';
import { SystemExposureLeaseService } from './services/exposure/system-exposure-lease.service';
import { SystemExposureProvisionerService } from './services/exposure/system-exposure-provisioner.service';
import { MachineBindingTargetService } from './services/machine-tunnel/machine-binding-target.service';
import { MachineEdgeBindingFenceService } from './services/machine-tunnel/machine-edge-binding-fence.service';
import { MachineTunnelCertificateService } from './services/machine-tunnel/machine-tunnel-certificate.service';
import { MachineTunnelObservationService } from './services/machine-tunnel/machine-tunnel-observation.service';
import { MachineTunnelPlanService } from './services/machine-tunnel/machine-tunnel-plan.service';
import { VaultTunnelCertificateSigner } from './services/machine-tunnel/vault-tunnel-certificate-signer.service';
import { NetworkControlVersionService } from './services/network-control-version.service';
import { ProtectedAccessGrantService } from './services/protected-access/protected-access-grant.service';
import { ProtectedAccessSessionService } from './services/protected-access/protected-access-session.service';
import { ProtectedAccessSessionStandingService } from './services/protected-access/protected-access-session-standing.service';
import { SandboxNetworkLifecycleService } from './services/sandbox-network-lifecycle.service';
import { SshRelayService } from './services/ssh-relay.service';
import { TUNNEL_CERTIFICATE_SIGNER } from './types/tunnel-certificate-signer.types';

const NETWORKING_ENTITIES = [
	Edge,
	EdgeSession,
	Exposure,
	ExposureBackend,
	MachineEdgeBinding,
	CustomDomain,
	EdgeUsageCheckpoint,
	ExposureReconciliation,
];

@Module({
	imports: [
		MikroOrmModule.forFeature(NETWORKING_ENTITIES),
		AuthModule,
		BillingModule,
		ControlWakeModule,
		IdempotencyModule,
		RedisConnectionModule,
		SandboxModule,
		MachineModule,
		CloudflareModule,
		NetworkUsageModule,
		SettingsModule,
	],
	controllers: [
		AdminEdgeController,
		AdminExposureCutoverController,
		EdgeIdentityController,
		EdgeHeartbeatController,
		EdgeRouteController,
		EdgeUsageController,
		EdgeProtectedAccessController,
		ExposureController,
		MachineTunnelController,
		SshAccessController,
		SshRelayController,
	],
	providers: [
		EdgeActivityService,
		EdgeService,
		EdgeEnrollmentService,
		EdgeHeartbeatService,
		EdgeSessionService,
		EdgeRouteSnapshotService,
		EdgeSettingsRefreshService,
		ExposureService,
		EdgeUsageService,
		EdgePlacementService,
		EdgeListenerAllocationService,
		NetworkControlVersionService,
		ExposureActivationService,
		ExposureCutoverService,
		ExposureDeactivationService,
		ExposureDnsReconcilerService,
		ExposureManagedDnsService,
		ExposureMaterializationLockService,
		ExposureMaterializerService,
		ExposureProvisioningService,
		ExposureReconciliationQueueService,
		ExposureReconciliationWorkerService,
		ProtectedAccessGrantService,
		ProtectedAccessSessionService,
		ProtectedAccessSessionStandingService,
		MachineBindingTargetService,
		MachineEdgeBindingFenceService,
		MachineTunnelPlanService,
		SandboxNetworkLifecycleService,
		SystemExposureProvisionerService,
		SystemExposureLeaseService,
		SshRelayService,
		ControlSnapshotRefreshService,
		MachineTunnelObservationService,
		MachineTunnelCertificateService,
		VaultTunnelCertificateSigner,
		{
			provide: TUNNEL_CERTIFICATE_SIGNER,
			useExisting: VaultTunnelCertificateSigner,
		},
	],
	exports: [
		EdgeService,
		EdgeSessionService,
		SystemExposureLeaseService,
		ProtectedAccessGrantService,
		ControlSnapshotRefreshService,
		ExposureDnsReconcilerService,
		ExposureReconciliationQueueService,
		ExposureReconciliationWorkerService,
		SystemExposureProvisionerService,
	],
})
export class NetworkingModule {}
