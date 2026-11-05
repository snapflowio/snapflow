/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	ChangeSetType,
	type EventSubscriber,
	type FlushEventArgs,
} from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { MachineEvents } from '../../machine/constants/machine-events.constants';
import { MachineDto } from '../../machine/dto/machine.dto';
import { Machine } from '../../machine/entities/machine.entity';
import { MachineState } from '../../machine/enums/machine-state.enum';
import { RealtimeOutboxEvent } from '../../notification/entities/realtime-outbox-event.entity';
import type { RealtimeOutboxPayload } from '../../notification/types/realtime-outbox.types';
import { VolumeEvents } from '../../volume/constants/volume-events.constants';
import { VolumeDto } from '../../volume/dto/volume.dto';
import { Volume } from '../../volume/entities/volume.entity';
import { VolumeState } from '../../volume/enums/volume-state.enum';

const machineStates = new Set<unknown>(Object.values(MachineState));
const volumeStates = new Set<unknown>(Object.values(VolumeState));

function isMachineState(value: unknown): value is MachineState {
	return machineStates.has(value);
}

function isVolumeState(value: unknown): value is VolumeState {
	return volumeStates.has(value);
}

type OutboxChangeSet = ReturnType<
	FlushEventArgs['uow']['getChangeSets']
>[number];

function machineEvents(
	machine: Machine,
	{ originalEntity, payload, type }: OutboxChangeSet
): RealtimeOutboxPayload[] {
	if (type === ChangeSetType.CREATE) {
		return [
			{ topic: MachineEvents.CREATED, machine: MachineDto.from(machine) },
		];
	}
	if (type !== ChangeSetType.UPDATE || !originalEntity) return [];
	const events: RealtimeOutboxPayload[] = [];
	if ('state' in payload && isMachineState(originalEntity.state)) {
		events.push({
			topic: MachineEvents.STATE_UPDATED,
			machine: MachineDto.from(machine),
			oldState: originalEntity.state,
			newState: machine.state,
		});
	}
	if (
		'unschedulable' in payload &&
		typeof originalEntity.unschedulable === 'boolean'
	) {
		events.push({
			topic: MachineEvents.UNSCHEDULABLE_UPDATED,
			machine: MachineDto.from(machine),
			oldUnschedulable: originalEntity.unschedulable,
			newUnschedulable: machine.unschedulable,
		});
	}
	return events;
}

function volumeEvents(
	volume: Volume,
	{ originalEntity, payload, type }: OutboxChangeSet
): RealtimeOutboxPayload[] {
	if (type === ChangeSetType.CREATE) {
		return [{ topic: VolumeEvents.CREATED, volume: VolumeDto.from(volume) }];
	}
	if (type !== ChangeSetType.UPDATE || !originalEntity) return [];
	const events: RealtimeOutboxPayload[] = [];
	if ('state' in payload && isVolumeState(originalEntity.state)) {
		events.push({
			topic: VolumeEvents.STATE_UPDATED,
			volume: VolumeDto.from(volume),
			oldState: originalEntity.state,
			newState: volume.state,
		});
	}
	if ('lastUsedAt' in payload) {
		events.push({
			topic: VolumeEvents.LAST_USED_AT_UPDATED,
			volume: VolumeDto.from(volume),
		});
	}
	return events;
}

function outboxEvents(changeSet: OutboxChangeSet): RealtimeOutboxPayload[] {
	const { entity } = changeSet;
	if (entity instanceof Machine) return machineEvents(entity, changeSet);
	if (entity instanceof Volume) return volumeEvents(entity, changeSet);
	return [];
}

@Injectable()
export class RealtimeOutboxSubscriber implements EventSubscriber {
	constructor(entityManager: EntityManager) {
		entityManager.getEventManager().registerSubscriber(this);
	}

	onFlush({ uow }: FlushEventArgs): void {
		for (const changeSet of [...uow.getChangeSets()]) {
			for (const event of outboxEvents(changeSet)) {
				uow.computeChangeSet(
					new RealtimeOutboxEvent(event, changeSet.entity.id),
					ChangeSetType.CREATE
				);
			}
		}
	}
}
