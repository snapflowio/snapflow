/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { APIRoute } from 'astro';

const ROBOTS_POLICY = `# As a condition of accessing this website, you agree to abide by the following
# content signals:

# (a) If a Content-Signal = yes, you may collect content for the corresponding use.
# (b) If a Content-Signal = no, you may not collect content for the corresponding use.
# (c) If no Content-Signal is present for a use, no permission or restriction is
#     expressed through Content-Signal for that use.

# search: building a search index and providing links and short excerpts.
# ai-input: inputting content into AI models for grounding or generated answers.
# ai-train: training or fine-tuning AI models.
# use: how AI systems may consume content (immediate, reference, or full).

# ANY RESTRICTIONS EXPRESSED VIA CONTENT SIGNALS ARE EXPRESS RESERVATIONS OF
# RIGHTS UNDER ARTICLE 4 OF EU DIRECTIVE 2019/790.

User-agent: *
Content-Signal: search=yes,ai-train=no,use=reference
Allow: /
Disallow: /api/
Disallow: /dashboard/

# Search crawlers
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

# AI search and citation crawlers
User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

# AI training and bulk-content crawlers
User-agent: Amazonbot
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: CloudflareBrowserRenderingCrawler
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: meta-externalagent
Disallow: /

User-agent: anthropic-ai
Disallow: /

User-agent: cohere-ai
Disallow: /
`;

export const GET: APIRoute = ({ site }) => {
	const sitemap = new URL('sitemap-index.xml', site);

	return new Response(`${ROBOTS_POLICY}\nSitemap: ${sitemap.href}\n`, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
		},
	});
};
