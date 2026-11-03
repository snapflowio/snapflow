/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { readFile } from 'node:fs/promises';
import { z } from 'zod';

const KV_MOUNT = 'secret';
const API_PREFIX = 'v1';
const TOKEN_HEADER = 'X-Vault-Token';
const PROXY_REQUEST_HEADER = 'X-Vault-Request';
const CONTENT_TYPE_HEADER = 'Content-Type';
const JSON_CONTENT_TYPE = 'application/json';
const HTTP_NOT_FOUND = 404;
const VAULT_REQUEST_TIMEOUT_MILLISECONDS = 10_000;
const MAXIMUM_VAULT_RESPONSE_BYTES = 1 << 20;
const UNREACHABLE_STATUS = 'unreachable';
const INVALID_RESPONSE_STATUS = 'invalid-response';

export type VaultAccess = Readonly<{
	address: string;
	tokenFile?: string;
}>;

export type VaultRequestOptions = Readonly<{
	body?: Readonly<Record<string, unknown>>;
	allowNotFound?: boolean;
}>;

export class VaultRequestError extends Error {
	constructor(
		readonly path: string,
		readonly status: number | string,
		options?: ErrorOptions
	) {
		super(`Vault request to ${path} failed (${status})`, options);
	}
}

const kvReadResponseSchema = z.object({
	data: z.object({ data: z.record(z.string(), z.unknown()) }),
});

async function headers(
	access: VaultAccess,
	hasBody: boolean
): Promise<Record<string, string>> {
	const result: Record<string, string> = { [PROXY_REQUEST_HEADER]: 'true' };
	if (hasBody) result[CONTENT_TYPE_HEADER] = JSON_CONTENT_TYPE;
	if (access.tokenFile) {
		const token = (await readFile(access.tokenFile, 'utf8')).trim();
		if (!token)
			throw new Error(`Vault token file ${access.tokenFile} is empty`);
		result[TOKEN_HEADER] = token;
	}
	return result;
}

function url(access: VaultAccess, path: string): URL {
	return new URL(
		`${API_PREFIX}/${path}`,
		access.address.endsWith('/') ? access.address : `${access.address}/`
	);
}

async function readBoundedBody(
	path: string,
	response: Response
): Promise<string> {
	if (!response.body) return '';
	const chunks: Uint8Array[] = [];
	let total = 0;
	for await (const chunk of response.body) {
		total += chunk.byteLength;
		if (total > MAXIMUM_VAULT_RESPONSE_BYTES) {
			await response.body.cancel();
			throw new VaultRequestError(path, INVALID_RESPONSE_STATUS);
		}
		chunks.push(chunk);
	}
	return Buffer.concat(chunks).toString('utf8');
}

async function send(
	access: VaultAccess,
	path: string,
	options: VaultRequestOptions
): Promise<Response> {
	try {
		return await fetch(url(access, path), {
			method: options.body ? 'POST' : 'GET',
			headers: await headers(access, options.body !== undefined),
			body: options.body ? JSON.stringify(options.body) : undefined,
			signal: AbortSignal.timeout(VAULT_REQUEST_TIMEOUT_MILLISECONDS),
		});
	} catch (error: unknown) {
		throw new VaultRequestError(path, UNREACHABLE_STATUS, { cause: error });
	}
}

/**
 * Sends one request through the Vault Proxy and validates the JSON reply.
 * Returns null only when `allowNotFound` is set and Vault answers 404.
 */
export async function vaultRequest<Schema extends z.ZodType>(
	access: VaultAccess,
	path: string,
	schema: Schema,
	options: VaultRequestOptions = {}
): Promise<z.infer<Schema> | null> {
	const response = await send(access, path, options);
	if (options.allowNotFound && response.status === HTTP_NOT_FOUND) {
		await response.body?.cancel();
		return null;
	}
	if (!response.ok) {
		await response.body?.cancel();
		throw new VaultRequestError(path, response.status);
	}
	const parsed = schema.safeParse(
		parseJson(path, await readBoundedBody(path, response))
	);
	if (!parsed.success) {
		throw new VaultRequestError(path, INVALID_RESPONSE_STATUS, {
			cause: parsed.error,
		});
	}
	return parsed.data;
}

export async function requiredVaultRequest<Schema extends z.ZodType>(
	access: VaultAccess,
	path: string,
	schema: Schema,
	options: Omit<VaultRequestOptions, 'allowNotFound'> = {}
): Promise<z.infer<Schema>> {
	const result = await vaultRequest(access, path, schema, options);
	if (result === null) throw new VaultRequestError(path, HTTP_NOT_FOUND);
	return result;
}

function parseJson(path: string, text: string): unknown {
	try {
		return JSON.parse(text);
	} catch (error: unknown) {
		throw new VaultRequestError(path, INVALID_RESPONSE_STATUS, {
			cause: error,
		});
	}
}

export async function readVaultKvField(
	access: VaultAccess,
	path: string,
	field: string
): Promise<string | null> {
	const response = await vaultRequest(
		access,
		`${KV_MOUNT}/data/${path}`,
		kvReadResponseSchema,
		{ allowNotFound: true }
	);
	if (response === null) return null;
	const value = response.data.data[field];
	if (typeof value !== 'string') {
		throw new Error(`Vault KV secret ${path} has no ${field} field`);
	}
	return value;
}
