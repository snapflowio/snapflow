/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BillingBeneficiaryKind } from '../../billing/constants/billing.constants';
import { RoundingMode } from '../../common/constants/money.constants';
import type { BasisPoints } from '../../common/values/basis-points.value';
import { MicroUsd } from '../../common/values/micro-usd.value';
import type { PaymentVoucher } from '../entities/payment-voucher.entity';
import type {
	LeaseCharges,
	VoucherAmounts,
} from '../types/payment-channel.types';

export const ZERO_VOUCHER_AMOUNTS: Readonly<VoucherAmounts> = {
	hostMicroUsd: MicroUsd.ZERO,
	feeMicroUsd: MicroUsd.ZERO,
	serviceMicroUsd: MicroUsd.ZERO,
};

type VoucherAmountColumns = Pick<
	PaymentVoucher,
	'hostAmountMicroUsd' | 'feeAmountMicroUsd' | 'serviceAmountMicroUsd'
>;

// What a lease owes, split the way the escrow pays it. The host earns its
// share of host lines; the fee is the lease markup on that share, rounded
// down so that the escrow, which allows the cap rounded up on each claim's
// host increase, accepts every increase between two such vouchers; the
// customer's remaining charges (platform lines, unsplit lines and the
// rounding the usage split gave the markup) are service.
export function owedAmounts(
	charges: LeaseCharges,
	markup: BasisPoints
): VoucherAmounts {
	let grossMicroUsd = MicroUsd.ZERO;
	let hostMicroUsd = MicroUsd.ZERO;
	for (const line of charges.lines) {
		grossMicroUsd = grossMicroUsd.add(MicroUsd.parse(line.grossMicroUsd));
		if (line.beneficiaryKind === BillingBeneficiaryKind.HOST_ORGANIZATION) {
			hostMicroUsd = hostMicroUsd.add(MicroUsd.parse(line.hostMicroUsd));
		}
	}
	for (const accrual of charges.accruals) {
		grossMicroUsd = grossMicroUsd.add(accrual.grossMicroUsd);
		hostMicroUsd = hostMicroUsd.add(accrual.hostMicroUsd);
	}
	const feeMicroUsd = markup.applyTo(hostMicroUsd, RoundingMode.FLOOR);
	const serviceMicroUsd = grossMicroUsd
		.subtract(hostMicroUsd)
		.subtract(feeMicroUsd);
	if (serviceMicroUsd.isNegative()) {
		throw new Error(
			`Charges of ${grossMicroUsd} do not cover a host share of ${hostMicroUsd} and a fee of ${feeMicroUsd}`
		);
	}
	return { hostMicroUsd, feeMicroUsd, serviceMicroUsd };
}

// Platform fees owed outside any lease pay no host and carry no markup, so
// the escrow's fee cap never applies to them.
export function serviceAmounts(serviceMicroUsd: MicroUsd): VoucherAmounts {
	return { ...ZERO_VOUCHER_AMOUNTS, serviceMicroUsd };
}

// A voucher may never lower an amount the previous one carried: a charge
// corrected downward after it was signed stays paid. Taking the larger fee
// keeps it the rounded-down markup of the larger host amount.
export function cumulativeAmounts(
	owed: VoucherAmounts,
	previous: VoucherAmounts
): VoucherAmounts {
	return {
		hostMicroUsd: owed.hostMicroUsd.max(previous.hostMicroUsd),
		feeMicroUsd: owed.feeMicroUsd.max(previous.feeMicroUsd),
		serviceMicroUsd: owed.serviceMicroUsd.max(previous.serviceMicroUsd),
	};
}

export function amountsExceed(
	amounts: VoucherAmounts,
	baseline: VoucherAmounts
): boolean {
	return (
		amounts.hostMicroUsd.greaterThan(baseline.hostMicroUsd) ||
		amounts.feeMicroUsd.greaterThan(baseline.feeMicroUsd) ||
		amounts.serviceMicroUsd.greaterThan(baseline.serviceMicroUsd)
	);
}

export function voucherTotal(amounts: VoucherAmounts): MicroUsd {
	return amounts.hostMicroUsd
		.add(amounts.feeMicroUsd)
		.add(amounts.serviceMicroUsd);
}

export function storedAmounts(voucher: VoucherAmountColumns): VoucherAmounts {
	return {
		hostMicroUsd: MicroUsd.parse(voucher.hostAmountMicroUsd),
		feeMicroUsd: MicroUsd.parse(voucher.feeAmountMicroUsd),
		serviceMicroUsd: MicroUsd.parse(voucher.serviceAmountMicroUsd),
	};
}

export function amountColumns(amounts: VoucherAmounts): VoucherAmountColumns {
	return {
		hostAmountMicroUsd: amounts.hostMicroUsd.toString(),
		feeAmountMicroUsd: amounts.feeMicroUsd.toString(),
		serviceAmountMicroUsd: amounts.serviceMicroUsd.toString(),
	};
}
