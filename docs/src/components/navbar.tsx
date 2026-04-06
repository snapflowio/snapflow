'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LanguageDropdown } from '@/components/ui/language-dropdown';
import { Logo } from '@/components/ui/logo';
import { SearchTrigger } from '@/components/ui/search-trigger';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { cn } from '@/lib/utils';

const NAV_TABS = [
	{
		label: 'Documentation',
		href: '/introduction',
		match: (_p: string) => true,
		external: false,
	},
] as const;

export function Navbar() {
	const pathname = usePathname();

	return (
		<nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md backdrop-saturate-150">
			<div className="hidden w-full flex-col lg:flex">
				<div
					className="relative flex h-13 w-full items-center justify-between"
					style={{
						paddingLeft: 'calc(var(--sidebar-offset) + 32px)',
						paddingRight: 'calc(var(--toc-offset) + 60px)',
					}}
				>
					<Link href="/" className="flex min-w-25 items-center">
						<Logo className="h-7 w-auto" />
					</Link>

					<div className="absolute left-1/2 flex -translate-x-1/2 items-center justify-center">
						<SearchTrigger />
					</div>

					<div className="flex items-center gap-1">
						<LanguageDropdown />
						<ThemeToggle />
					</div>
				</div>
				<div
					className="border-b"
					style={{
						marginLeft: 'calc(var(--sidebar-offset) + 32px)',
						marginRight: 'calc(var(--toc-offset) + 60px)',
						borderColor: 'rgba(128, 128, 128, 0.1)',
					}}
				/>
				<div
					className="flex h-10 items-stretch gap-6 border-border/20 border-b"
					style={{
						paddingLeft: 'calc(var(--sidebar-offset) + 32px)',
					}}
				>
					{NAV_TABS.map((tab) => {
						const isActive = !tab.external && tab.match(pathname);
						return (
							<Link
								key={tab.label}
								href={tab.href}
								{...(tab.external
									? { target: '_blank', rel: 'noopener noreferrer' }
									: {})}
								className={cn(
									'relative -mb-px flex items-center border-b text-[14px] tracking-[-0.01em] transition-colors',
									isActive
										? 'border-neutral-400 font-[550] text-neutral-800 dark:border-neutral-500 dark:text-neutral-200'
										: 'border-transparent font-medium text-fd-muted-foreground hover:border-neutral-300 hover:text-neutral-600 dark:hover:border-neutral-600 dark:hover:text-neutral-400'
								)}
							>
								<span className="invisible font-[550]">{tab.label}</span>
								<span className="absolute">{tab.label}</span>
							</Link>
						);
					})}
				</div>
			</div>
		</nav>
	);
}
