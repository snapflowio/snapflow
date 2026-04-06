/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Search, X } from 'lucide-react';
import { memo, type ReactNode, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface SearchConfig {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
}

export interface FilterTag {
	label: string;
	onRemove: () => void;
}

interface ResourceOptionsBarProps {
	search?: SearchConfig;
	filterTags?: FilterTag[];
	filter?: ReactNode;
	extras?: ReactNode;
}

export const ResourceOptionsBar = memo(function ResourceOptionsBar({
	search,
	filterTags,
	filter,
	extras,
}: ResourceOptionsBarProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const hasContent =
		search || filter || extras || (filterTags && filterTags.length > 0);

	if (!hasContent) {
		return null;
	}

	return (
		<div
			className={cn(
				'shrink-0 border-border border-b py-2.5',
				search ? 'px-6' : 'px-4'
			)}
		>
			<div className="flex items-center justify-between">
				{search && (
					<div className="relative flex flex-1 items-center">
						<Search className="pointer-events-none h-3.5 w-3.5 shrink-0 text-text-icon" />
						<input
							ref={inputRef}
							type="text"
							value={search.value}
							onChange={(e) => search.onChange(e.target.value)}
							placeholder={search.placeholder ?? 'Search...'}
							className="min-w-20 flex-1 bg-transparent py-1 pl-2.5 text-[12px] text-text-secondary outline-none placeholder:text-text-subtle"
						/>
						{search.value && (
							<button
								type="button"
								className="mr-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center text-text-subtle transition-colors hover:text-text-secondary"
								onClick={() => search.onChange('')}
							>
								<X className="h-3 w-3" />
							</button>
						)}
					</div>
				)}
				<div className="flex items-center gap-1.5">
					{extras}
					{filterTags?.map((tag) => (
						<button
							key={tag.label}
							type="button"
							className="flex items-center rounded-[5px] px-2 py-1 font-season text-[12px] text-text-body transition-colors hover:bg-surface-active"
							onClick={tag.onRemove}
						>
							{tag.label}
							<span className="ml-1 text-[10px] text-text-icon">✕</span>
						</button>
					))}
					{filter}
				</div>
			</div>
		</div>
	);
});
