/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EscrowEvent } from '@snapflow/api-client';
import { isAddress } from 'viem';
import { sameAddress } from '#lib/features/wallet/lib/payment-wallet.ts';

const HEX_PREFIX = '0x';
const MATCHED_HEX_CHARS = 4;

function addressBody(address: string): string {
	const lower = address.toLowerCase();
	return lower.startsWith(HEX_PREFIX) ? lower.slice(HEX_PREFIX.length) : lower;
}

function looksAlike(candidate: string, anchor: string): boolean {
	const left = addressBody(candidate);
	const right = addressBody(anchor);
	return (
		left.slice(0, MATCHED_HEX_CHARS) === right.slice(0, MATCHED_HEX_CHARS) &&
		left.slice(-MATCHED_HEX_CHARS) === right.slice(-MATCHED_HEX_CHARS)
	);
}

export function lookalikeAddress(
	candidate: string,
	anchors: readonly string[]
): string | null {
	return (
		anchors.find(
			(anchor) =>
				!sameAddress(candidate, anchor) && looksAlike(candidate, anchor)
		) ?? null
	);
}

export function payoutAddressHistory(events: readonly EscrowEvent[]): string[] {
	return [
		...new Set(
			events.flatMap((event) =>
				Object.values(event.args).filter((value) => isAddress(value))
			)
		),
	];
}
