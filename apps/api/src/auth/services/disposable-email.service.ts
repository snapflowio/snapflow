/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { isDisposableEmailDomain } from 'disposable-email-domains-js';
import { Redis } from 'ioredis';
import { DISPOSABLE_EMAIL_BLOCKLIST } from '../constants/disposable-email.constants';

const {
	addressSeparator,
	commentPrefix,
	domainSeparator,
	domainsKey,
	etagKey,
	minimumDomains,
	requestTimeoutMilliseconds,
	sourceUrl,
	stagingKey,
} = DISPOSABLE_EMAIL_BLOCKLIST;

const NOT_MODIFIED = 304;
const IF_NONE_MATCH = 'if-none-match';
const ETAG = 'etag';

@Injectable()
export class DisposableEmailService {
	private readonly logger = new Logger(DisposableEmailService.name);

	constructor(@InjectRedis() private readonly redis: Redis) {}

	async isDisposable(email: string): Promise<boolean> {
		const domain = email
			.slice(email.lastIndexOf(addressSeparator) + 1)
			.trim()
			.toLowerCase();
		if (isDisposableEmailDomain(domain)) return true;
		const candidates = parentDomains(domain);
		if (candidates.length === 0) return false;
		const memberships = await this.redis.smismember(domainsKey, ...candidates);
		return memberships.includes(1);
	}

	async refresh(): Promise<void> {
		const etag = await this.redis.get(etagKey);
		const response = await fetch(sourceUrl, {
			headers: etag ? { [IF_NONE_MATCH]: etag } : {},
			signal: AbortSignal.timeout(requestTimeoutMilliseconds),
		});
		if (response.status === NOT_MODIFIED) return;
		if (!response.ok) {
			await response.body?.cancel();
			throw new Error(
				`The disposable email blocklist answered HTTP ${response.status}`
			);
		}
		const domains = parseBlocklist(await response.text());
		if (domains.length < minimumDomains) {
			throw new Error(
				`The disposable email blocklist listed only ${domains.length} domains; keeping the previous list`
			);
		}
		const transaction = this.redis
			.multi()
			.del(stagingKey)
			.sadd(stagingKey, ...domains)
			.rename(stagingKey, domainsKey);
		const nextEtag = response.headers.get(ETAG);
		await (nextEtag ? transaction.set(etagKey, nextEtag) : transaction).exec();
		this.logger.log(`Loaded ${domains.length} disposable email domains`);
	}
}

function parseBlocklist(text: string): string[] {
	return [
		...new Set(
			text
				.split('\n')
				.map((line) => line.trim().toLowerCase())
				.filter((line) => line.length > 0 && !line.startsWith(commentPrefix))
		),
	];
}

function parentDomains(domain: string): string[] {
	const labels = domain.split(domainSeparator);
	return Array.from({ length: labels.length - 1 }, (_, index) =>
		labels.slice(index).join(domainSeparator)
	);
}
