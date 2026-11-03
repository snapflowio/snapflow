/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { RequestContext } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	ConflictException,
	Logger,
	OnModuleInit,
	UnauthorizedException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
	OnGatewayInit,
	WebSocketGateway,
	WebSocketServer,
} from '@nestjs/websockets';
import { ORGANIZATION_CONTEXT_HEADER } from '@snapflow/organization-access';
import {
	type ExtendedError,
	type RemoteSocket,
	Server,
	Socket,
} from 'socket.io';
import { AuthAddonService } from '../../../auth/services/auth-addon.service';
import { assertOrganizationContext } from '../../../auth/utils/organization-context.util';
import {
	AUTH_CREDENTIAL_TYPES,
	isOrganizationAuthContext,
} from '../../../common/types/organization-auth-context.types';
import { TypedConfigService } from '../../../config/services/typed-config.service';
import { OrganizationEvents } from '../../../organization/tenant/constants/organization-events.constants';
import type { OrganizationActiveChangedEvent } from '../../../organization/tenant/events/organization-active-changed.event';
import { NOTIFICATION_LIMITS } from '../../transport/constants/notification.constants';
import {
	credentialRoom,
	isOrganizationScopedRoom,
	memberRoom,
	type NotificationBroadcast,
	type NotificationCredential,
	NotificationEmitter,
	organizationRoom,
	userRoom,
} from '../../transport/gateways/notification-emitter.abstract';
import { NotificationConnectionsService } from '../../transport/services/notification-connections.service';
import { NotificationRedisService } from '../../transport/services/notification-redis.service';

interface NotificationAuthorization {
	userId: string;
	organizationId: string;
	credential: NotificationCredential;
}

interface NotificationSocketData
	extends Omit<NotificationAuthorization, 'organizationId'> {
	releaseConnection: () => void;
	stopRevalidation: () => void;
}

type NotificationSocket = Socket<never, never, never, NotificationSocketData>;
type OrganizationRoomMember = Pick<
	RemoteSocket<never, NotificationSocketData>,
	'rooms' | 'join' | 'leave'
>;

