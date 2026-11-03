/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash } from 'node:crypto';
import { canonicalJson } from '../../../../common/utils/canonical-json.util';
import type { MachineTunnelTargetDto } from '../../dto/machine-tunnel-plan.dto';
import { sortByBackendId } from '../exposure/backend-order.util';

type MachineBindingTarget = Pick<
	MachineTunnelTargetDto,
	| 'backendId'
	| 'exposureId'
	| 'exposureGeneration'
	| 'sandboxId'
	| 'assignmentGeneration'
	| 'placementFencingTokenHash'
	| 'protocol'
	| 'targetHost'
	| 'targetReference'
	| 'guestService'
	| 'targetPort'
>;

export function machineBindingDigest(
	machineId: string,
	edgeId: string,
	machineSessionGeneration: number,
	revision: number
): string {
	const document = {
		machineId,
		edgeId,
		machineSessionGeneration,
		revision,
	};
	return digest(document);
}

export function machineTargetPlanDigest(
	bindingId: string,
	bindingRevision: number,
	targetRevision: number,
	targets: readonly MachineBindingTarget[]
): string {
	const document = {
		bindingId,
		bindingRevision,
		targetRevision,
		targets: sortByBackendId(targets).map((target) => ({
			backendId: target.backendId,
			exposureId: target.exposureId,
			exposureGeneration: target.exposureGeneration,
			sandboxId: target.sandboxId,
			assignmentGeneration: target.assignmentGeneration,
			placementFencingTokenHash: target.placementFencingTokenHash,
			protocol: target.protocol,
			targetHost: target.targetHost,
			...(target.targetReference === undefined
				? {}
				: { targetReference: target.targetReference }),
			...(target.guestService === undefined
				? {}
				: { guestService: target.guestService }),
			targetPort: target.targetPort,
		})),
	};
	return digest(document);
}

function digest(document: object): string {
	return createHash('sha256').update(canonicalJson(document)).digest('hex');
}
