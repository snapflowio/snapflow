/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	BASIS_POINTS_DENOMINATOR,
	BASIS_POINTS_SCALE,
	RoundingMode,
} from '../constants/money.constants';
import type { MicroUsd } from './micro-usd.value';

const DEFAULT_SUBJECT = 'Value';

export class BasisPoints {
	static readonly ZERO = new BasisPoints(0);
	static readonly WHOLE = new BasisPoints(BASIS_POINTS_SCALE);

	private constructor(private readonly value: number) {}

	static of(value: number, subject = DEFAULT_SUBJECT): BasisPoints {
		if (
			!Number.isSafeInteger(value) ||
			value < 0 ||
			value > BASIS_POINTS_SCALE
		) {
			throw new Error(
				`${subject} basis points must be an integer between 0 and ${BASIS_POINTS_SCALE}`
			);
		}
		return new BasisPoints(value);
	}

	static fromShare(share: number): BasisPoints {
		return new BasisPoints(
			Math.min(
				BASIS_POINTS_SCALE,
				Math.max(0, Math.round(share * BASIS_POINTS_SCALE))
			)
		);
	}

	applyTo(amount: MicroUsd, rounding: RoundingMode): MicroUsd {
		const scaled = amount.multiply(this.toBigInt());
		return rounding === RoundingMode.CEIL
			? scaled.divideCeil(BASIS_POINTS_DENOMINATOR)
			: scaled.divideFloor(BASIS_POINTS_DENOMINATOR);
	}

	complement(): BasisPoints {
		return new BasisPoints(BASIS_POINTS_SCALE - this.value);
	}

	max(other: BasisPoints): BasisPoints {
		return this.value >= other.value ? this : other;
	}

	equals(other: BasisPoints): boolean {
		return this.value === other.value;
	}

	share(): number {
		return this.value / BASIS_POINTS_SCALE;
	}

	toNumber(): number {
		return this.value;
	}

	toBigInt(): bigint {
		return BigInt(this.value);
	}

	toJSON(): number {
		return this.value;
	}
}
