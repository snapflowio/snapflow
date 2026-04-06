/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import { BrowserRouter } from 'react-router';
import { ToastProvider } from '@/components/ui';
import App from './App';
import { AuthProvider } from './providers/auth-provider';
import { ErrorBoundaryProvider } from './providers/error-boundary';
import { PosthogProvider } from './providers/posthog-provider';
import './global.css';

const root = ReactDOM.createRoot(
	document.getElementById('root') as HTMLElement
);

root.render(
	<React.StrictMode>
		<ErrorBoundary FallbackComponent={ErrorBoundaryProvider}>
			<PosthogProvider>
				<BrowserRouter>
					<ToastProvider>
						<AuthProvider>
							<App />
						</AuthProvider>
					</ToastProvider>
				</BrowserRouter>
			</PosthogProvider>
		</ErrorBoundary>
	</React.StrictMode>
);
