/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export enum PaymentAccountTransfersStatus {
	INACTIVE = 'inactive',
	PENDING = 'pending',
	ACTIVE = 'active',
	RESTRICTED = 'restricted',
}

export enum PaymentAccountRequirementsStatus {
	NONE = 'none',
	EVENTUALLY_DUE = 'eventually_due',
	CURRENTLY_DUE = 'currently_due',
	PAST_DUE = 'past_due',
}

export enum PaymentAccountTaxInformationStatus {
	MISSING = 'missing',
	PROVIDED = 'provided',
}
