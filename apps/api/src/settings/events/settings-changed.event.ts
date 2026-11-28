/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { isDeepStrictEqual } from 'node:util';
import type { SettingsSnapshot } from '../types/settings.types';

export class SettingsChangedEvent {
	constructor(
		public readonly previous: SettingsSnapshot,
		public readonly current: SettingsSnapshot
	) {}

	changed(...keys: readonly (keyof SettingsSnapshot)[]): boolean {
		return keys.some(
			(key) => !isDeepStrictEqual(this.previous[key], this.current[key])
		);
	}
}
