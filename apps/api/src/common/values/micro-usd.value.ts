/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	MICRO_USD_DECIMALS,
	MICRO_USD_PER_CENT,
	MICRO_USD_PER_USD,
} from '../constants/money.constants';
import { ceilDivide, floorDivide } from '../utils/fixed-point.util';

const WHOLE_AMOUNT_PATTERN = /^-?\d+$/;
const FRACTION_PAD = '0';
const TRAILING_ZEROS = /0+$/;
const NEGATIVE_SIGN = '-';

export class MicroUsd {
	static readonly ZERO = new MicroUsd(0n);

	private constructor(private readonly amount: bigint) {}

	static of(amount: bigint): MicroUsd {
		return new MicroUsd(amount);
	}

	static parse(value: string): MicroUsd {
		if (!WHOLE_AMOUNT_PATTERN.test(value)) {
			throw new Error(`${value} is not a whole micro-dollar amount`);
		}
		return new MicroUsd(BigInt(value));
	}

	static parseNullable(value: string | null): MicroUsd | null {
		return value === null ? null : MicroUsd.parse(value);
	}

	static fromCents(cents: number): MicroUsd {
		if (!Number.isSafeInteger(cents)) {
			throw new Error('Cents must be a safe integer');
		}
		return new MicroUsd(BigInt(cents) * MICRO_USD_PER_CENT);
	}

	static sum(amounts: Iterable<MicroUsd>): MicroUsd {
		let total = 0n;
		for (const amount of amounts) total += amount.amount;
		return new MicroUsd(total);
	}

	add(other: MicroUsd): MicroUsd {
		return new MicroUsd(this.amount + other.amount);
	}

	subtract(other: MicroUsd): MicroUsd {
		return new MicroUsd(this.amount - other.amount);
	}

	negate(): MicroUsd {
		return new MicroUsd(-this.amount);
	}

	absolute(): MicroUsd {
		return this.amount < 0n ? this.negate() : this;
	}

	multiply(quantity: bigint): MicroUsd {
		return new MicroUsd(this.amount * quantity);
	}

	divideFloor(divisor: bigint): MicroUsd {
		return new MicroUsd(floorDivide(this.amount, divisor));
	}

	divideCeil(divisor: bigint): MicroUsd {
		return new MicroUsd(ceilDivide(this.amount, divisor));
	}

	quotient(divisor: MicroUsd): bigint {
		return floorDivide(this.amount, divisor.amount);
	}

	nonnegative(): MicroUsd {
		return this.amount < 0n ? MicroUsd.ZERO : this;
	}

	min(other: MicroUsd): MicroUsd {
		return this.amount <= other.amount ? this : other;
	}

	max(other: MicroUsd): MicroUsd {
		return this.amount >= other.amount ? this : other;
	}

	compare(other: MicroUsd): number {
		if (this.amount < other.amount) return -1;
		return this.amount > other.amount ? 1 : 0;
	}

	equals(other: MicroUsd): boolean {
		return this.amount === other.amount;
	}

	greaterThan(other: MicroUsd): boolean {
		return this.amount > other.amount;
	}

	lessThan(other: MicroUsd): boolean {
		return this.amount < other.amount;
	}

	atLeast(other: MicroUsd): boolean {
		return this.amount >= other.amount;
	}

	atMost(other: MicroUsd): boolean {
		return this.amount <= other.amount;
	}

	isZero(): boolean {
		return this.amount === 0n;
	}

	isPositive(): boolean {
		return this.amount > 0n;
	}

	isNegative(): boolean {
		return this.amount < 0n;
	}

	wholeCents(): number {
		const cents = Number(floorDivide(this.amount, MICRO_USD_PER_CENT));
		if (!Number.isSafeInteger(cents)) {
			throw new Error('Cents exceed the safe integer range');
		}
		return cents;
	}

	roundDownToCent(): MicroUsd {
		return MicroUsd.fromCents(this.wholeCents());
	}

	toBigInt(): bigint {
		return this.amount;
	}

	toUsd(): string {
		const sign = this.amount < 0n ? NEGATIVE_SIGN : '';
		const magnitude = this.amount < 0n ? -this.amount : this.amount;
		const fraction = (magnitude % MICRO_USD_PER_USD)
			.toString()
			.padStart(MICRO_USD_DECIMALS, FRACTION_PAD)
			.replace(TRAILING_ZEROS, '');
		const whole = magnitude / MICRO_USD_PER_USD;
		return fraction.length > 0
			? `${sign}${whole}.${fraction}`
			: `${sign}${whole}`;
	}

	toString(): string {
		return this.amount.toString();
	}

	toJSON(): string {
		return this.toString();
	}
}
