/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { EntityManager } from '@mikro-orm/postgresql';
import { fakeInstance } from '../../common/testing/instance.fake';
import { MachineUnavailableReason } from '../../marketplace/enums/machine-unavailable-reason.enum';
import { LeaseTermsUnavailableError } from '../../marketplace/exceptions/lease-terms-unavailable.exception';
import type { SandboxPlacementAlternativeDto } from '../../sandbox/dto/sandbox-quote.dto';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import { SandboxMode } from '../../sandbox/enums/sandbox-mode.enum';
import { SandboxPlacementErrorCode } from '../../sandbox/enums/sandbox-placement-error-code.enum';
import { MachineUnavailableException } from '../exceptions/machine-unavailable.exception';
import { MachineAvailabilityService } from './machine-availability.service';

const MACHINE_ID = '00000000-0000-4000-8000-000000000001';
const ALTERNATIVE: SandboxPlacementAlternativeDto = {
	machineId: '00000000-0000-4000-8000-000000000002',
	location: null,
	hourlyPriceMicroUsd: '1000',
	reliabilityBasisPoints: 9_900,
};

describe('MachineAvailabilityService.leaseUnavailable', () => {
	it('turns unavailable lease terms into machine_unavailable with alternatives', async () => {
		const availability = fakeInstance(MachineAvailabilityService);
		const alternatives = mock.method(availability, 'alternatives', async () => [
			ALTERNATIVE,
		]);
		const sandbox = Object.assign(new Sandbox({}), {
			organizationId: 'organization',
			sandboxClass: SandboxClass.LINUX_VM,
			mode: SandboxMode.STANDARD,
			capabilities: [],
			snapshot: null,
		});

		const error = await availability.leaseUnavailable(
			fakeInstance(EntityManager),
			sandbox,
			new LeaseTermsUnavailableError(
				MACHINE_ID,
				MachineUnavailableReason.PAUSED
			)
		);

		assert.ok(error instanceof MachineUnavailableException);
		assert.equal(error.reason, MachineUnavailableReason.PAUSED);
		assert.deepEqual(error.getResponse(), {
			code: SandboxPlacementErrorCode.MACHINE_UNAVAILABLE,
			message: 'The pinned machine cannot take this sandbox now',
			machineId: MACHINE_ID,
			reason: MachineUnavailableReason.PAUSED,
			alternatives: [ALTERNATIVE],
		});
		assert.equal(alternatives.mock.calls[0]?.arguments[2], MACHINE_ID);
	});
});
