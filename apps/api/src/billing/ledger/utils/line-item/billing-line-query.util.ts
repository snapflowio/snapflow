/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const EFFECTIVE_BILLING_LINE_AMOUNT_SQL = `(
	line."grossMicroUsd" + COALESCE((
		SELECT SUM(
			CASE WHEN adjustment.kind = 'debit'
				THEN adjustment."amountMicroUsd"
				ELSE -adjustment."amountMicroUsd"
			END
		)
		FROM "billing_line_adjustment" adjustment
		WHERE adjustment."lineItemId" = line.id
	), 0)
)`;
