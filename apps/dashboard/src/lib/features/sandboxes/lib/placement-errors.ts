/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	ApiErrorCode,
	type AutomaticPaymentsRequiredError,
	type BillingRestrictedError,
	BillingRestriction,
	type MachineUnavailableError,
	type PriceAboveMaximumError,
	type PriceChangedError,
	SandboxPlacementErrorCode,
} from '@snapflow/api-client';
import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';

export const BILLING_RESTRICTED_KIND = 'billing_restricted';

interface PlacementErrorBodies {
	[SandboxPlacementErrorCode.MachineUnavailable]: MachineUnavailableError;
	[SandboxPlacementErrorCode.PriceChanged]: PriceChangedError;
	[SandboxPlacementErrorCode.PriceAboveMaximum]: PriceAboveMaximumError;
}

type SandboxPlacementError = {
	[Code in SandboxPlacementErrorCode]: {
		kind: Code;
	} & PlacementErrorBodies[Code];
}[SandboxPlacementErrorCode];

export type PlacementError =
	| SandboxPlacementError
	| ({ kind: typeof BILLING_RESTRICTED_KIND } & BillingRestrictedError)
	| ({
			kind: typeof ApiErrorCode.AutomaticPaymentsRequired;
	  } & AutomaticPaymentsRequiredError);

const BILLING_RESTRICTION_CODES: ReadonlySet<unknown> = new Set(
	Object.values(BillingRestriction)
);

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

function isBillingRestricted(
	details: unknown
): details is BillingRestrictedError {
	return (
		typeof details === 'object' &&
		details !== null &&
		'code' in details &&
		BILLING_RESTRICTION_CODES.has(details.code)
	);
}

function isAutomaticPaymentsRequired(
	details: unknown
): details is AutomaticPaymentsRequiredError {
	return (
		typeof details === 'object' &&
		details !== null &&
		'code' in details &&
		details.code === ApiErrorCode.AutomaticPaymentsRequired
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
	if (hasPlacementCode(details, SandboxPlacementErrorCode.PriceAboveMaximum)) {
		return { kind: SandboxPlacementErrorCode.PriceAboveMaximum, ...details };
	}
	if (isBillingRestricted(details)) {
		return { kind: BILLING_RESTRICTED_KIND, ...details };
	}
	if (isAutomaticPaymentsRequired(details)) {
		return { kind: ApiErrorCode.AutomaticPaymentsRequired, ...details };
	}
	return null;
}
