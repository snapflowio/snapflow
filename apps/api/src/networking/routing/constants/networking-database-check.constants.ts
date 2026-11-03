/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EDGE_STATUS } from './edge.constants';
import {
	CUSTOM_DOMAIN_STATE,
	EXPOSURE_BACKEND_STATE,
	EXPOSURE_DESIRED_STATE,
	EXPOSURE_KIND,
	EXPOSURE_OBSERVED_STATE,
	EXPOSURE_TARGET_HOST,
	EXPOSURE_VISIBILITY,
	SYSTEM_EXPOSURE_SERVICE,
} from './exposure.constants';
import {
	MACHINE_EDGE_BINDING_DESIRED_STATE,
	MACHINE_EDGE_BINDING_STATE,
	TUNNEL_CARRIER,
} from './machine-tunnel.constants';
import { NETWORK_PROTOCOL, NETWORK_PROTOCOLS } from './networking.constants';

const sqlStringList = (values: readonly string[]) =>
	values.map((value) => `'${value}'`).join(', ');

export const NETWORKING_DATABASE_CHECK = {
	edgeStatus: `"status" IN (${sqlStringList(Object.values(EDGE_STATUS))})`,
	edgeProtocols: `cardinality("supportedProtocols") > 0 AND "supportedProtocols" <@ ARRAY[${sqlStringList(NETWORK_PROTOCOLS)}]::text[]`,
	exposureKind: `"kind" IN (${sqlStringList(Object.values(EXPOSURE_KIND))})`,
	exposureProtocol: `"protocol" IN (${sqlStringList(NETWORK_PROTOCOLS)})`,
	exposureKindProtocol: `
		("kind" = '${EXPOSURE_KIND.HTTP}' AND "protocol" = '${NETWORK_PROTOCOL.HTTP}')
		OR ("kind" = '${EXPOSURE_KIND.TCP}' AND "protocol" = '${NETWORK_PROTOCOL.TCP}')
		OR ("kind" = '${EXPOSURE_KIND.UDP}' AND "protocol" = '${NETWORK_PROTOCOL.UDP}')
		OR "kind" = '${EXPOSURE_KIND.SYSTEM}'
	`,
	exposureVisibility: `
		("kind" IN ('${EXPOSURE_KIND.HTTP}', '${EXPOSURE_KIND.SYSTEM}') AND "visibility" IN (${sqlStringList(Object.values(EXPOSURE_VISIBILITY))}))
		OR ("kind" IN ('${EXPOSURE_KIND.TCP}', '${EXPOSURE_KIND.UDP}') AND "visibility" IS NULL)
	`,
	exposureSystemService: `
		("kind" = '${EXPOSURE_KIND.SYSTEM}' AND "systemService" IN (${sqlStringList(Object.values(SYSTEM_EXPOSURE_SERVICE))}))
		OR ("kind" <> '${EXPOSURE_KIND.SYSTEM}' AND "systemService" IS NULL)
	`,
	exposureTarget: `
		("kind" = '${EXPOSURE_KIND.SYSTEM}' AND "systemService" = '${SYSTEM_EXPOSURE_SERVICE.BUILD_LOGS}' AND "targetHost" = '${EXPOSURE_TARGET_HOST.MACHINE_BUILD_LOGS}' AND (("desiredState" = '${EXPOSURE_DESIRED_STATE.ACTIVE}' AND "targetReference" IS NOT NULL) OR ("desiredState" <> '${EXPOSURE_DESIRED_STATE.ACTIVE}' AND "targetReference" IS NULL)))
		OR ("kind" = '${EXPOSURE_KIND.SYSTEM}' AND "systemService" = '${SYSTEM_EXPOSURE_SERVICE.SSH}' AND "targetHost" = '${EXPOSURE_TARGET_HOST.MACHINE_SSH_GATEWAY}' AND "targetReference" IS NULL)
		OR (NOT ("kind" = '${EXPOSURE_KIND.SYSTEM}' AND "systemService" IN ('${SYSTEM_EXPOSURE_SERVICE.BUILD_LOGS}', '${SYSTEM_EXPOSURE_SERVICE.SSH}')) AND "targetHost" = '${EXPOSURE_TARGET_HOST.RUNTIME}' AND "targetReference" IS NULL)
	`,
	exposureSystemLease: `
		("kind" = '${EXPOSURE_KIND.SYSTEM}' AND (("desiredState" = '${EXPOSURE_DESIRED_STATE.ACTIVE}' AND "systemRequestedUntil" IS NOT NULL) OR ("desiredState" <> '${EXPOSURE_DESIRED_STATE.ACTIVE}' AND "systemRequestedUntil" IS NULL)))
		OR ("kind" <> '${EXPOSURE_KIND.SYSTEM}' AND "systemRequestedUntil" IS NULL)
	`,
	exposureDesiredState: `"desiredState" IN (${sqlStringList(Object.values(EXPOSURE_DESIRED_STATE))})`,
	exposureObservedState: `"observedState" IN (${sqlStringList(Object.values(EXPOSURE_OBSERVED_STATE))})`,
	bindingDesiredState: `"desiredState" IN (${sqlStringList(Object.values(MACHINE_EDGE_BINDING_DESIRED_STATE))})`,
	bindingObservedState: `"observedState" IN (${sqlStringList(Object.values(MACHINE_EDGE_BINDING_STATE))})`,
	bindingCarrier: `"observedCarrier" IS NULL OR "observedCarrier" IN (${sqlStringList(Object.values(TUNNEL_CARRIER))})`,
	backendProtocol: `"protocol" IN (${sqlStringList(NETWORK_PROTOCOLS)})`,
	backendState: `"state" IN (${sqlStringList(Object.values(EXPOSURE_BACKEND_STATE))})`,
	backendCutover: `"cutoverVerifiedAt" IS NULL OR ("cutoverStartedAt" IS NOT NULL AND "dnsActivatedAt" IS NOT NULL AND "cutoverVerifiedAt" >= "cutoverStartedAt")`,
	customDomainState: `"state" IN (${sqlStringList(Object.values(CUSTOM_DOMAIN_STATE))})`,
} as const;
