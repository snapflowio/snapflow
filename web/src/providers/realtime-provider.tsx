/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { RealtimeContext } from '@/context/realtime-context';
import { env } from '@/env';
import { useAuth } from '@/hooks/use-auth';

export function RealtimeProvider(props: { children: ReactNode }) {
	const { user } = useAuth();
	const [organizationId, setOrganizationId] = useState<string | null>(() =>
		localStorage.getItem('organization')
	);

	const socketRef = useRef<Socket | null>(null);
	const [socket, setSocket] = useState<Socket | null>(null);

	useEffect(() => {
		const handleStorageChange = () => {
			const newOrgId = localStorage.getItem('organization');
			setOrganizationId(newOrgId);
		};

		window.addEventListener('storage', handleStorageChange);

		return () => {
			window.removeEventListener('storage', handleStorageChange);
		};
	}, []);

	useEffect(() => {
		if (!user || !organizationId) {
			socketRef.current?.disconnect();
			socketRef.current = null;
			setSocket(null);
			return;
		}

		socketRef.current?.disconnect();

		const newSocket = io(env.VITE_API_URL.replace('/api', ''), {
			path: '/api/realtime',
			autoConnect: true,
			transports: ['websocket'],
			withCredentials: true,
			query: {
				organizationId,
			},
		});

		socketRef.current = newSocket;
		setSocket(newSocket);

		return () => {
			newSocket.disconnect();
		};
	}, [user, organizationId]);

	return (
		<RealtimeContext.Provider value={{ realtimeSocket: socket }}>
			{props.children}
		</RealtimeContext.Provider>
	);
}
