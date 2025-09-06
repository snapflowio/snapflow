import { Injectable, Logger } from "@nestjs/common";
import { PostHog } from "posthog-node";

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly posthog?: PostHog;

  constructor() {
    if (!process.env.POSTHOG_API_KEY) return;
    if (!process.env.POSTHOG_HOST) return;

    // Initialize PostHog client
    // Make sure to set POSTHOG_API_KEY in your environment variables
    this.posthog = new PostHog(process.env.POSTHOG_API_KEY, {
      host: process.env.POSTHOG_HOST,
    });
  }
}
