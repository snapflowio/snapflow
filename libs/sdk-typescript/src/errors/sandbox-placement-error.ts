/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
	type Location,
	MachineUnavailableReason,
	PlacementKind,
	type SandboxPlacementAlternative,
	type SandboxQuote,
} from '@snapflow/api-client';
import { isRecord, optionalString } from '../utils/record.js';
import {
	type ResponseHeaders,
	SnapflowConflictError,
} from './snapflow-error.js';

export const SandboxPlacementErrorCode = {
	MachineUnavailable: 'machine_unavailable',
	PriceChanged: 'price_changed',
	LeaseRenewalRequired: 'lease_renewal_required',
} as const;

export type SandboxPlacementErrorCode =
	(typeof SandboxPlacementErrorCode)[keyof typeof SandboxPlacementErrorCode];

export class SnapflowMachineUnavailableError extends SnapflowConflictError {
	public readonly machineId?: string;
	public readonly reason?: MachineUnavailableReason;
	public readonly alternatives: SandboxPlacementAlternative[];

	constructor(
		message: string,
		details: Pick<
			SnapflowMachineUnavailableError,
			'machineId' | 'reason' | 'alternatives'
		>,
		statusCode?: number,
		headers?: ResponseHeaders
	) {
		super(
			message,
			statusCode,
			headers,
			SandboxPlacementErrorCode.MachineUnavailable
		);
		this.machineId = details.machineId;
		this.reason = details.reason;
		this.alternatives = details.alternatives;
	}
}

export class SnapflowPriceChangedError extends SnapflowConflictError {
	public readonly quote?: SandboxQuote;
	public readonly priceCardId?: string;

	constructor(
		message: string,
		details: Pick<SnapflowPriceChangedError, 'quote' | 'priceCardId'>,
		statusCode?: number,
		headers?: ResponseHeaders
	) {
		super(message, statusCode, headers, SandboxPlacementErrorCode.PriceChanged);
		this.quote = details.quote;
		this.priceCardId = details.priceCardId;
	}
}

export class SnapflowLeaseRenewalRequiredError extends SnapflowConflictError {
	public readonly leaseId?: string;
	public readonly renewalDeadline?: string;

	constructor(
		message: string,
		details: Pick<
			SnapflowLeaseRenewalRequiredError,
			'leaseId' | 'renewalDeadline'
		>,
		statusCode?: number,
		headers?: ResponseHeaders
	) {
		super(
			message,
			statusCode,
			headers,
			SandboxPlacementErrorCode.LeaseRenewalRequired
		);
		this.leaseId = details.leaseId;
		this.renewalDeadline = details.renewalDeadline;
	}
}

const MACHINE_UNAVAILABLE_REASONS: readonly unknown[] = Object.values(
	MachineUnavailableReason
);
const PLACEMENT_KINDS: readonly unknown[] = Object.values(PlacementKind);

function isMachineUnavailableReason(
	value: unknown
): value is MachineUnavailableReason {
	return MACHINE_UNAVAILABLE_REASONS.includes(value);
}

function isLocation(value: unknown): value is Location | null {
	return (
		value === null ||
		(isRecord(value) &&
			typeof value.country === 'string' &&
			typeof value.continent === 'string')
	);
}

function isPlacementAlternative(
	value: unknown
): value is SandboxPlacementAlternative {
	return (
		isRecord(value) &&
		typeof value.machineId === 'string' &&
		isLocation(value.location) &&
		typeof value.hourlyPriceMicroUsd === 'string' &&
		typeof value.reliabilityBasisPoints === 'number'
	);
}

function isSandboxQuote(value: unknown): value is SandboxQuote {
	return (
		isRecord(value) &&
		PLACEMENT_KINDS.includes(value.placementKind) &&
		typeof value.available === 'boolean' &&
		typeof value.hourlyPriceMicroUsd === 'string' &&
		typeof value.priceLockDays === 'number'
	);
}

export function createSandboxPlacementError(
	body: Record<string, unknown>,
	errorCode: string | undefined,
	message: string,
	response: Response
): SnapflowConflictError | undefined {
	switch (errorCode) {
		case SandboxPlacementErrorCode.MachineUnavailable:
			return new SnapflowMachineUnavailableError(
				message,
				{
					machineId: optionalString(body.machineId),
					reason: isMachineUnavailableReason(body.reason)
						? body.reason
						: undefined,
					alternatives: Array.isArray(body.alternatives)
						? body.alternatives.filter(isPlacementAlternative)
						: [],
				},
				response.status,
				response.headers
			);
		case SandboxPlacementErrorCode.PriceChanged:
			return new SnapflowPriceChangedError(
				message,
				{
					quote: isSandboxQuote(body.quote) ? body.quote : undefined,
					priceCardId: optionalString(body.priceCardId),
				},
				response.status,
				response.headers
			);
		case SandboxPlacementErrorCode.LeaseRenewalRequired:
			return new SnapflowLeaseRenewalRequiredError(
				message,
				{
					leaseId: optionalString(body.leaseId),
					renewalDeadline: optionalString(body.renewalDeadline),
				},
				response.status,
				response.headers
			);
		default:
			return undefined;
	}
}
