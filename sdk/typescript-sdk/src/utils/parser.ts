/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 * Copyright 2025 Snapflow
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ExecutionArtifacts } from '../types';

export class ArtifactParser {
	private static readonly ARTIFACT_PREFIX = 'dtn_artifact_k39fd2:';

	public static parseArtifacts(output: string): ExecutionArtifacts {
		const lines = output.split('\n');
		const artifactLines = ArtifactParser.extractArtifactLines(lines);
		const stdout = ArtifactParser.removeArtifactLines(output, artifactLines);

		return { stdout };
	}

	private static extractArtifactLines(lines: string[]): string[] {
		return lines.filter((line) =>
			line.startsWith(ArtifactParser.ARTIFACT_PREFIX)
		);
	}

	private static removeArtifactLines(
		output: string,
		artifactLines: string[]
	): string {
		return artifactLines.reduce((result, line) => {
			return result.replace(line + '\n', '').replace(line, '');
		}, output);
	}
}
