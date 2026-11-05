/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MILLISECONDS_PER_HOUR } from '../../../common/constants/time.constants';
import { MACHINE_QUALIFICATION_POLICY } from '../../constants/machine-qualification.constants';
import { Machine } from '../../entities/machine.entity';
import type { MachineRuntimeCapabilities } from '../../types/machine-runtime.types';
import {
	machineQualificationExpiresAt,
	machineQualificationInputFingerprint,
	machineQualificationRenewalDue,
} from './machine-qualification.util';

const COMPLETED_AT = new Date('2026-10-01T00:00:00.000Z');
const RENEWAL_STARTS_AT = new Date(
	COMPLETED_AT.getTime() +
		(MACHINE_QUALIFICATION_POLICY.QUALIFICATION_TTL_HOURS -
			MACHINE_QUALIFICATION_POLICY.RENEWAL_LEAD_HOURS) *
			MILLISECONDS_PER_HOUR
);

const CAPABILITIES = {
	kvmAvailable: true,
	cgroupV2Available: true,
	firecrackerSnapshotAvailable: true,
	firecrackerTemplateAvailable: true,
	hypervisors: [],
	machineReleaseVersion: '1.0.0',
	machineReleaseDigest: `sha256:${'a'.repeat(64)}`,
	controlProtocolVersion: 1,
	machineIdentity: 'machine',
	firecrackerIdentity: 'firecracker',
	cloudHypervisorIdentity: 'cloud-hypervisor',
	guestPlatforms: ['linux/amd64'],
	preparedImageDigests: [],
	preparedTemplateKeys: [],
	platformArtifacts: [],
	features: [],
	builderImage: 'builder',
} satisfies MachineRuntimeCapabilities;

function machineWith(capabilities: MachineRuntimeCapabilities): Machine {
	return Object.assign(new Machine(), {
		id: 'machine-1',
		identityKeyId: 'ed25519:key',
		runtimeCapabilities: capabilities,
	});
}

describe('machine qualification fingerprint', () => {
	it('ignores the installed release so updates keep the machine qualified', () => {
		assert.equal(
			machineQualificationInputFingerprint(
				machineWith({
					...CAPABILITIES,
					machineReleaseVersion: '2.0.0',
					machineReleaseDigest: `sha256:${'b'.repeat(64)}`,
					firecrackerIdentity: 'firecracker-next',
				})
			),
			machineQualificationInputFingerprint(machineWith(CAPABILITIES))
		);
	});

	it('changes when the host environment changes', () => {
		assert.notEqual(
			machineQualificationInputFingerprint(
				machineWith({ ...CAPABILITIES, kvmAvailable: false })
			),
			machineQualificationInputFingerprint(machineWith(CAPABILITIES))
		);
	});
});

describe('machine qualification renewal', () => {
	it('expires a qualification after its lifetime', () => {
		assert.equal(
			machineQualificationExpiresAt(COMPLETED_AT).getTime() -
				COMPLETED_AT.getTime(),
			MACHINE_QUALIFICATION_POLICY.QUALIFICATION_TTL_HOURS *
				MILLISECONDS_PER_HOUR
		);
	});

	it('renews only inside the lead window before expiry', () => {
		assert.equal(
			machineQualificationRenewalDue(
				COMPLETED_AT,
				new Date(RENEWAL_STARTS_AT.getTime() - 1)
			),
			false
		);
		assert.equal(
			machineQualificationRenewalDue(COMPLETED_AT, RENEWAL_STARTS_AT),
			true
		);
	});
});
