/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import * as z from 'zod';
import { AuthLayout } from '@/components/layouts/auth-layout';
import { Path } from '@/constants/paths';
import { useAuth } from '@/hooks/use-auth';

const INPUT_CLASS =
	'h-10 rounded-[5px] border border-border-1 bg-surface-2 px-3 font-season text-[14px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-text-icon';

const loginSchema = z.object({
	email: z.string().email('Invalid email address'),
	password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const { user, signIn } = useAuth();
	const returnTo = searchParams.get('returnTo');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isHovered, setIsHovered] = useState(false);

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<LoginFormValues>({
		resolver: zodResolver(loginSchema),
		defaultValues: { email: '', password: '' },
	});

	useEffect(() => {
		if (user) {
			navigate(returnTo || Path.DASHBOARD, { replace: true });
		}
	}, [user, navigate, returnTo]);

	const onSubmit = async (values: LoginFormValues) => {
		setIsLoading(true);
		setError(null);

		const result = await signIn(values.email, values.password);

		if (result.error) {
			setError(result.error);
			setIsLoading(false);
			return;
		}

		setIsLoading(false);
		navigate(returnTo || Path.DASHBOARD);
	};

	return (
		<AuthLayout termsText="signing in">
			<div className="flex flex-col gap-6">
				<div className="flex flex-col gap-2">
					<h1 className="font-[430] font-season text-[28px] text-white leading-[100%] tracking-[-0.02em]">
						Welcome back
					</h1>
					<p className="font-season text-[15px] text-text-icon">
						Sign in to your account to continue
					</p>
				</div>

				{error && (
					<div className="rounded-[5px] border border-red-500/30 bg-red-500/10 px-4 py-3 font-season text-[14px] text-red-400">
						{error}
					</div>
				)}

				<form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<label
							htmlFor="email"
							className="font-season text-[13px] text-text-secondary"
						>
							Email
						</label>
						<input
							id="email"
							type="email"
							placeholder="you@example.com"
							className={INPUT_CLASS}
							{...register('email')}
						/>
						{errors.email && (
							<p className="font-season text-[12px] text-red-400">
								{errors.email.message}
							</p>
						)}
					</div>

					<div className="flex flex-col gap-2">
						<label
							htmlFor="password"
							className="font-season text-[13px] text-text-secondary"
						>
							Password
						</label>
						<input
							id="password"
							type="password"
							placeholder="••••••••"
							className={INPUT_CLASS}
							{...register('password')}
						/>
						{errors.password && (
							<p className="font-season text-[12px] text-red-400">
								{errors.password.message}
							</p>
						)}
					</div>

					<button
						type="submit"
						disabled={isLoading}
						onMouseEnter={() => setIsHovered(true)}
						onMouseLeave={() => setIsHovered(false)}
						className="mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-[5px] border border-[#FFFFFF] bg-[#FFFFFF] font-[430] font-season text-[14px] text-black transition-colors hover:border-[#E0E0E0] hover:bg-[#E0E0E0] disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isLoading ? (
							'Signing in...'
						) : (
							<span className="flex items-center gap-1">
								Sign in
								<span className="inline-flex transition-transform duration-200 group-hover:translate-x-0.5">
									{isHovered ? (
										<ArrowRight className="h-4 w-4" />
									) : (
										<ChevronRight className="h-4 w-4" />
									)}
								</span>
							</span>
						)}
					</button>
				</form>

				<p className="text-center font-season text-[14px] text-text-icon">
					Don't have an account?{' '}
					<Link
						to={Path.SIGNUP}
						className="text-text-primary underline underline-offset-2 hover:text-white"
					>
						Sign up
					</Link>
				</p>
			</div>
		</AuthLayout>
	);
}
