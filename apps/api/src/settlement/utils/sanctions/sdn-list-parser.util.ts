/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SaxesParser } from 'saxes';
import type { SdnPublication } from '../../types/sanctions.types';
import { SdnListCollector } from './sdn-list-collector.util';
import { sdnPublication } from './sdn-publication.util';

export async function parseSdnList(
	chunks: AsyncIterable<string>
): Promise<SdnPublication> {
	const parser = new SaxesParser();
	const collector = new SdnListCollector();
	const path: string[] = [];
	let text = '';
	parser.on('opentag', (tag) => {
		path.push(tag.name);
		text = '';
	});
	parser.on('text', (chunk) => {
		text += chunk;
	});
	parser.on('closetag', (tag) => {
		path.pop();
		collector.element(tag.name, path.at(-1), text.trim());
		text = '';
	});
	for await (const chunk of chunks) parser.write(chunk);
	parser.close();
	return sdnPublication(collector.contents());
}
