/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	EXPOSURE_KIND,
	EXPOSURE_VISIBILITY,
	type ExposureKind,
} from '../../constants/exposure.constants';
import { NETWORK_PROTOCOL } from '../../constants/networking.constants';
import type { ExposurePolicy } from '../../types/networking.types';

interface ExposurePublicationPolicy {
	kind: ExposureKind;
	policy: ExposurePolicy;
}

export function isPublicExposurePolicy(policy: ExposurePolicy): boolean {
	return (
		policy.protocol !== NETWORK_PROTOCOL.HTTP ||
		policy.visibility === EXPOSURE_VISIBILITY.PUBLIC
	);
}

export function isPublicExposure(exposure: ExposurePublicationPolicy): boolean {
	return (
		exposure.kind !== EXPOSURE_KIND.SYSTEM &&
		isPublicExposurePolicy(exposure.policy)
	);
}
