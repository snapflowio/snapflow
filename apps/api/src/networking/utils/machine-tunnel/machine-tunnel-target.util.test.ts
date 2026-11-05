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
import {
	SYSTEM_EXPOSURE_SERVICE,
	SYSTEM_EXPOSURE_TARGET_PORT,
	type SystemExposureService,
} from '../../constants/exposure.constants';
import { Exposure } from '../../entities/exposure.entity';
import { ExposureBackend } from '../../entities/exposure-backend.entity';
import { machineTunnelTargetDto } from './machine-tunnel-target.util';

function targetFor(systemService: SystemExposureService | null) {
	const exposure = Object.assign(new Exposure(), {
		systemService,
		targetReference: null,
	});
	const backend = Object.assign(new ExposureBackend(), {
		targetPort: systemService
			? SYSTEM_EXPOSURE_TARGET_PORT[systemService]
			: SYSTEM_EXPOSURE_TARGET_PORT[SYSTEM_EXPOSURE_SERVICE.TOOLBOX],
		leaseExpiresAt: new Date('2026-01-01T00:00:00.000Z'),
	});
	return machineTunnelTargetDto(backend, exposure);
}

describe('machineTunnelTargetDto', () => {
	it('relays daemon and desktop services through the authenticated guest service', () => {
		for (const service of [
			SYSTEM_EXPOSURE_SERVICE.TOOLBOX,
			SYSTEM_EXPOSURE_SERVICE.TERMINAL,
			SYSTEM_EXPOSURE_SERVICE.DESKTOP,
		]) {
			assert.equal(targetFor(service).guestService, service);
		}
	});

	it('dials user exposures and machine-side services directly', () => {
		assert.equal(targetFor(null).guestService, undefined);
		assert.equal(
			targetFor(SYSTEM_EXPOSURE_SERVICE.SSH).guestService,
			undefined
		);
	});
});
