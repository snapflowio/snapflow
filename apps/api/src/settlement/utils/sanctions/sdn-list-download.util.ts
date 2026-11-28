/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	SANCTIONS_LIST_DOWNLOAD,
	SANCTIONS_LIST_SYNC,
} from '../../constants/sanctions.constants';
import type { SdnPublication } from '../../types/sanctions.types';
import { parseSdnList } from './sdn-list-parser.util';

function httpsUrl(location: string, base?: URL): URL {
	const url = new URL(location, base);
	if (url.protocol !== SANCTIONS_LIST_DOWNLOAD.PROTOCOL) {
		throw new Error(
			`The sanctions list download refused the non-HTTPS URL ${url.origin}`
		);
	}
	return url;
}

function isRedirect(status: number): boolean {
	return SANCTIONS_LIST_DOWNLOAD.REDIRECT_STATUSES.has(status);
}

async function nextLocation(response: Response, current: URL): Promise<URL> {
	const location = response.headers.get(
		SANCTIONS_LIST_DOWNLOAD.LOCATION_HEADER
	);
	await response.body?.cancel();
	if (!location) {
		throw new Error(
			`The sanctions list download answered HTTP ${response.status} without a location`
		);
	}
	return httpsUrl(location, current);
}

async function fetchFollowingHttps(url: string): Promise<Response> {
	const signal = AbortSignal.timeout(
		SANCTIONS_LIST_SYNC.DOWNLOAD_TIMEOUT_MILLISECONDS
	);
	let current = httpsUrl(url);
	for (
		let redirects = 0;
		redirects <= SANCTIONS_LIST_DOWNLOAD.MAXIMUM_REDIRECTS;
		redirects += 1
	) {
		const response = await fetch(current, { redirect: 'manual', signal });
		if (!isRedirect(response.status)) return response;
		current = await nextLocation(response, current);
	}
	throw new Error(
		`The sanctions list download redirected more than ${SANCTIONS_LIST_DOWNLOAD.MAXIMUM_REDIRECTS} times`
	);
}

export async function downloadSdnList(url: string): Promise<SdnPublication> {
	const response = await fetchFollowingHttps(url);
	if (!response.ok || !response.body) {
		await response.body?.cancel();
		throw new Error(
			`The sanctions list download answered HTTP ${response.status}`
		);
	}
	return parseSdnList(response.body.pipeThrough(new TextDecoderStream()));
}
