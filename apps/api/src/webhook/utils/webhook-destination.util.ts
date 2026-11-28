/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BlockList } from 'node:net';
import { CIDR_SEPARATOR } from '../../common/constants/ip-network.constants';
import {
	ipFamily,
	isPublicIpAddress,
} from '../../common/utils/ip-address.util';
import { WEBHOOK_PROTOCOL } from '../constants/webhook.constants';

const IPV6_BRACKETS = /^\[(?<address>.+)\]$/;

export class WebhookDestinationError extends Error {}

export interface WebhookDestinationPolicy {
	allowHttp: boolean;
	allowedNetworks: BlockList;
}

export function allowedNetworksOf(cidrs: readonly string[]): BlockList {
	const list = new BlockList();
	for (const cidr of cidrs) {
		const [address, prefix] = cidr.split(CIDR_SEPARATOR);
		const family = ipFamily(address);
		if (!family) throw new Error(`Invalid webhook allowed network: ${cidr}`);
		if (prefix === undefined) list.addAddress(address, family);
		else list.addSubnet(address, Number(prefix), family);
	}
	return list;
}

export function isBlockedAddress(
	address: string,
	allowedNetworks: BlockList
): boolean {
	const family = ipFamily(address);
	if (!family) return true;
	if (allowedNetworks.check(address, family)) return false;
	return !isPublicIpAddress(address);
}

export function urlHostname(url: URL): string {
	return IPV6_BRACKETS.exec(url.hostname)?.groups?.address ?? url.hostname;
}

export function parseWebhookUrl(
	value: string,
	policy: WebhookDestinationPolicy
): URL {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new WebhookDestinationError('The webhook URL is not a valid URL');
	}
	const allowedProtocols: readonly string[] = policy.allowHttp
		? [WEBHOOK_PROTOCOL.HTTPS, WEBHOOK_PROTOCOL.HTTP]
		: [WEBHOOK_PROTOCOL.HTTPS];
	if (!allowedProtocols.includes(url.protocol)) {
		throw new WebhookDestinationError(
			`The webhook URL must use ${allowedProtocols.join(' or ')}`
		);
	}
	if (url.username || url.password || url.hash) {
		throw new WebhookDestinationError(
			'The webhook URL must not carry credentials or a fragment'
		);
	}
	const hostname = urlHostname(url);
	if (
		ipFamily(hostname) &&
		isBlockedAddress(hostname, policy.allowedNetworks)
	) {
		throw new WebhookDestinationError(
			'The webhook URL points to a private or reserved address'
		);
	}
	return url;
}
