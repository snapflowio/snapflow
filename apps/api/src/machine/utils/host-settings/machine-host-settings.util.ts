/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash } from 'node:crypto';
import { canonicalJson } from '../../../common/utils/canonical-json.util';
import { MACHINE_HOST_SETTINGS_SCHEMA_VERSION } from '../../constants/machine-host-settings.constants';
import type {
	MachineHostSettingsDocumentDto,
	MachineHostSettingsDto,
	MachineMaintenanceWindowDto,
	MachineTrafficPolicyDto,
} from '../../dto/machine-host-settings.dto';
import type { MachineHostSettings } from '../../entities/machine-host-settings.embeddable';

const DIGEST_ALGORITHM = 'sha256';
const DIGEST_ENCODING = 'hex';

function maintenanceWindow(
	columns: MachineHostSettings
): MachineMaintenanceWindowDto | null {
	const startMinuteUtc = columns.maintenanceWindowStartMinute;
	const durationMinutes = columns.maintenanceWindowDurationMinutes;
	if (startMinuteUtc === null || durationMinutes === null) return null;
	return { startMinuteUtc, durationMinutes };
}

export function machineHostSettings(
	columns: MachineHostSettings
): MachineHostSettingsDto {
	return {
		maintenanceWindow: maintenanceWindow(columns),
		offer: {
			vcpus: columns.offeredVcpus,
			memoryGiB: columns.offeredMemoryGib,
			diskGiB: columns.offeredDiskGib,
		},
		maxUnclaimedFloat: columns.maxUnclaimedFloat,
	};
}

export function applyMachineHostSettings(
	columns: MachineHostSettings,
	settings: MachineHostSettingsDto
): void {
	columns.maintenanceWindowStartMinute =
		settings.maintenanceWindow?.startMinuteUtc ?? null;
	columns.maintenanceWindowDurationMinutes =
		settings.maintenanceWindow?.durationMinutes ?? null;
	columns.offeredVcpus = settings.offer.vcpus;
	columns.offeredMemoryGib = settings.offer.memoryGiB;
	columns.offeredDiskGib = settings.offer.diskGiB;
	columns.maxUnclaimedFloat = settings.maxUnclaimedFloat;
}

export function machineHostSettingsDocument(
	columns: MachineHostSettings,
	traffic: MachineTrafficPolicyDto,
	publicAddresses: string[]
): MachineHostSettingsDocumentDto {
	const document = {
		schemaVersion: MACHINE_HOST_SETTINGS_SCHEMA_VERSION,
		...machineHostSettings(columns),
		traffic,
		publicAddresses,
	};
	return {
		digest: createHash(DIGEST_ALGORITHM)
			.update(canonicalJson(document))
			.digest(DIGEST_ENCODING),
		...document,
	};
}
