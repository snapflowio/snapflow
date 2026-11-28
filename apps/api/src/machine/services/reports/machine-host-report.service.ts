/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import type {
	MachineDiagnosticsDto,
	MachineLocalBenchmarkDto,
	MachinePaymentHoldsDto,
} from '../../dto/machine-host-report.dto';
import { Machine } from '../../entities/machine.entity';
import type { MachineHostReport } from '../../entities/machine-host-report.embeddable';

@Injectable()
export class MachineHostReportService {
	constructor(private readonly entityManager: EntityManager) {}

	recordDiagnostics(
		machineId: string,
		diagnostics: MachineDiagnosticsDto
	): Promise<void> {
		return this.record(machineId, { diagnostics });
	}

	recordPaymentHolds(
		machineId: string,
		paymentHolds: MachinePaymentHoldsDto
	): Promise<void> {
		return this.record(machineId, { paymentHolds });
	}

	recordLocalBenchmark(
		machineId: string,
		localBenchmark: MachineLocalBenchmarkDto
	): Promise<void> {
		return this.record(machineId, { localBenchmark });
	}

	private async record(
		machineId: string,
		report: Partial<MachineHostReport>
	): Promise<void> {
		const manager = this.entityManager.fork();
		const machine = await manager.findOneOrFail(
			Machine,
			{ id: machineId },
			{ fields: ['hostReport'] }
		);
		Object.assign(machine.hostReport, report);
		await manager.flush();
	}
}
