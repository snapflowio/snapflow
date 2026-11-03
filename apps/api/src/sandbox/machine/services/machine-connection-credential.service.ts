/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import { DeterministicHmacService } from '../../../infra/encryption/services/deterministic-hmac.service';
import { MACHINE_CONNECTION_TOKEN_DOMAIN } from '../constants/machine-connection.constants';

@Injectable()
export class MachineConnectionCredentialService {
	constructor(private readonly hmac: DeterministicHmacService) {}

	token(machineId: string, sessionGeneration: number): string {
		return this.hmac.derive(
			MACHINE_CONNECTION_TOKEN_DOMAIN,
			`${machineId}:${sessionGeneration}`
		);
	}
}
