/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type CollectionEntry, getCollection } from 'astro:content';
import type { APIRoute, GetStaticPaths } from 'astro';
import {
	MARKDOWN_CONTENT_TYPE,
	pageMarkdown,
} from '../lib/markdown/page-markdown';

interface Props {
	entry: CollectionEntry<'docs'>;
}

export const getStaticPaths = (async () =>
	(await getCollection('docs')).map((entry) => ({
		params: { slug: entry.id },
		props: { entry },
	}))) satisfies GetStaticPaths;

export const GET: APIRoute<Props> = ({ props }) =>
	new Response(pageMarkdown(props.entry), {
		headers: { 'Content-Type': MARKDOWN_CONTENT_TYPE },
	});
