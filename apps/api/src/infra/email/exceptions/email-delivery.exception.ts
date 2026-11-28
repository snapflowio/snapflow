/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EmailCategory } from '../constants/email.constants';

export class EmailDeliveryError extends Error {
	override readonly name = 'EmailDeliveryError';

	constructor(
		readonly category: EmailCategory,
		reason: string
	) {
		super(`Could not send ${category} email: ${reason}`);
	}
}
