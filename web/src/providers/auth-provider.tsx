/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { User } from '@snapflow/api-client';
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from 'react';
import { useNavigate } from 'react-router';
import { apiClient } from '@/api/api-client';
import { Path } from '@/constants/paths';
import {
	AuthContext,
	type AuthContextImplementation,
} from '@/context/auth-context';

export function AuthProvider(props: { children: ReactNode }) {
	const authApi = apiClient.authApi;
	const navigate = useNavigate();
	const [user, setUser] = useState<User | null>(null);
	const [isPending, setIsPending] = useState(true);

	useEffect(() => {
		apiClient.onAuthFailure(() => {
			setUser(null);
			navigate(Path.LOGIN, { replace: true });
		});
	}, [navigate]);

	useEffect(() => {
		let cancelled = false;

		authApi
			.getSession()
			.then((res) => {
				if (!cancelled) {
					setUser(res.data);
					setIsPending(false);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setUser(null);
					setIsPending(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, []);

	const signIn = useCallback(
		async (email: string, password: string): Promise<{ error?: string }> => {
			try {
				const res = await authApi.signIn({ email, password });
				setUser(res.data.user);
				return {};
			} catch (error) {
				const message =
					error instanceof Error ? error.message : 'Failed to sign in';
				return { error: message };
			}
		},
		[]
	);

	const signUp = useCallback(
		async (
			name: string,
			email: string,
			password: string
		): Promise<{ error?: string; success?: boolean }> => {
			try {
				await authApi.signUp({ name, email, password });
				return { success: true };
			} catch (error) {
				const message =
					error instanceof Error ? error.message : 'Failed to create account';
				return { error: message };
			}
		},
		[]
	);

	const signOut = useCallback(async () => {
		await authApi.signOut();
		setUser(null);
	}, []);

	const updateUser = useCallback(
		async (name: string): Promise<{ error?: string }> => {
			try {
				const res = await authApi.updateUser({ name });
				setUser(res.data);
				return {};
			} catch (error) {
				const message =
					error instanceof Error ? error.message : 'Failed to update profile';
				return { error: message };
			}
		},
		[]
	);

	const contextValue: AuthContextImplementation = useMemo(
		() => ({
			user,
			token: null,
			isPending,
			signIn,
			signUp,
			signOut,
			updateUser,
		}),
		[user, isPending, signIn, signUp, signOut, updateUser]
	);

	return (
		<AuthContext.Provider value={contextValue}>
			{props.children}
		</AuthContext.Provider>
	);
}
