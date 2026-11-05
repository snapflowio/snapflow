/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { isIP } from 'node:net';
import type { BetterAuthOptions } from 'better-auth';
import { type Address, getAddress, isAddress } from 'viem';
import { z } from 'zod';

const HTTP_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);
const POSTGRES_PROTOCOLS: ReadonlySet<string> = new Set([
	'postgres:',
	'postgresql:',
]);
const REDIS_PROTOCOLS: ReadonlySet<string> = new Set(['redis:', 'rediss:']);
const RESEND_API_KEY_PREFIX = 're_';
const MAILBOX_PATTERN = /^(?:[^<>]+<(?<address>[^<>\s]+)>|(?<bare>[^<>\s]+))$/;
const LIST_SEPARATOR = ',';
const IPV4_PREFIX_BITS = 32;
const IPV6_PREFIX_BITS = 128;
const IP_VERSION_4 = 4;
const IP_VERSION_6 = 6;
const IP_PREFIX_BITS: ReadonlyMap<number, number> = new Map([
	[IP_VERSION_4, IPV4_PREFIX_BITS],
	[IP_VERSION_6, IPV6_PREFIX_BITS],
]);
const MAXIMUM_PORT = 65_535;
const MINIMUM_SECRET_LENGTH = 32;
const BETTER_AUTH_VERSION_SEPARATOR = ':';
const INTEGER_PATTERN = /^-?\d+$/;
const IAM_ROLE_ARN_PATTERN =
	/^arn:aws(?:-[a-z]+)*:iam::\d{12}:role\/(?:[\w+=,.@-]+\/)*[\w+=,.@-]{1,64}$/;

export type BetterAuthSecrets = NonNullable<BetterAuthOptions['secrets']>;

function parsed<Output>(parse: (value: string) => Output) {
	return z.string().transform((value, context): Output => {
		try {
			return parse(value);
		} catch (error) {
			if (!(error instanceof Error)) throw error;
			context.addIssue({ code: 'custom', message: error.message });
			return z.NEVER;
		}
	});
}

function parseUrl(value: string, protocols: ReadonlySet<string>): URL {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new Error('must be a valid URL');
	}
	if (!protocols.has(url.protocol)) {
		throw new Error(`must use ${[...protocols].join(' or ')}`);
	}
	if (url.username || url.password || url.search || url.hash) {
		throw new Error('must not carry credentials, a query or a fragment');
	}
	return url;
}

export const text = () => z.string().min(1);

function integerText(
	bounds: Readonly<{ minimum?: number; maximum?: number }> = {}
) {
	return z
		.string()
		.regex(INTEGER_PATTERN, 'must be an integer')
		.transform(Number)
		.pipe(
			z
				.number()
				.int()
				.min(bounds.minimum ?? Number.MIN_SAFE_INTEGER)
				.max(bounds.maximum ?? Number.MAX_SAFE_INTEGER)
		);
}

export const iamRoleArnText = () =>
	z
		.string()
		.regex(
			IAM_ROLE_ARN_PATTERN,
			'must be an IAM role ARN (arn:aws:iam::<account>:role/<name>)'
		);

export const integerChoiceText = <const Choices extends readonly number[]>(
	choices: Choices
) => integerText().pipe(z.literal(choices));

export const evmAddressText = () =>
	parsed((value): Address => {
		if (!isAddress(value)) {
			throw new Error('must be an EVM address (0x followed by 40 hex digits)');
		}
		return getAddress(value);
	});

export const portText = () =>
	integerText({ minimum: 1, maximum: MAXIMUM_PORT });

export const positiveIntegerText = () => integerText({ minimum: 1 });

export const nonNegativeIntegerText = () => integerText({ minimum: 0 });

export const originText = () =>
	parsed((value) => {
		const url = parseUrl(value, HTTP_PROTOCOLS);
		if (url.pathname !== '/')
			throw new Error('must be an origin without a path');
		return url.origin;
	});

export const httpUrlText = () =>
	parsed((value) =>
		parseUrl(value, HTTP_PROTOCOLS).toString().replace(/\/+$/, '')
	);

function connectionUrlText(protocols: ReadonlySet<string>) {
	return parsed((value) => {
		let url: URL;
		try {
			url = new URL(value);
		} catch {
			throw new Error('must be a valid URL');
		}
		if (!protocols.has(url.protocol)) {
			throw new Error(`must use ${[...protocols].join(' or ')}`);
		}
		return value;
	});
}

export const postgresUrlText = () => connectionUrlText(POSTGRES_PROTOCOLS);

export const redisUrlText = () => connectionUrlText(REDIS_PROTOCOLS);

export const resendApiKeyText = () =>
	z
		.string()
		.startsWith(
			RESEND_API_KEY_PREFIX,
			`must be a Resend API key (${RESEND_API_KEY_PREFIX}...)`
		);

export const emailAddressText = () => z.email();

export const mailboxText = () =>
	z.string().refine(
		(value) => {
			const match = MAILBOX_PATTERN.exec(value.trim());
			const address = match?.groups?.address ?? match?.groups?.bare;
			return address !== undefined && z.email().safeParse(address).success;
		},
		{ message: 'must be an address or "Display Name <address>"' }
	);

function listEntries(value: string): string[] {
	return [
		...new Set(
			value
				.split(LIST_SEPARATOR)
				.map((entry) => entry.trim())
				.filter(Boolean)
		),
	];
}

export const cidrListText = () =>
	parsed((value) => {
		const entries = listEntries(value);
		if (!entries.every(isCidrEntry)) {
			throw new Error('must contain IP addresses or CIDR ranges');
		}
		return entries;
	});

function isCidrEntry(entry: string): boolean {
	const [ip, prefix, ...extra] = entry.split('/');
	const maximum = IP_PREFIX_BITS.get(isIP(ip));
	if (maximum === undefined || extra.length > 0) return false;
	if (prefix === undefined) return true;
	const bits = Number(prefix);
	return (
		Number.isInteger(bits) &&
		String(bits) === prefix &&
		bits >= 0 &&
		bits <= maximum
	);
}

export const betterAuthSecretsText = () =>
	parsed((value): BetterAuthSecrets => {
		const secrets = listEntries(value).map((entry) => {
			const separator = entry.indexOf(BETTER_AUTH_VERSION_SEPARATOR);
			const versionText = entry.slice(0, separator);
			const secret = entry.slice(separator + 1);
			const version = Number(versionText);
			if (
				separator < 1 ||
				!Number.isInteger(version) ||
				String(version) !== versionText ||
				version < 0 ||
				secret.length < MINIMUM_SECRET_LENGTH
			) {
				throw new Error(
					`entries must use <version>:<${MINIMUM_SECRET_LENGTH}+ character high-entropy secret>`
				);
			}
			return { version, value: secret };
		});
		for (let index = 1; index < secrets.length; index += 1) {
			if (secrets[index - 1].version <= secrets[index].version) {
				throw new Error(
					'must list the current secret first and older versions in strictly descending order'
				);
			}
		}
		return secrets;
	});
