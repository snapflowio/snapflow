/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { MarketingLayout } from "@/components/layouts/marketing-layout";
import { Hero } from "@/features/marketing/components/hero/hero";
import { OpenSource } from "@/features/marketing/components/open-source/open-source";
import { Pricing } from "@/features/marketing/components/pricing/pricing";
import { Templates } from "@/features/marketing/components/templates/templates";

export default function LandingPage() {
  return (
    <MarketingLayout>
      <Hero />
      <Templates />
      <Pricing />
      <OpenSource />
    </MarketingLayout>
  );
}
