/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { Client } from 'pg';
import { integrationDatabaseUrl } from '../../../common/testing/integration-database.util';

const DATABASE_URL = integrationDatabaseUrl();
const IMMUTABLE = /Machine price cards are immutable/;
const UNIQUE_VERSION = /UQ_machine_price_card_version/;
const RATE = '1000';

describe('machine price card immutability', {
	skip: DATABASE_URL ? false : 'DATABASE_URL is not configured',
}, () => {
	let client: Client;

	before(async () => {
		client = new Client({ connectionString: DATABASE_URL });
		await client.connect();
	});

	after(async () => {
		if (client) await client.end();
	});

	it('rejects updates of a published card', async () => {
		await inRolledBackTransaction(async () => {
			const cardId = await insertCard(await insertMachine(), 1);
			await assert.rejects(
				client.query(
					'update "machine_price_card" set "vcpuHourMicroUsd" = 1 where id = $1',
					[cardId]
				),
				IMMUTABLE
			);
		});
	});

	it('rejects deletion of a published card', async () => {
		await inRolledBackTransaction(async () => {
			const cardId = await insertCard(await insertMachine(), 1);
			await assert.rejects(
				client.query('delete from "machine_price_card" where id = $1', [
					cardId,
				]),
				IMMUTABLE
			);
		});
	});

	it('accepts a new version and rejects a duplicate version', async () => {
		await inRolledBackTransaction(async () => {
			const machine = await insertMachine();
			await insertCard(machine, 1);
			assert.ok(await insertCard(machine, 2));
			await assert.rejects(insertCard(machine, 2), UNIQUE_VERSION);
		});
	});

	async function inRolledBackTransaction(
		body: () => Promise<void>
	): Promise<void> {
		await client.query('begin');
		try {
			await body();
		} finally {
			await client.query('rollback');
		}
	}

	interface SeededMachine {
		machineId: string;
		organizationId: string;
	}

	async function insertMachine(): Promise<SeededMachine> {
		const organizationId = randomUUID();
		const machineId = randomUUID();
		await client.query(
			'insert into "organization" (id, name, slug) values ($1, $2, $3)',
			[organizationId, organizationId, organizationId]
		);
		await client.query(
			'insert into "machine" (id, "organizationId", name) values ($1, $2, $3)',
			[machineId, organizationId, machineId]
		);
		return { machineId, organizationId };
	}

	async function insertCard(
		machine: SeededMachine,
		version: number
	): Promise<string> {
		const cardId = randomUUID();
		await client.query(
			`insert into "machine_price_card"
				(id, "machineId", "organizationId", version, "vcpuHourMicroUsd",
				"memoryGibHourMicroUsd", "gpuHourMicroUsd", "diskGibMonthMicroUsd",
				"stoppedDiskGibMonthMicroUsd", "egressMicroUsdPerGiB", "referencePriceMicroUsd",
				"floorMicroUsd", "egressCeilingMicroUsdPerGiB")
			values ($1, $2, $3, $4, $5, $5, 0, $5, $5, 0, $5, $5, $5)`,
			[cardId, machine.machineId, machine.organizationId, version, RATE]
		);
		return cardId;
	}
});
