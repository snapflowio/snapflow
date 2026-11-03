/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { SettingsSnapshot } from '../../../settings/platform/types/settings.types';
import { PaymentsErrorCode } from '../constants/payments.constants';

export type VelocitySettings = Pick<
	SettingsSnapshot,
	'topUpAttemptsPerHour' | 'paymentMethodsPerDay'
>;

export interface VelocityObservation {
	topUpAttemptsLastHour: number;
	paymentMethodsLastDay: number;
}

export type VelocityViolation =
	| typeof PaymentsErrorCode.TOP_UP_ATTEMPTS_EXCEEDED
	| typeof PaymentsErrorCode.PAYMENT_METHODS_EXCEEDED;

export interface FingerprintOrganization {
	organizationId: string;
	createdAt: Date;
}

export function topUpVelocityViolation(
	observation: VelocityObservation,
	settings: VelocitySettings
): VelocityViolation | null {
	if (observation.topUpAttemptsLastHour >= settings.topUpAttemptsPerHour) {
		return PaymentsErrorCode.TOP_UP_ATTEMPTS_EXCEEDED;
	}
	if (observation.paymentMethodsLastDay >= settings.paymentMethodsPerDay) {
		return PaymentsErrorCode.PAYMENT_METHODS_EXCEEDED;
	}
	return null;
}

export function organizationsBeyondFingerprintLimit(
	organizations: readonly FingerprintOrganization[],
	organizationsPerCardFingerprint: number
): string[] {
	return [...organizations]
		.sort(
			(left, right) =>
				left.createdAt.getTime() - right.createdAt.getTime() ||
				left.organizationId.localeCompare(right.organizationId)
		)
		.slice(organizationsPerCardFingerprint)
		.map(({ organizationId }) => organizationId);
}
