/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { BadgeCheck, ShieldAlert, User } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { apiClient } from '@/api/api-client';
import { Button, Input, Label, toast } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';

const profileSchema = z.object({
	name: z
		.string()
		.min(1, 'Name is required')
		.max(100, 'Name must be 100 characters or fewer'),
});

const passwordSchema = z
	.object({
		currentPassword: z.string().min(1, 'Current password is required'),
		newPassword: z.string().min(8, 'Password must be at least 8 characters'),
		confirmPassword: z.string().min(1, 'Please confirm your new password'),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword'],
	});

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function AccountPage() {
	const { user, updateUser } = useAuth();

	const [profileLoading, setProfileLoading] = useState(false);
	const [passwordLoading, setPasswordLoading] = useState(false);
	const [verificationLoading, setVerificationLoading] = useState(false);

	const {
		register: registerProfile,
		handleSubmit: handleSubmitProfile,
		formState: { errors: profileErrors, isDirty: profileIsDirty },
	} = useForm<ProfileFormValues>({
		resolver: zodResolver(profileSchema),
		defaultValues: { name: user?.name ?? '' },
	});

	const {
		register: registerPassword,
		handleSubmit: handleSubmitPassword,
		reset: resetPassword,
		formState: { errors: passwordErrors },
	} = useForm<PasswordFormValues>({
		resolver: zodResolver(passwordSchema),
		defaultValues: {
			currentPassword: '',
			newPassword: '',
			confirmPassword: '',
		},
	});

	const onSaveProfile = async (values: ProfileFormValues) => {
		setProfileLoading(true);
		const { error } = await updateUser(values.name.trim());
		setProfileLoading(false);
		if (error) {
			toast.error(error);
		} else {
			toast.success('Profile updated');
		}
	};

	const onChangePassword = async (values: PasswordFormValues) => {
		setPasswordLoading(true);
		try {
			await apiClient.authApi.changePassword({
				currentPassword: values.currentPassword,
				newPassword: values.newPassword,
			});
			toast.success('Password changed');
			resetPassword();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : 'Failed to change password'
			);
		} finally {
			setPasswordLoading(false);
		}
	};

	const handleSendVerification = async () => {
		if (!user?.email) {
			return;
		}

		setVerificationLoading(true);

		try {
			await apiClient.authApi.sendVerificationEmail({ email: user.email });
			toast.success('Verification email sent');
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'Failed to send verification email'
			);
		} finally {
			setVerificationLoading(false);
		}
	};

	const initials = user?.name
		? user.name
				.split(' ')
				.map((n) => n[0])
				.join('')
				.toUpperCase()
				.slice(0, 2)
		: 'U';

	return (
		<div className="flex h-full flex-1 flex-col overflow-hidden bg-bg">
			<div className="shrink-0 border-border border-b px-6 py-2.5">
				<div className="flex items-center gap-3">
					<User className="h-3.5 w-3.5 text-text-icon" />
					<h1 className="font-medium text-[14px] text-text-body">Account</h1>
				</div>
			</div>
			<div className="flex-1 overflow-y-auto p-6">
				<div className="mx-auto max-w-2xl space-y-6">
					<div className="rounded-lg border border-border">
						<div className="border-border border-b px-5 py-3">
							<h2 className="font-medium text-[14px] text-text-body">
								Profile
							</h2>
							<p className="mt-0.5 text-[12px] text-text-muted">
								Update your display name.
							</p>
						</div>
						<form onSubmit={handleSubmitProfile(onSaveProfile)}>
							<div className="flex flex-col gap-4 p-5">
								<div className="flex items-center gap-3">
									<div
										className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md font-medium text-[14px] text-white"
										style={{ backgroundColor: 'var(--brand-tertiary-2)' }}
									>
										{initials}
									</div>
									<div className="flex min-w-0 flex-col">
										<span className="truncate font-medium text-[13px] text-text-primary">
											{user?.name}
										</span>
										<span className="truncate text-[11px] text-text-tertiary">
											{user?.email}
										</span>
									</div>
								</div>

								<div className="border-border border-t" />

								<div className="flex flex-col gap-1.5">
									<Label htmlFor="account-name">Name</Label>
									<Input
										id="account-name"
										placeholder="Your name"
										autoComplete="name"
										{...registerProfile('name')}
									/>
									{profileErrors.name && (
										<p className="text-[12px] text-text-error">
											{profileErrors.name.message}
										</p>
									)}
								</div>

								<div className="flex flex-col gap-1.5">
									<Label htmlFor="account-email">Email</Label>
									<div className="relative">
										<Input
											id="account-email"
											value={user?.email ?? ''}
											readOnly={true}
											disabled={true}
											className="pr-8"
										/>
										{user?.emailVerified ? (
											<BadgeCheck className="absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-brand-tertiary-2" />
										) : (
											<ShieldAlert className="absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
										)}
									</div>
									{!user?.emailVerified && (
										<div className="flex items-center justify-between">
											<span className="text-[11px] text-text-muted">
												Email not verified
											</span>
											<button
												type="button"
												onClick={handleSendVerification}
												disabled={verificationLoading}
												className="text-[11px] text-text-secondary underline-offset-2 transition-colors hover:text-text-primary hover:underline disabled:opacity-50"
											>
												{verificationLoading
													? 'Sending...'
													: 'Resend verification'}
											</button>
										</div>
									)}
								</div>
							</div>
							<div className="flex justify-end border-border border-t bg-surface-2 px-5 py-3">
								<Button
									type="submit"
									variant="primary"
									disabled={profileLoading || !profileIsDirty}
								>
									{profileLoading ? 'Saving...' : 'Save'}
								</Button>
							</div>
						</form>
					</div>
					<div className="rounded-lg border border-border">
						<div className="border-border border-b px-5 py-3">
							<h2 className="font-medium text-[14px] text-text-body">
								Password
							</h2>
							<p className="mt-0.5 text-[12px] text-text-muted">
								Change your account password.
							</p>
						</div>
						<form onSubmit={handleSubmitPassword(onChangePassword)}>
							<div className="flex flex-col gap-4 p-5">
								<div className="flex flex-col gap-1.5">
									<Label htmlFor="current-password">Current password</Label>
									<Input
										id="current-password"
										type="password"
										placeholder="••••••••"
										autoComplete="current-password"
										{...registerPassword('currentPassword')}
									/>
									{passwordErrors.currentPassword && (
										<p className="text-[12px] text-text-error">
											{passwordErrors.currentPassword.message}
										</p>
									)}
								</div>
								<div className="flex flex-col gap-1.5">
									<Label htmlFor="new-password">New password</Label>
									<Input
										id="new-password"
										type="password"
										placeholder="••••••••"
										autoComplete="new-password"
										{...registerPassword('newPassword')}
									/>
									{passwordErrors.newPassword && (
										<p className="text-[12px] text-text-error">
											{passwordErrors.newPassword.message}
										</p>
									)}
								</div>
								<div className="flex flex-col gap-1.5">
									<Label htmlFor="confirm-password">Confirm new password</Label>
									<Input
										id="confirm-password"
										type="password"
										placeholder="••••••••"
										autoComplete="new-password"
										{...registerPassword('confirmPassword')}
									/>
									{passwordErrors.confirmPassword && (
										<p className="text-[12px] text-text-error">
											{passwordErrors.confirmPassword.message}
										</p>
									)}
								</div>
							</div>
							<div className="flex justify-end border-border border-t bg-surface-2 px-5 py-3">
								<Button
									type="submit"
									variant="primary"
									disabled={passwordLoading}
								>
									{passwordLoading ? 'Updating...' : 'Update password'}
								</Button>
							</div>
						</form>
					</div>
				</div>
			</div>
		</div>
	);
}
