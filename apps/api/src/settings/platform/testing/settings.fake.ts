/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { fakeInstance } from '../../../common/testing/instance.fake';
import {
	SETTINGS_DEFAULTS,
	SETTINGS_RESOURCE_VERSION_INITIAL,
} from '../constants/settings.constants';
import { SettingsService } from '../services/settings.service';
import type { SettingsSnapshot } from '../types/settings.types';

export function fakeSettings(
	overrides: Partial<SettingsSnapshot> = {}
): SettingsService {
	const settings: SettingsSnapshot = Object.freeze({
		...SETTINGS_DEFAULTS,
		edgeTrustedHttpProxyCidrs: [],
		resourceVersion: SETTINGS_RESOURCE_VERSION_INITIAL,
		updatedBy: null,
		updatedAt: new Date(0),
		...overrides,
	});
	return fakeInstance(SettingsService, { get: async () => settings });
}
