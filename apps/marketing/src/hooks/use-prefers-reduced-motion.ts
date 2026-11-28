/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useSyncExternalStore } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void) {
	const query = window.matchMedia(REDUCED_MOTION_QUERY);
	query.addEventListener('change', onChange);
	return () => query.removeEventListener('change', onChange);
}

const getSnapshot = () => window.matchMedia(REDUCED_MOTION_QUERY).matches;
const getServerSnapshot = () => false;

export function usePrefersReducedMotion() {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
