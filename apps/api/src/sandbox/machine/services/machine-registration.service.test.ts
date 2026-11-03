/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { describe, it } from 'node:test';
import { EntityManager } from '@mikro-orm/postgresql';
import { ConflictException } from '@nestjs/common';
import { fakeInstance } from '../../../common/testing/instance.fake';
import { Continent } from '../../../location/enums/continent.enum';
import { GeoIpService } from '../../../location/services/geo-ip.service';
import type { GeoLocation } from '../../../location/types/geo-location.types';
import { MachineMarketplaceService } from '../../../marketplace/machine/services/machine-marketplace.service';
import { MACHINE_REGISTRATION_NONCE_MINIMUM_BYTES } from '../constants/machine-registration.constants';
import type { RegisterMachineDto } from '../dto/machine-registration.dto';
import { Machine } from '../entities/machine.entity';
import {
	machineRegistrationProofMessage,
	parseMachineIdentity,
} from '../utils/machine-identity.util';
import { MachineAdministrationService } from './machine-administration.service';
import { MachineLocationService } from './machine-location.service';
import { MachineRegistrationService } from './machine-registration.service';

const OWNER_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_OWNER_ID = '00000000-0000-4000-8000-000000000002';
const MACHINE_ADDRESS = '203.0.113.7';
const UNLOCATED_ADDRESS = '10.0.0.7';
const MACHINE_LOCATION: GeoLocation = {
	country: 'DE',
	continent: Continent.EUROPE,
	city: 'Frankfurt am Main',
	latitude: 50.11,
	longitude: 8.68,
};
const MACHINE_NAME = 'garage-4090';
const RENAMED_MACHINE_NAME = 'garage-5090';
const EXISTING_MACHINE_ID = '00000000-0000-4000-8000-0000000000aa';
const CREATED_MACHINE_ID = '00000000-0000-4000-8000-0000000000bb';
const NOW = new Date('2026-10-13T12:00:00.000Z');

function registrationInput(name = MACHINE_NAME): RegisterMachineDto {
	const { publicKey, privateKey } = generateKeyPairSync('ed25519');
	const identityPublicKey = publicKey
		.export({ type: 'spki', format: 'pem' })
		.toString();
	const unsigned = {
		name,
		issuedAt: NOW.toISOString(),
		nonce: randomBytes(MACHINE_REGISTRATION_NONCE_MINIMUM_BYTES).toString(
			'base64url'
		),
	};
	return {
		...unsigned,
		identityPublicKey,
		signature: sign(
			null,
			machineRegistrationProofMessage(
				parseMachineIdentity(identityPublicKey),
				unsigned
			),
			privateKey
		).toString('base64url'),
	};
}

function harness(registered: Partial<Machine> | null) {
	const created: Machine[] = [];
	const manager: EntityManager = fakeInstance(EntityManager, {
		execute: async () => [{ now: NOW }],
		transactional: async (
			work: (transaction: EntityManager) => Promise<Machine>
		) => work(manager),
		findOne: async (...query: [unknown, Record<string, unknown>]) =>
			'identityKeyId' in query[1] ? registered : null,
	});
	const machineAdministration = fakeInstance(MachineAdministrationService, {
		create: async () => {
			const machine = fakeInstance(Machine, { id: CREATED_MACHINE_ID });
			created.push(machine);
			return machine;
		},
	});
	const geoIp = fakeInstance(GeoIpService, {
		locate: (address: string | undefined) =>
			address === MACHINE_ADDRESS ? MACHINE_LOCATION : null,
	});
	return {
		created,
		service: new MachineRegistrationService(
			manager,
			machineAdministration,
			fakeInstance(MachineMarketplaceService, {
				ensureListing: async () => undefined,
			}),
			new MachineLocationService(geoIp)
		),
	};
}

describe('MachineRegistrationService', () => {
	it('creates a Machine owned by the caller for a new identity', async () => {
		const { created, service } = harness(null);

		assert.deepEqual(
			await service.register(OWNER_ID, registrationInput(), MACHINE_ADDRESS),
			{ machineId: CREATED_MACHINE_ID, ownerId: OWNER_ID }
		);
		assert.deepEqual(
			created.map((machine) => machine.id),
			[CREATED_MACHINE_ID]
		);
	});

	it('locates a new Machine from the address it registers from', async () => {
		const { created, service } = harness(null);

		await service.register(OWNER_ID, registrationInput(), MACHINE_ADDRESS);

		const [machine] = created;
		assert.ok(machine);
		assert.equal(machine.country, MACHINE_LOCATION.country);
		assert.equal(machine.continent, MACHINE_LOCATION.continent);
		assert.equal(machine.city, MACHINE_LOCATION.city);
		assert.equal(machine.latitude, MACHINE_LOCATION.latitude);
		assert.equal(machine.longitude, MACHINE_LOCATION.longitude);
	});

	it('leaves the location unknown when the address cannot be located', async () => {
		const { created, service } = harness(null);

		await service.register(OWNER_ID, registrationInput(), UNLOCATED_ADDRESS);

		const [machine] = created;
		assert.ok(machine);
		assert.equal(machine.country, undefined);
		assert.equal(machine.latitude, undefined);
	});

	it('returns the same Machine when the identity is registered again', async () => {
		const { created, service } = harness({
			id: EXISTING_MACHINE_ID,
			organizationId: OWNER_ID,
			name: MACHINE_NAME,
		});

		assert.deepEqual(
			await service.register(OWNER_ID, registrationInput(), MACHINE_ADDRESS),
			{ machineId: EXISTING_MACHINE_ID, ownerId: OWNER_ID }
		);
		assert.deepEqual(created, []);
	});

	it('refuses an identity registered to another organization', async () => {
		const { service } = harness({
			id: EXISTING_MACHINE_ID,
			organizationId: OTHER_OWNER_ID,
			name: MACHINE_NAME,
		});

		await assert.rejects(
			service.register(OWNER_ID, registrationInput(), MACHINE_ADDRESS),
			ConflictException
		);
	});

	it('refuses an identity registered under another name', async () => {
		const { service } = harness({
			id: EXISTING_MACHINE_ID,
			organizationId: OWNER_ID,
			name: MACHINE_NAME,
		});

		await assert.rejects(
			service.register(
				OWNER_ID,
				registrationInput(RENAMED_MACHINE_NAME),
				MACHINE_ADDRESS
			),
			ConflictException
		);
	});
});
