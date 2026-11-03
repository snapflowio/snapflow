/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const EXACT_SCORE = 4;
const PREFIX_SCORE = 3;
const WORD_PREFIX_SCORE = 2;
const SUBSTRING_SCORE = 1;
const NO_MATCH = 0;
const WORD_BOUNDARY = /[\s/_-]+/;

export interface RankableCommand {
	label: string;
	keywords?: readonly string[];
}

function scoreText(text: string, query: string): number {
	const normalized = text.toLowerCase();
	if (normalized === query) return EXACT_SCORE;
	if (normalized.startsWith(query)) return PREFIX_SCORE;
	if (normalized.split(WORD_BOUNDARY).some((word) => word.startsWith(query))) {
		return WORD_PREFIX_SCORE;
	}
	return normalized.includes(query) ? SUBSTRING_SCORE : NO_MATCH;
}

export function rankCommands<T extends RankableCommand>(
	commands: readonly T[],
	search: string
): T[] {
	const query = search.trim().toLowerCase();
	if (!query) return [...commands];
	return commands
		.map((command, index) => ({
			command,
			index,
			score: Math.max(
				scoreText(command.label, query),
				...(command.keywords ?? []).map((keyword) =>
					Math.min(scoreText(keyword, query), SUBSTRING_SCORE)
				)
			),
		}))
		.filter((entry) => entry.score > NO_MATCH)
		.sort((left, right) => right.score - left.score || left.index - right.index)
		.map((entry) => entry.command);
}
