/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type LeaseRenewalRequiredError,
	type MachineUnavailableError,
	type PriceChangedError,
	SandboxPlacementErrorCode,
} from '@snapflow/api-client';
import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';

interface PlacementErrorBodies {
	[SandboxPlacementErrorCode.MachineUnavailable]: MachineUnavailableError;
	[SandboxPlacementErrorCode.PriceChanged]: PriceChangedError;
	[SandboxPlacementErrorCode.LeaseRenewalRequired]: LeaseRenewalRequiredError;
}

export type PlacementError = {
	[Code in SandboxPlacementErrorCode]: {
		kind: Code;
	} & PlacementErrorBodies[Code];
}[SandboxPlacementErrorCode];

function hasPlacementCode<Code extends SandboxPlacementErrorCode>(
	details: unknown,
	code: Code
): details is PlacementErrorBodies[Code] {
	return (
		typeof details === 'object' &&
		details !== null &&
		'code' in details &&
		details.code === code
	);
}

export function placementError(error: unknown): PlacementError | null {
	const { details } = SnapflowError.fromUnknown(error);
	if (hasPlacementCode(details, SandboxPlacementErrorCode.MachineUnavailable)) {
		return { kind: SandboxPlacementErrorCode.MachineUnavailable, ...details };
	}
	if (hasPlacementCode(details, SandboxPlacementErrorCode.PriceChanged)) {
		return { kind: SandboxPlacementErrorCode.PriceChanged, ...details };
	}
	if (
		hasPlacementCode(details, SandboxPlacementErrorCode.LeaseRenewalRequired)
	) {
		return { kind: SandboxPlacementErrorCode.LeaseRenewalRequired, ...details };
	}
	return null;
}
