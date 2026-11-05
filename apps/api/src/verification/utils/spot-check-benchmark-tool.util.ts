/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { openAsBlob } from 'node:fs';
import { join } from 'node:path';
import { SPOT_CHECK_BENCHMARK_TOOL } from '../constants/spot-check.constants';

type SpotCheckPlatform = (typeof SPOT_CHECK_BENCHMARK_TOOL.PLATFORMS)[number];

const SUPPORTED_PLATFORMS: ReadonlySet<string> = new Set(
	SPOT_CHECK_BENCHMARK_TOOL.PLATFORMS
);

function isSupportedPlatform(platform: string): platform is SpotCheckPlatform {
	return SUPPORTED_PLATFORMS.has(platform);
}

export function spotCheckPlatform(
	guestPlatforms: readonly string[]
): SpotCheckPlatform | null {
	return guestPlatforms.find(isSupportedPlatform) ?? null;
}

export function spotCheckBenchmarkTool(
	platform: SpotCheckPlatform
): Promise<Blob> {
	return openAsBlob(
		join(
			import.meta.dirname,
			'..',
			SPOT_CHECK_BENCHMARK_TOOL.BUILD_DIRECTORY,
			platform,
			SPOT_CHECK_BENCHMARK_TOOL.BINARY_NAME
		)
	);
}