@WebSocketGateway({
	path: '/api/realtime/',
	transports: ['websocket'],
	maxHttpBufferSize: NOTIFICATION_LIMITS.maximumInboundMessageBytes,
	perMessageDeflate: false,
})
export class NotificationGateway
	extends NotificationEmitter
	implements OnGatewayInit, OnModuleInit
{
	private readonly logger = new Logger(NotificationGateway.name);

	@WebSocketServer()
	server: Server;

	constructor(
		private readonly entityManager: EntityManager,
		private readonly authAddonService: AuthAddonService,
		private readonly configService: TypedConfigService,
		private readonly connections: NotificationConnectionsService,
		private readonly notificationRedis: NotificationRedisService
	) {
		super();
	}

	async onModuleInit(): Promise<void> {
		this.server.adapter(await this.notificationRedis.createSocketAdapter());
		this.logger.debug('Socket.io initialized with Redis adapter');
	}

	afterInit(server: Server) {
		this.logger.debug('WebSocket Gateway initialized');

		server.use((socket: NotificationSocket, next) => {
			void this.admit(socket).then(
				() => next(),
				(error: unknown) => {
					this.logger.warn('WebSocket authentication failed', error);
					next(handshakeError(error));
				}
			);
		});
	}

	private async admit(socket: NotificationSocket): Promise<void> {
		let releaseConnection: (() => void) | undefined;
		let stopRevalidation: (() => void) | undefined;
		try {
			const authorization = await this.withRequestContext(() =>
				this.authorize(socket)
			);
			if (authorization.credential.type === AUTH_CREDENTIAL_TYPES.SESSION) {
				assertOrganizationContext(
					socket.handshake.auth[ORGANIZATION_CONTEXT_HEADER],
					authorization.organizationId
				);
			}
			releaseConnection = this.connections.acquire(authorization.userId);
			stopRevalidation = this.startRevalidation(socket, authorization);
			socket.data = {
				userId: authorization.userId,
				credential: authorization.credential,
				releaseConnection,
				stopRevalidation,
			};
			socket.conn.once('close', releaseConnection);
			socket.conn.once('close', stopRevalidation);
			await socket.join([
				userRoom(authorization.userId),
				credentialRoom(authorization.credential),
				...organizationRooms(authorization),
			]);
		} catch (error) {
			stopRevalidation?.();
			releaseConnection?.();
			throw error;
		}
	}

	protected broadcast(room: string): NotificationBroadcast {
		return this.server.to(room);
	}

	@OnEvent(OrganizationEvents.ACTIVE_CHANGED)
	async handleActiveOrganizationChanged(
		event: OrganizationActiveChangedEvent
	): Promise<void> {
		const sockets = await this.server
			.in(
				credentialRoom({
					type: AUTH_CREDENTIAL_TYPES.SESSION,
					id: event.sessionId,
				})
			)
			.fetchSockets();
		for (const socket of sockets) {
			moveToOrganization(socket, event);
		}
	}

	private async authorize(
		socket: NotificationSocket
	): Promise<NotificationAuthorization> {
		const token =
			typeof socket.handshake.auth.token === 'string'
				? socket.handshake.auth.token.trim()
				: '';

		if (token) {
			const user = await this.authAddonService.authenticateApiKeyToken(token);
			if (!isOrganizationAuthContext(user)) throw new UnauthorizedException();
			return toAuthorization(user);
		}

		this.assertTrustedOrigin(socket);
		const session = await this.authAddonService.getSessionAuthContext(
			socket.request.headers
		);
		if (!session) throw new UnauthorizedException();
		return toAuthorization(session.user);
	}

	private assertTrustedOrigin(socket: NotificationSocket): void {
		const origin = socket.handshake.headers.origin;
		const trustedOrigins = new Set(
			this.configService.get('trustedBrowserOrigins')
		);
		if (!origin || !trustedOrigins.has(origin))
			throw new UnauthorizedException();
	}

	private startRevalidation(
		socket: NotificationSocket,
		authorization: NotificationAuthorization
	): () => void {
		let revalidating = false;
		const timer = setInterval(() => {
			if (revalidating || !socket.connected) return;
			revalidating = true;
			void this.withRequestContext(() => this.authorize(socket))
				.then((current) => {
					if (
						current.userId !== authorization.userId ||
						current.credential.type !== authorization.credential.type ||
						current.credential.id !== authorization.credential.id
					) {
						socket.disconnect(true);
						return;
					}
					moveToOrganization(socket, current);
				})
				.catch((error: unknown) => {
					this.logger.warn(
						`WebSocket authorization revalidation failed for ${socket.id}`,
						error
					);
					socket.disconnect(true);
				})
				.finally(() => {
					revalidating = false;
				});
		}, NOTIFICATION_LIMITS.authorizationRevalidationMilliseconds);
		timer.unref();
		return () => clearInterval(timer);
	}

	private withRequestContext<T>(work: () => Promise<T>): Promise<T> {
		return RequestContext.create(this.entityManager, work);
	}
}

function toAuthorization({
	userId,
	organizationId,
	credential,
}: NotificationAuthorization): NotificationAuthorization {
	return {
		userId,
		organizationId,
		credential: { type: credential.type, id: credential.id },
	};
}

function moveToOrganization(
	socket: OrganizationRoomMember,
	target: Pick<NotificationAuthorization, 'organizationId' | 'userId'>
): void {
	const rooms = organizationRooms(target);
	for (const room of [...socket.rooms]) {
		if (isOrganizationScopedRoom(room) && !rooms.includes(room)) {
			socket.leave(room);
		}
	}
	socket.join(rooms);
}

function organizationRooms({
	organizationId,
	userId,
}: Pick<NotificationAuthorization, 'organizationId' | 'userId'>): string[] {
	return [organizationRoom(organizationId), memberRoom(organizationId, userId)];
}

function handshakeError(error: unknown): ExtendedError {
	if (error instanceof ConflictException) {
		return Object.assign(new Error(error.message), {
			data: error.getResponse(),
		});
	}
	return new UnauthorizedException();
}
