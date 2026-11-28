/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Embeddable, Property } from '@mikro-orm/decorators/legacy';
import type {
	MachineDiagnosticsDto,
	MachineLocalBenchmarkDto,
	MachinePaymentHoldsDto,
} from '../dto/machine-host-report.dto';
import { MACHINE_OPTIONAL_JSON_COLUMN } from './machine.columns';

@Embeddable()
export class MachineHostReport {
	@Property({ ...MACHINE_OPTIONAL_JSON_COLUMN, fieldName: 'diagnostics' })
	diagnostics: MachineDiagnosticsDto | null = null;

	@Property({ ...MACHINE_OPTIONAL_JSON_COLUMN, fieldName: 'paymentHolds' })
	paymentHolds: MachinePaymentHoldsDto | null = null;

	@Property({ ...MACHINE_OPTIONAL_JSON_COLUMN, fieldName: 'localBenchmark' })
	localBenchmark: MachineLocalBenchmarkDto | null = null;
}
