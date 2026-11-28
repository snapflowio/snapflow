/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { LookupAddress, LookupOptions } from 'node:dns';
import { lookup } from 'node:dns/promises';
import http, { type IncomingMessage } from 'node:http';
import https from 'node:https';
import type { LookupFunction } from 'node:net';
import { Injectable } from '@nestjs/common';
import { MILLISECONDS_PER_SECOND } from '../../common/constants/time.constants';
import { TypedConfigService } from '../../config/services/typed-config.service';
import {
	WEBHOOK_HTTP_METHOD,
	WEBHOOK_LIMITS,
	WEBHOOK_PROTOCOL,
} from '../constants/webhook.constants';
import {
	allowedNetworksOf,
	isBlockedAddress,
	parseWebhookUrl,
	urlHostname,
	WebhookDestinationError,
	type WebhookDestinationPolicy,
} from '../utils/webhook-destination.util';

const BLOCKED_DESTINATION_MESSAGE =
	'The webhook URL resolves to a private or reserved address';
const UNRESOLVED_DESTINATION_MESSAGE = 'The webhook URL host did not resolve';

export interface WebhookHttpResponse {
	status: number;
	body: string;
}

async function readLimited(
	response: IncomingMessage,
	maximumBytes: number
): Promise<string> {
	const chunks: Buffer[] = [];
	let size = 0;
	for await (const chunk of response) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		chunks.push(buffer);
		size += buffer.byteLength;
		if (size >= maximumBytes) break;
	}
	return Buffer.concat(chunks).subarray(0, maximumBytes).toString('utf8');
}

@Injectable()
export class WebhookHttpClientService {
	readonly policy: WebhookDestinationPolicy;
	private readonly timeoutMilliseconds: number;

	constructor(config: TypedConfigService) {
		const webhooks = config.get('webhooks');
		this.policy = {
			allowHttp: webhooks.allowHttp,
			allowedNetworks: allowedNetworksOf(webhooks.allowedCidrs),
		};
		this.timeoutMilliseconds = webhooks.timeoutMilliseconds;
	}

	get leaseSeconds(): number {
		return Math.ceil(this.timeoutMilliseconds / MILLISECONDS_PER_SECOND);
	}

	async post(
		target: string,
		headers: Readonly<Record<string, string>>,
		body: string
	): Promise<WebhookHttpResponse> {
		const url = parseWebhookUrl(target, this.policy);
		const transport =
			url.protocol === WEBHOOK_PROTOCOL.HTTPS ? https.request : http.request;
		const response = await new Promise<IncomingMessage>((resolve, reject) => {
			const request = transport(
				url,
				{
					method: WEBHOOK_HTTP_METHOD,
					headers: {
						...headers,
						'content-length': Buffer.byteLength(body),
					},
					lookup: this.guardedLookup,
					signal: AbortSignal.timeout(this.timeoutMilliseconds),
					agent: false,
				},
				resolve
			);
			request.on('error', reject);
			request.end(body);
		});
		const status = response.statusCode;
		const responseBody = await readLimited(
			response,
			WEBHOOK_LIMITS.RESPONSE_BODY_MAX_BYTES
		);
		response.destroy();
		if (status === undefined) {
			throw new Error('The webhook endpoint returned no status code');
		}
		return { status, body: responseBody };
	}

	async validateDestination(target: string): Promise<URL> {
		const url = parseWebhookUrl(target, this.policy);
		await this.allowedAddresses(urlHostname(url));
		return url;
	}

	private async allowedAddresses(
		hostname: string,
		options: LookupOptions = {}
	): Promise<[LookupAddress, ...LookupAddress[]]> {
		const addresses = await lookup(hostname, {
			family: options.family,
			hints: options.hints,
			all: true,
		}).catch((error: unknown) => {
			throw new WebhookDestinationError(UNRESOLVED_DESTINATION_MESSAGE, {
				cause: error,
			});
		});
		const [first, ...rest] = addresses;
		if (!first) {
			throw new WebhookDestinationError(UNRESOLVED_DESTINATION_MESSAGE);
		}
		if (
			addresses.some(({ address }) =>
				isBlockedAddress(address, this.policy.allowedNetworks)
			)
		) {
			throw new WebhookDestinationError(BLOCKED_DESTINATION_MESSAGE);
		}
		return [first, ...rest];
	}

	private readonly guardedLookup: LookupFunction = (
		hostname,
		options,
		callback
	) => {
		this.allowedAddresses(hostname, options).then(
			(addresses) => {
				if (options.all) callback(null, addresses);
				else callback(null, addresses[0].address, addresses[0].family);
			},
			(error: WebhookDestinationError) => callback(error, [])
		);
	};
}
