/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const MUTATION_POLICY = {
	REQUIRES_IDEMPOTENCY: 'requires_idempotency',
	NATURALLY_IDEMPOTENT: 'naturally_idempotent',
	CONCURRENCY_ONLY: 'concurrency_only',
	INTERNAL_PROTOCOL: 'internal_protocol',
	READ_ONLY: 'read_only',
} as const;
export type MutationPolicy =
	(typeof MUTATION_POLICY)[keyof typeof MUTATION_POLICY];

const REQUIRES_IDEMPOTENCY = [
	'AdminDockerRegistryController.create',
	'AdminOrganizationController.grantCredit',
	'CustomDomainController.create',
	'DockerRegistryController.create',
	'ExposureController.create',
	'ExposureController.createAccessGrant',
	'ExposureController.requestSystemExposure',
	'SandboxCaptureController.createBackup',
	'SandboxController.createSandbox',
	'HostMachineController.createMachinePriceCard',
	'SandboxCaptureController.createSandboxSnapshot',
	'SandboxForkController.forkSandbox',
	'SnapshotController.createSnapshot',
	'SshAccessController.create',
	'SecretController.create',
	'SecretController.createVersion',
	'SecretController.replaceSandboxBindings',
	'VolumeController.createVolume',
	'VolumeController.restoreVolume',
] as const;

const NATURALLY_IDEMPOTENT = [
	'AdminDockerRegistryController.delete',
	'AdminOrganizationController.createQuota',
	'AdminOrganizationController.deleteQuota',
	'AdminOrganizationController.suspend',
	'AdminOrganizationController.unsuspend',
	'AdminOrganizationController.updateLimits',
	'AdminOrganizationController.updateQuota',
	'AdminDockerRegistryController.update',
	'AdminSettingsController.setDrainingPolicy',
	'AdminSettingsController.setMaintenanceMode',
	'AdminMachineController.updateDrainingStatus',
	'AdminVerificationController.updateAdminMachineTier',
	'AdminSandboxController.recoverSandbox',
	'AdminSnapshotController.setSnapshotGeneralStatus',
	'AdminMachineController.delete',
	'AdminMachineController.updateSchedulingStatus',
	'CustomDomainController.remove',
	'DockerRegistryController.remove',
	'DockerRegistryController.update',
	'ExposureController.ensurePreviewExposure',
	'ExposureController.remove',
	'ExposureController.revokeAccessGrant',
	'ExposureController.update',
	'OrganizationDeletionController.deleteActiveOrganization',
	'DevelopmentMachineController.enroll',
	'MachineController.delete',
	'MachineController.register',
	'MachineController.revokeIdentity',
	'MachineController.updateDrainingStatus',
	'MachineController.updateSchedulingStatus',
	'AdminMarketPriceController.updateMarketReferencePrice',
	'SandboxPlacementController.acceptSandboxLeaseRenewal',
	'SandboxPlacementController.moveSandbox',
	'SandboxLifecycleController.archiveSandbox',
	'SandboxLifecycleController.deleteSandbox',
	'SandboxRuntimeController.pauseSandbox',
	'SandboxLifecycleController.recoverSandbox',
	'SandboxSettingsController.replaceLabels',
	'SandboxRuntimeController.resizeSandbox',
	'SandboxSettingsController.revokeSshAccess',
	'SandboxSettingsController.setAutoArchiveInterval',
	'SandboxSettingsController.setAutoDeleteInterval',
	'SandboxSettingsController.setAutostopInterval',
	'SandboxLifecycleController.startSandbox',
	'SandboxLifecycleController.stopSandbox',
	'SandboxRuntimeController.updateNetworkSettings',
	'OrganizationSettingsController.updateSettings',
	'PaymentWalletController.createChallenge',
	'PaymentWalletController.link',
	'PaymentWalletController.unlink',
	'PaymentChannelController.submitVoucher',
	'SnapshotController.activateSnapshot',
	'SnapshotController.deactivateSnapshot',
	'SnapshotController.removeSnapshot',
	'VolumeController.deleteVolume',
	'VolumeController.resizeVolume',
] as const;

const CONCURRENCY_ONLY = [
	'AdminSettingsController.update',
	'AdminVerificationController.resolveVerificationReview',
	'ApiKeyController.create',
	'BillingController.updateBudget',
	'HostMachineController.updateMachineListing',
	'HostVerificationController.requestMachineBenchmark',
	'SecretController.update',
	'SecretController.revokeVersion',
	'SecretController.delete',
] as const;

const INTERNAL_PROTOCOL = [
	'AdminEdgeController.create',
	'AdminEdgeController.reissueEnrollmentSecret',
	'AdminEdgeController.remove',
	'AdminEdgeController.updateStatus',
	'AdminExposureCutoverController.begin',
	'AdminExposureCutoverController.rollback',
	'AdminExposureCutoverController.verify',
	'CloudflareWebhookController.accept',
	'EdgeHeartbeatController.record',
	'EdgeIdentityController.completeEnrollment',
	'EdgeIdentityController.createSession',
	'EdgeIdentityController.renewSession',
	'EdgeProtectedAccessController.redeem',
	'EdgeUsageController.ingest',
	'EdgeUsageController.openEpoch',
	'JobController.renewJobLease',
	'JobController.updateJobStatus',
	'MachineSelfController.healthcheck',
	'MachineSelfController.reportUpdateStatus',
	'MachineSelfController.requestUpdateDrain',
	'MachineSelfController.submitUsageReceipt',
	'MachineSandboxControlController.reportObservedStatus',
	'MachineSnapshotControlController.reportInventory',
	'MachineSessionController.close',
	'MachineSessionController.create',
	'MachineSessionController.renew',
	'MachineSessionController.status',
	'MachineTunnelController.acknowledge',
	'MachineTunnelController.acknowledgeTargetPlan',
	'MachineTunnelController.issueCertificate',
	'SandboxSettingsController.updateLastActivity',
	'SshRelayController.resolve',
] as const;

const READ_ONLY = ['SandboxController.quoteSandbox'] as const;

const ENTRIES = [
	...REQUIRES_IDEMPOTENCY.map(
		(name) => [name, MUTATION_POLICY.REQUIRES_IDEMPOTENCY] as const
	),
	...NATURALLY_IDEMPOTENT.map(
		(name) => [name, MUTATION_POLICY.NATURALLY_IDEMPOTENT] as const
	),
	...CONCURRENCY_ONLY.map(
		(name) => [name, MUTATION_POLICY.CONCURRENCY_ONLY] as const
	),
	...INTERNAL_PROTOCOL.map(
		(name) => [name, MUTATION_POLICY.INTERNAL_PROTOCOL] as const
	),
	...READ_ONLY.map((name) => [name, MUTATION_POLICY.READ_ONLY] as const),
] as const;

export const MUTATION_POLICY_REGISTRY: ReadonlyMap<string, MutationPolicy> =
	new Map(ENTRIES);

export const MUTATION_POLICY_ENTRY_COUNT = ENTRIES.length;

export function mutationPolicyFor(
	controllerName: string,
	handlerName: string
): MutationPolicy | undefined {
	return MUTATION_POLICY_REGISTRY.get(`${controllerName}.${handlerName}`);
}
