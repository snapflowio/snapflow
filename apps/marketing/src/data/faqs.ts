/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const FAQS = [
	[
		'Who operates Snapflow?',
		'Hosts list their machines and set their own prices. Each listing shows the host, tier, reliability, and benchmark scores. Snapflow operates the marketplace and the control plane that connects machines, records usage, and coordinates recovery.',
	],
	[
		'How do I choose where a workload runs?',
		'Enter the CPU, memory, storage, and GPU it needs. Snapflow shows the machines that can fit it right now, each with one all-in hourly price, and you pick one. From the API or SDK, you can instead set a category, minimum tier, and max price, and Snapflow places it on the best machine nearest to you, or only in the continents or countries you choose.',
	],
	[
		'What do Community, Verified, and Datacenter mean?',
		'Every public machine is benchmarked before it is listed and spot-checked after. Community machines have passed those checks. Verified machines have also held 99% uptime for 30 days. Datacenter machines have passed a manual review.',
	],
	[
		'What happens when a machine goes offline?',
		'If you picked the machine, you can wait for it to come back or move the workload to a matching machine from its latest backup. Workloads placed through the API move on their own. Persistent workloads recover from snapshots and verified backups.',
	],
	[
		"How are workloads isolated on someone else's machine?",
		'Each workload runs in its own microVM, on its own physical CPU cores, with its own network that reaches the internet but not the machine, its local network, or other workloads unless you link them. The hypervisor itself runs in a locked-down jail. This is not confidential computing: the host operating the machine can technically access what runs on it, so do not run workloads that need confidentiality from the host, and encrypt sensitive data.',
	],
	[
		'How do pricing and payments work?',
		"Every machine shows one all-in hourly price before you start, and that price is locked once the workload is placed. Usage is recorded by the second and paid from prepaid credit in US dollars. Add credit by card through Stripe from $10, or turn on auto top-up. The price includes a 25% platform fee on top of the host's rate.",
	],
	[
		'How do hosts get paid?',
		'Hosts set their own rates and keep all of them; the 25% platform fee is added on top for the customer. Earnings are recorded in US dollars, held for 14, 7, or 3 days depending on the machine tier, then paid out through Stripe every Monday once the balance reaches $50. Hosts in the US, UK, EEA, Canada, and Switzerland can receive payouts.',
	],
	[
		'What does a machine need to be listed?',
		'Linux (Debian, Ubuntu, Fedora, or RHEL-compatible) on x86_64 or arm64 with KVM, kernel 6.2 or newer with Landlock, systemd, cgroup v2, and nftables; macOS is not supported. It also needs at least 200 Mbps down and 100 Mbps up, and a disk with at least 20,000 random-read IOPS and 500 MiB/s sequential throughput. GPUs need IOMMU and the NVIDIA driver. Payouts need a Stripe account in the US, UK, EEA, Canada, or Switzerland. Run sudo snapflow doctor to check a machine before you list it.',
	],
] as const;
