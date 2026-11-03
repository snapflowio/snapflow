/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { InternalServerErrorException } from '@nestjs/common';
import { EDGE_CONTROL_LIMITS } from '../../constants/edge.constants';
import { SYSTEM_EXPOSURE_SERVICE } from '../../constants/exposure.constants';
import { NETWORK_PROTOCOL } from '../../constants/networking.constants';
import type {
	EdgeHttpRouteDto,
	EdgeMachineBindingDto,
	EdgeRouteBaseDto,
	EdgeTcpRouteDto,
	EdgeUdpRouteDto,
} from '../../dto/edge-route-snapshot.dto';
import type { Exposure } from '../../entities/exposure.entity';
import type { ExposureBackend } from '../../entities/exposure-backend.entity';
import type { MachineEdgeBinding } from '../../entities/machine-edge-binding.entity';

export interface EdgeRouteSource {
	backend: ExposureBackend;
	exposure: Exposure;
}

export interface EdgeRouteLists {
	httpRoutes: EdgeHttpRouteDto[];
	tcpRoutes: EdgeTcpRouteDto[];
	udpRoutes: EdgeUdpRouteDto[];
}

export function edgeRouteLists(
	sources: readonly EdgeRouteSource[],
	liveBindingIds: ReadonlySet<string>,
	customHostnamesByExposure: ReadonlyMap<string, readonly string[]>,
	requireTrustedProxy: boolean
): EdgeRouteLists {
	const lists: EdgeRouteLists = {
		httpRoutes: [],
		tcpRoutes: [],
		udpRoutes: [],
	};
	for (const { backend, exposure } of sources) {
		if (!liveBindingIds.has(backend.bindingId)) {
			throw new InternalServerErrorException(
				`Exposure backend ${backend.id} has no live machine binding`
			);
		}
		const route = routeBase(backend, exposure);
		const policy = exposure.policy;
		if (policy.protocol !== backend.protocol) {
			throw inconsistentPolicy(backend.id);
		}
		switch (policy.protocol) {
			case NETWORK_PROTOCOL.HTTP:
				lists.httpRoutes.push({
					...route,
					protocol: NETWORK_PROTOCOL.HTTP,
					trafficWeight: EDGE_CONTROL_LIMITS.defaultHttpTrafficWeight,
					hostnames: httpHostnames(
						backend,
						exposure,
						customHostnamesByExposure.get(exposure.id) ?? []
					),
					policy: {
						visibility: policy.visibility,
						path: policy.path,
						stripPath: policy.stripPath,
						forceHttps: policy.forceHttps,
						requireTrustedProxy,
						maxBodyBytes: policy.maxBodyBytes,
						readTimeoutSeconds: policy.readTimeoutSeconds,
						sendTimeoutSeconds: policy.sendTimeoutSeconds,
						retries: policy.retries,
						streaming: policy.streaming,
						upstreamProtocol: policy.upstreamProtocol,
						allowedOrigins: policy.allowedOrigins,
						allowCredentials: policy.allowCredentials,
						showBrowserWarning: policy.showBrowserWarning,
					},
				});
				break;
			case NETWORK_PROTOCOL.TCP:
				lists.tcpRoutes.push({
					...route,
					protocol: NETWORK_PROTOCOL.TCP,
					publicPort: publicPort(backend),
					policy: {
						proxyProtocol: policy.proxyProtocol,
						idleTimeoutSeconds: policy.idleTimeoutSeconds,
						connectionLimit: policy.connectionLimit,
					},
				});
				break;
			case NETWORK_PROTOCOL.UDP:
				lists.udpRoutes.push({
					...route,
					protocol: NETWORK_PROTOCOL.UDP,
					publicPort: publicPort(backend),
					policy: {
						idleTimeoutSeconds: policy.idleTimeoutSeconds,
						flowLimit: policy.flowLimit,
						packetsPerSecond: policy.packetsPerSecond,
						maximumDatagramPayloadBytes: policy.maximumDatagramPayloadBytes,
					},
				});
				break;
		}
	}
	return lists;
}

export function edgeMachineBindingDto(
	binding: MachineEdgeBinding
): EdgeMachineBindingDto {
	return {
		machineId: binding.machineId,
		machineSessionGeneration: binding.machineSessionGeneration,
		bindingId: binding.id,
		bindingRevision: binding.revision,
		bindingDigest: binding.digest,
		leaseExpiresAt: binding.leaseExpiresAt.toISOString(),
	};
}

function routeBase(
	backend: ExposureBackend,
	exposure: Exposure
): EdgeRouteBaseDto {
	return {
		backendId: backend.id,
		state: backend.state,
		machineId: backend.machineId,
		ownerId: exposure.organizationId,
		bindingId: backend.bindingId,
		interactive:
			exposure.systemService === SYSTEM_EXPOSURE_SERVICE.TERMINAL ||
			exposure.systemService === SYSTEM_EXPOSURE_SERVICE.DESKTOP,
		assignmentGeneration: backend.assignmentGeneration,
		exposureGeneration: backend.exposureGeneration,
		sandboxId: backend.sandboxId,
		exposureId: exposure.id,
		exposureName: exposure.name,
		publicHost: backend.publicHost,
		targetHost: exposure.targetHost,
		targetPort: backend.targetPort,
		leaseExpiresAt: backend.leaseExpiresAt.toISOString(),
	};
}

function httpHostnames(
	backend: ExposureBackend,
	exposure: Exposure,
	customHostnames: readonly string[]
): string[] {
	const hostnames = [
		backend.publicHost,
		exposure.platformHostname,
		exposure.originHostname,
		...customHostnames,
	].filter((value): value is string => value !== null && value.length > 0);
	const uniqueHostnames = [
		...new Set(hostnames.map((value) => value.toLowerCase())),
	].sort();
	if (
		uniqueHostnames.length === 0 ||
		uniqueHostnames.length > EDGE_CONTROL_LIMITS.maximumHostnamesPerHttpRoute
	) {
		throw new InternalServerErrorException(
			`HTTP exposure backend ${backend.id} has an invalid hostname set`
		);
	}
	return uniqueHostnames;
}

function publicPort(backend: ExposureBackend): number {
	if (backend.publicPort === null) throw inconsistentPolicy(backend.id);
	return backend.publicPort;
}

function inconsistentPolicy(backendId: string): InternalServerErrorException {
	return new InternalServerErrorException(
		`Exposure backend ${backendId} has inconsistent protocol policy`
	);
}
