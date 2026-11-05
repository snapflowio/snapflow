/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { ECRClient } from '@aws-sdk/client-ecr';
import { STSClient } from '@aws-sdk/client-sts';
import {
	BadRequestException,
	ServiceUnavailableException,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { fakeInstance } from '../../common/testing/instance.fake';
import { ECR_REGISTRY_ROLE_FORBIDDEN } from '../constants/ecr-credentials.constants';
import { DockerRegistry } from '../entities/docker-registry.entity';
import { RegistryType } from '../enums/registry-type.enum';
import { EcrCredentialsService } from './ecr-credentials.service';

const PLATFORM_ACCOUNT = '111111111111';
const CUSTOMER_ACCOUNT = '222222222222';
const ORGANIZATION_ID = '7f9c2a4e-5b1d-4c3a-9e8f-1a2b3c4d5e6f';
const ECR_URL = `https://${CUSTOMER_ACCOUNT}.dkr.ecr.us-east-1.amazonaws.com`;
const PLATFORM_ROLE = `arn:aws:iam::${PLATFORM_ACCOUNT}:role/snapflow-api`;
const PLATFORM_OTHER_ROLE = `arn:aws:iam::${PLATFORM_ACCOUNT}:role/anything-else`;
const CUSTOMER_ROLE = `arn:aws:iam::${CUSTOMER_ACCOUNT}:role/snapflow-pull`;
const TOKEN_TTL_MILLISECONDS = 12 * 60 * 60 * 1_000;

function registry(username: string, url = ECR_URL): DockerRegistry {
	return Object.assign(new DockerRegistry(), {
		id: 'registry-id',
		url,
		username,
		password: '',
		organizationId: ORGANIZATION_ID,
		registryType: RegistryType.ORGANIZATION,
	});
}

function serviceWith() {
	const cache = new Map<string, string>();
	const ttls = new Map<string, number>();
	const redis = fakeInstance(Redis, {
		get: async (key: string) => cache.get(key) ?? null,
		setex: async (key: string, ttlSeconds: number, value: string) => {
			cache.set(key, value);
			ttls.set(key, ttlSeconds);
			return 'OK';
		},
	});
	return { service: new EcrCredentialsService(redis), cache, ttls };
}

function mockPlatformAccount(account: string | undefined) {
	return mock.method(STSClient.prototype, 'send', async () => ({
		Account: account,
	}));
}

function mockEcrToken() {
	return mock.method(ECRClient.prototype, 'send', async () => ({
		authorizationData: [
			{
				authorizationToken: Buffer.from('AWS:secret-token').toString('base64'),
				expiresAt: new Date(Date.now() + TOKEN_TTL_MILLISECONDS),
			},
		],
	}));
}

function isRoleForbidden(error: unknown): boolean {
	return (
		error instanceof BadRequestException &&
		JSON.stringify(error.getResponse()).includes(ECR_REGISTRY_ROLE_FORBIDDEN)
	);
}

describe('EcrCredentialsService.assertCustomerRole', () => {
	afterEach(() => mock.restoreAll());

	it('rejects registering the platform role', async () => {
		mockPlatformAccount(PLATFORM_ACCOUNT);
		const { service } = serviceWith();
		await assert.rejects(
			service.assertCustomerRole(registry(PLATFORM_ROLE)),
			isRoleForbidden
		);
	});

	it('rejects registering any role in the platform account', async () => {
		mockPlatformAccount(PLATFORM_ACCOUNT);
		const { service } = serviceWith();
		await assert.rejects(
			service.assertCustomerRole(registry(PLATFORM_OTHER_ROLE)),
			isRoleForbidden
		);
	});

	it('accepts a role in the customer account', async () => {
		mockPlatformAccount(PLATFORM_ACCOUNT);
		const { service } = serviceWith();
		await service.assertCustomerRole(registry(CUSTOMER_ROLE));
	});

	it('does not check registries that are not ECR roles', async () => {
		const sts = mockPlatformAccount(PLATFORM_ACCOUNT);
		const { service } = serviceWith();
		await service.assertCustomerRole(
			registry(PLATFORM_ROLE, 'https://registry.example.com')
		);
		await service.assertCustomerRole(registry('plain-user'));
		assert.equal(sts.mock.callCount(), 0);
	});

	it('fails closed when the platform account cannot be resolved', async () => {
		mockPlatformAccount(undefined);
		const { service } = serviceWith();
		await assert.rejects(
			service.assertCustomerRole(registry(CUSTOMER_ROLE)),
			ServiceUnavailableException
		);
	});
});

describe('EcrCredentialsService.resolveRegistryCredentials', () => {
	afterEach(() => mock.restoreAll());

	it('never issues a platform token for a platform role', async () => {
		mockPlatformAccount(PLATFORM_ACCOUNT);
		const ecr = mockEcrToken();
		const { service, cache } = serviceWith();
		await assert.rejects(
			service.resolveRegistryCredentials(registry(PLATFORM_ROLE)),
			isRoleForbidden
		);
		assert.equal(ecr.mock.callCount(), 0);
		assert.equal(cache.size, 0);
	});

	it('assumes the customer role and caches the token per organization', async () => {
		mockPlatformAccount(PLATFORM_ACCOUNT);
		const ecr = mockEcrToken();
		const { service, cache, ttls } = serviceWith();
		const resolved = await service.resolveRegistryCredentials(
			registry(CUSTOMER_ROLE)
		);
		const again = await service.resolveRegistryCredentials(
			registry(CUSTOMER_ROLE)
		);
		assert.equal(resolved.username, 'AWS');
		assert.equal(resolved.password, 'secret-token');
		assert.equal(again.password, 'secret-token');
		assert.equal(ecr.mock.callCount(), 1);
		assert.deepEqual(
			[...cache.keys()],
			[`ecr:token:${ORGANIZATION_ID}:${CUSTOMER_ROLE}:us-east-1`]
		);
		assert.ok([...ttls.values()].every((ttlSeconds) => ttlSeconds > 0));
	});
});
