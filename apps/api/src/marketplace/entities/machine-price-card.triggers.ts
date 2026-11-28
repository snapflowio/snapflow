/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { TriggerDef } from '@mikro-orm/core';

export const MACHINE_PRICE_CARD_IMMUTABLE_TRIGGER = {
	name: 'machine_price_card_immutable',
	timing: 'before',
	events: ['update', 'delete'],
	body: `
		raise exception 'Machine price cards are immutable.'
			using errcode = 'integrity_constraint_violation';
	`,
} as const satisfies TriggerDef;
