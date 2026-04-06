/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Loader2, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { apiClient } from '@/api/api-client';
import { AuthLayout } from '@/components/layouts/auth-layout';
import { Path } from '@/constants/paths';
import { useAuth } from '@/hooks/use-auth';

export default function AuthorizePage() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const { user, isPending } = useAuth();
	const [error, setError] = useState<string | null>(null);
	const exchangedRef = useRef(false);

	const sandboxId = searchParams.get('sandbox_id');
	const callbackUrl = searchParams.get('callback_url');
	const state = searchParams.get('state');

	useEffect(() => {
		if (isPending) {
			return;
		}

		if (!user) {
			const returnUrl = `${Path.AUTHORIZE}?${searchParams.toString()}`;
			navigate(`${Path.LOGIN}?returnTo=${encodeURIComponent(returnUrl)}`, {
				replace: true,
			});
			return;
		}

		if (!sandboxId || !callbackUrl || !state) {
			setError('Missing required parameters');
			return;
		}

		if (exchangedRef.current) {
			return;
		}

		exchangedRef.current = true;

		apiClient.oauthApi
			.oauthAuthorize({
				sandboxId,
				redirectUri: callbackUrl,
				state,
				clientId: 'snapflow-proxy',
			})
			.then((response) => {
				const { code } = response.data;
				window.location.href = `${callbackUrl}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
			})
			.catch((err) => {
				exchangedRef.current = false;
				const message =
					err instanceof Error ? err.message : 'Failed to authorize access';
				setError(message);
			});
	}, [user, isPending, sandboxId, callbackUrl, state, navigate, searchParams]);

	if (error) {
		return (
			<AuthLayout>
				<div className="flex flex-col gap-6">
					<div className="flex flex-col items-center gap-3">
						<ShieldCheck className="h-10 w-10 text-red-400" />
						<h1 className="font-[430] font-season text-[28px] text-white leading-[100%] tracking-[-0.02em]">
							Authorization Failed
						</h1>
					</div>

					<div className="rounded-[5px] border border-red-500/30 bg-red-500/10 px-4 py-3 font-season text-[14px] text-red-400">
						{error}
					</div>

					<button
						type="button"
						onClick={() => {
							setError(null);
							exchangedRef.current = false;
						}}
						className="mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-[5px] border border-[#FFFFFF] bg-[#FFFFFF] font-[430] font-season text-[14px] text-black transition-colors hover:border-[#E0E0E0] hover:bg-[#E0E0E0]"
					>
						Try again
					</button>
				</div>
			</AuthLayout>
		);
	}

	return (
		<AuthLayout>
			<div className="flex flex-col items-center gap-4">
				<Loader2 className="h-8 w-8 animate-spin text-text-icon" />
				<p className="font-season text-[15px] text-text-icon">
					Authorizing sandbox access...
				</p>
			</div>
		</AuthLayout>
	);
}
