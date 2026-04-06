/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { User } from '@snapflow/api-client';
import { createContext } from 'react';

export interface AuthContextImplementation {
	user: User | null;
	token: string | null;
	isPending: boolean;
	signIn: (email: string, password: string) => Promise<{ error?: string }>;
	signUp: (
		name: string,
		email: string,
		password: string
	) => Promise<{ error?: string; success?: boolean }>;
	signOut: () => Promise<void>;
	updateUser: (name: string) => Promise<{ error?: string }>;
}

export const AuthContext = createContext<AuthContextImplementation | undefined>(
	undefined
);
