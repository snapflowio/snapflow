/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { BuildProvenance as ResolvedBuildProvenance } from '../../../../../scripts/build-provenance.mts';
import type { BuildProvenance } from '../types/build-provenance.types';

declare const SNAPFLOW_BUILD: ResolvedBuildProvenance;

const DEVELOPMENT_RELEASE_VERSION = 'development';

const UNKNOWN_SOURCE_REVISION = '0'.repeat(40);

function buildProvenance(resolved: ResolvedBuildProvenance): BuildProvenance {
	return {
		version: resolved.releaseVersion ?? DEVELOPMENT_RELEASE_VERSION,
		sourceRevision: resolved.sourceRevision ?? UNKNOWN_SOURCE_REVISION,
		released: resolved.releaseVersion !== null,
		revisionKnown: resolved.sourceRevision !== null,
	};
}

export const BUILD_PROVENANCE = buildProvenance(SNAPFLOW_BUILD);
