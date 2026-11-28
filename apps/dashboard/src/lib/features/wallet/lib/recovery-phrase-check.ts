/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const CONFIRM_WORD_COUNT = 3;

const WORD_SEPARATOR = ' ';

export function phraseWords(phrase: string): string[] {
	return phrase.split(WORD_SEPARATOR);
}

export function confirmWordIndices(wordCount: number): number[] {
	const indices = new Set<number>();
	while (indices.size < Math.min(CONFIRM_WORD_COUNT, wordCount)) {
		const [random = 0] = crypto.getRandomValues(new Uint32Array(1));
		indices.add(random % wordCount);
	}
	return [...indices].toSorted((left, right) => left - right);
}

export function wordMatches(expected: string, entered: string): boolean {
	return entered.trim().toLowerCase() === expected;
}
