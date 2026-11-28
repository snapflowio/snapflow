/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const STORED_TRUE = 'true';

export const BOOLEAN_SERIALIZER = {
	serialize: String,
	deserialize: (stored: string) => stored === STORED_TRUE,
};

export function numberSerializer(fallback: number) {
	return {
		serialize: String,
		deserialize: (stored: string) => {
			const value = Number.parseFloat(stored);
			return Number.isFinite(value) ? value : fallback;
		},
	};
}
