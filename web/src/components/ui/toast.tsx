/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { X } from 'lucide-react';
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

const DEFAULT_AUTO_DISMISS_MS = 5000;
const EXIT_ANIMATION_MS = 200;
const MAX_VISIBLE = 20;

type ToastVariant = 'default' | 'success' | 'error';

interface ToastAction {
	label: string;
	onClick: () => void;
}

interface ToastData {
	id: string;
	message: string;
	description?: string;
	variant: ToastVariant;
	action?: ToastAction;
	duration: number;
}

type ToastInput = {
	message: string;
	description?: string;
	variant?: ToastVariant;
	action?: ToastAction;
	duration?: number;
};

type ToastFn = {
	(input: ToastInput): string;
	success: (
		message: string,
		options?: Omit<ToastInput, 'message' | 'variant'>
	) => string;
	error: (
		message: string,
		options?: Omit<ToastInput, 'message' | 'variant'>
	) => string;
};

interface ToastContextValue {
	toast: ToastFn;
	dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let globalToast: ToastFn | null = null;

function createToastFn(add: (input: ToastInput) => string): ToastFn {
	const fn = ((input: ToastInput) => add(input)) as ToastFn;
	fn.success = (message, options) =>
		add({ ...options, message, variant: 'success' });
	fn.error = (message, options) =>
		add({ ...options, message, variant: 'error' });
	return fn;
}

/**
 * Imperative toast function. Requires `<ToastProvider>` to be mounted.
 *
 * @example
 * ```tsx
 * toast.success('Item restored', { action: { label: 'View', onClick: () => router.push('/item') } })
 * toast.error('Something went wrong')
 * toast({ message: 'Hello', variant: 'default' })
 * ```
 */
export const toast: ToastFn = createToastFn((input) => {
	if (!globalToast) {
		throw new Error('toast() called before <ToastProvider> mounted');
	}
	return globalToast(input);
});

/**
 * Hook to access the toast function from context.
 */
export function useToast() {
	const ctx = useContext(ToastContext);
	if (!ctx) {
		throw new Error('useToast must be used within <ToastProvider>');
	}

	return ctx;
}

const VARIANT_STYLES: Record<ToastVariant, string> = {
	default: 'border-(--border) bg-(--bg) text-(--text-primary)',
	success:
		'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-200',
	error:
		'border-red-200 bg-red-50 text-red-900 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-200',
};

function ToastItem({
	toast: t,
	onDismiss,
}: {
	toast: ToastData;
	onDismiss: (id: string) => void;
}) {
	const [exiting, setExiting] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	const dismiss = useCallback(() => {
		setExiting(true);
		setTimeout(() => onDismiss(t.id), EXIT_ANIMATION_MS);
	}, [onDismiss, t.id]);

	useEffect(() => {
		if (t.duration > 0) {
			timerRef.current = setTimeout(dismiss, t.duration);
			return () => clearTimeout(timerRef.current);
		}
	}, [dismiss, t.duration]);

	return (
		<div
			className={cn(
				'pointer-events-auto flex w-[320px] items-start gap-2 rounded-lg border px-3 py-2.5 shadow-md transition-all',
				VARIANT_STYLES[t.variant],
				exiting
					? 'animate-[toast-exit_200ms_ease-in_forwards]'
					: 'animate-[toast-enter_200ms_ease-out_forwards]'
			)}
		>
			<div className="min-w-0 flex-1">
				<p className="font-medium text-[13px] leading-4.5">{t.message}</p>
				{t.description && (
					<p className="mt-0.5 text-[12px] leading-4 opacity-80">
						{t.description}
					</p>
				)}
			</div>
			{t.action && (
				<button
					type="button"
					onClick={() => {
						t.action?.onClick();
						dismiss();
					}}
					className="shrink-0 font-medium text-[13px] underline underline-offset-2 opacity-90 hover:opacity-100"
				>
					{t.action.label}
				</button>
			)}
			<button
				type="button"
				onClick={dismiss}
				className="shrink-0 rounded-sm p-0.5 opacity-60 hover:opacity-100"
			>
				<X className="h-3.5 w-3.5" />
			</button>
		</div>
	);
}

/**
 * Toast container that renders toasts via portal.
 * Mount once in your root layout.
 *
 * @example
 * ```tsx
 * <ToastProvider />
 * ```
 */
export function ToastProvider({
	children,
	duration = DEFAULT_AUTO_DISMISS_MS,
}: {
	children?: ReactNode;
	duration?: number;
}) {
	const [toasts, setToasts] = useState<ToastData[]>([]);
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	const addToast = useCallback(
		(input: ToastInput): string => {
			const id = crypto.randomUUID();
			const data: ToastData = {
				id,
				message: input.message,
				description: input.description,
				variant: input.variant ?? 'default',
				action: input.action,
				duration: input.duration ?? duration,
			};

			setToasts((prev) => [...prev, data].slice(-MAX_VISIBLE));
			return id;
		},
		[duration]
	);

	const dismissToast = useCallback((id: string) => {
		setToasts((prev) => prev.filter((t) => t.id !== id));
	}, []);

	const toastFn = useRef<ToastFn>(createToastFn(addToast));

	useEffect(() => {
		toastFn.current = createToastFn(addToast);
		globalToast = toastFn.current;
		return () => {
			globalToast = null;
		};
	}, [addToast]);

	const ctx = useMemo<ToastContextValue>(
		() => ({ toast: toastFn.current, dismiss: dismissToast }),
		[dismissToast]
	);

	return (
		<ToastContext.Provider value={ctx}>
			{children}
			{mounted &&
				createPortal(
					<div
						aria-live="polite"
						className="pointer-events-none fixed right-4 bottom-4 z-10000400 flex flex-col-reverse items-end gap-2"
					>
						{toasts.map((t) => (
							<ToastItem key={t.id} toast={t} onDismiss={dismissToast} />
						))}
					</div>,
					document.body
				)}
		</ToastContext.Provider>
	);
}
