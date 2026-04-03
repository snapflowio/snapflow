/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

type FaqItem = {
	question: string;
	answer: string;
};

export const faqItems: FaqItem[] = [
	{
		question: 'How does Snapflow pricing work?',
		answer:
			"Snapflow uses simple pay-as-you-go pricing. Add funds to your wallet and pay only for what you use, billed per minute. Pricing: $0.04/vCPU-hour ($0.000667/min), $0.005/GB RAM-hour ($0.000083/min), $0.0005/GB disk-hour ($0.0000083/min). For example, a 4 vCPU, 8 GB RAM, 30 GB disk sandbox costs ~$0.215/hour or ~$154.80/month if run 24/7. No subscriptions, no commitments - top up your wallet and you're ready to go.",
	},
	{
		question: 'What resources can I configure for my sandboxes?',
		answer:
			'Sandboxes are fully customizable. You can configure CPU cores (1-12+), RAM (2-24+ GB), and disk storage (10-100+ GB) based on your needs. Common configurations: Small (4 CPU, 8 GB, 30 GB disk) for ~$0.22/hour, Medium (8 CPU, 16 GB, 60 GB) for ~$0.43/hour, Large (12 CPU, 24 GB, 90 GB) for ~$0.65/hour. Pay only for the exact resources you allocate, billed per minute.',
	},
	{
		question: 'What happens when my wallet balance runs out?',
		answer:
			"When your wallet balance reaches $0, your organization is suspended and all sandboxes are automatically stopped to prevent charges. Simply top up your wallet with any amount (minimum $10) to restore service immediately. We send low-balance warnings when your balance drops below $5 so you have time to add funds. No surprise bills - you can only spend what's in your wallet.",
	},
	{
		question: 'Do I pay for stopped sandboxes?',
		answer:
			"Yes, but only for disk storage. Running sandboxes are charged for CPU, RAM, and disk. Stopped sandboxes are charged only for disk storage at $0.0005/GB-hour ($0.36/GB/month). This allows you to preserve your sandbox state while minimizing costs. Archive or delete sandboxes you're not using to avoid storage charges.",
	},
	{
		question: 'Is there a free tier or trial?',
		answer:
			"Yes! New accounts receive free credits to get started and explore Snapflow. There are no subscriptions or commitments - simply add funds to your wallet when you're ready to continue. You only pay for what you use, making Snapflow affordable for both small projects and production workloads.",
	},
	{
		question: 'How do I add funds to my wallet?',
		answer:
			"Adding funds is simple: go to your organization settings, click 'Add Credits', enter the amount (minimum $10), and complete checkout via our secure payment processor (Polar). Funds are added to your wallet instantly and never expire. You can add any amount between $10 and $10,000 per transaction.",
	},
	{
		question: 'How secure and isolated are the sandboxes?',
		answer:
			"Each sandbox is completely isolated by design, ensuring your workloads run securely without affecting other environments. Sandboxes are ephemeral by default, with data automatically deleted upon termination unless otherwise configured. Your sandbox cannot access other customers' data or resources.",
	},
	{
		question: 'How quickly can I spin up a sandbox?',
		answer:
			'Sandboxes typically start up in milliseconds to a few seconds. Our infrastructure is optimized for speed, making it perfect for scenarios where you need rapid access to isolated compute environments.',
	},
];
