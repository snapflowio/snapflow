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
	type PriceAboveMaximumError,
	type SandboxPlacementAlternative,
	SandboxPlacementErrorCode,
	type SandboxQuote,
} from '@snapflow/api-client';
import { isRecord, optionalString } from '../utils/record.js';
import {
	type ResponseHeaders,
	SnapflowConflictError,
} from './snapflow-error.js';

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

	constructor(
		message: string,
		details: Pick<SnapflowPriceChangedError, 'quote'>,
		statusCode?: number,
		headers?: ResponseHeaders
	) {
		super(message, statusCode, headers, SandboxPlacementErrorCode.PriceChanged);
		this.quote = details.quote;
	}
}

export class SnapflowPriceAboveMaximumError extends SnapflowConflictError {
	public readonly hourlyPriceMicroUsd?: PriceAboveMaximumError['hourlyPriceMicroUsd'];
	public readonly maxHourlyPriceMicroUsd?: PriceAboveMaximumError['maxHourlyPriceMicroUsd'];

	constructor(
		message: string,
		details: Pick<
			SnapflowPriceAboveMaximumError,
			'hourlyPriceMicroUsd' | 'maxHourlyPriceMicroUsd'
		>,
		statusCode?: number,
		headers?: ResponseHeaders
	) {
		super(
			message,
			statusCode,
			headers,
			SandboxPlacementErrorCode.PriceAboveMaximum
		);
		this.hourlyPriceMicroUsd = details.hourlyPriceMicroUsd;
		this.maxHourlyPriceMicroUsd = details.maxHourlyPriceMicroUsd;
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
	if (value === null) return true;
	if (!isRecord(value)) return false;
	const { country, continent } = value;
	return typeof country === 'string' && typeof continent === 'string';
}

function isPlacementAlternative(
	value: unknown
): value is SandboxPlacementAlternative {
	if (!isRecord(value)) return false;
	const { machineId, location, hourlyPriceMicroUsd, reliabilityBasisPoints } =
		value;
	return (
		typeof machineId === 'string' &&
		isLocation(location) &&
		typeof hourlyPriceMicroUsd === 'string' &&
		typeof reliabilityBasisPoints === 'number'
	);
}

function isSandboxQuote(value: unknown): value is SandboxQuote {
	if (!isRecord(value)) return false;
	const { placementKind, available, hourlyPriceMicroUsd, priceLockDays } =
		value;
	return (
		PLACEMENT_KINDS.includes(placementKind) &&
		typeof available === 'boolean' &&
		typeof hourlyPriceMicroUsd === 'string' &&
		typeof priceLockDays === 'number'
	);
}

export function createSandboxPlacementError(
	body: Record<string, unknown>,
	errorCode: string | undefined,
	message: string,
	response: Response
): SnapflowConflictError | undefined {
	const {
		machineId,
		reason,
		alternatives,
		quote,
		hourlyPriceMicroUsd,
		maxHourlyPriceMicroUsd,
	} = body;
	switch (errorCode) {
		case SandboxPlacementErrorCode.MachineUnavailable:
			return new SnapflowMachineUnavailableError(
				message,
				{
					machineId: optionalString(machineId),
					reason: isMachineUnavailableReason(reason) ? reason : undefined,
					alternatives: Array.isArray(alternatives)
						? alternatives.filter(isPlacementAlternative)
						: [],
				},
				response.status,
				response.headers
			);
		case SandboxPlacementErrorCode.PriceChanged:
			return new SnapflowPriceChangedError(
				message,
				{
					quote: isSandboxQuote(quote) ? quote : undefined,
				},
				response.status,
				response.headers
			);
		case SandboxPlacementErrorCode.PriceAboveMaximum:
			return new SnapflowPriceAboveMaximumError(
				message,
				{
					hourlyPriceMicroUsd: optionalString(hourlyPriceMicroUsd),
					maxHourlyPriceMicroUsd: optionalString(maxHourlyPriceMicroUsd),
				},
				response.status,
				response.headers
			);
		default:
			return undefined;
	}
}
