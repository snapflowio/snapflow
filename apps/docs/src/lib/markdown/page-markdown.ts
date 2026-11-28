/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { CollectionEntry } from 'astro:content';
import { DOCS_BASE } from '../../config/site';

export const MARKDOWN_EXTENSION = '.md';
export const MARKDOWN_CONTENT_TYPE = 'text/markdown; charset=utf-8';

const INDEX_PAGE = 'index';
const MODULE_STATEMENT = /^(?:import|export)\s.+$/gm;
const SURPLUS_BLANK_LINES = /\n{3,}/g;

export function markdownPath(entryId: string): string {
	return `${DOCS_BASE}/${entryId || INDEX_PAGE}${MARKDOWN_EXTENSION}`;
}

export function pageMarkdown(entry: CollectionEntry<'docs'>): string {
	const { title, description } = entry.data;
	const body = (entry.body ?? '')
		.replace(MODULE_STATEMENT, '')
		.replace(SURPLUS_BLANK_LINES, '\n\n')
		.trim();
	return [`# ${title}`, description, body]
		.filter((part): part is string => Boolean(part))
		.join('\n\n')
		.concat('\n');
}
