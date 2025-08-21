import {
  BadRequestException,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  RawBody,
  Req,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { Request } from "express";
import { TypedConfigService } from "../config/typed-config.service";
import { WebhookService } from "./webhook.service";

@ApiTags("webhooks")
@Controller("webhooks")
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly webhookService: WebhookService,
    private readonly configService: TypedConfigService
  ) {}

  @Post("/billing")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Handle Polar billing webhooks" })
  @ApiResponse({ status: 200, description: "Webhook processed successfully" })
  @ApiResponse({ status: 400, description: "Invalid webhook payload" })
  @ApiResponse({ status: 403, description: "Webhook verification failed" })
  async billingWebhook(
    @RawBody() billingWebhookBody: Buffer,
    @Req() req: Request
  ): Promise<{ success: boolean; message?: string }> {
    const webhookSecret = this.configService.get("polar.webhookSecret");

    if (!webhookSecret) {
      this.logger.error("Polar webhook secret not configured");
      throw new BadRequestException("Webhook processing not available");
    }

    try {
      this.logger.debug("Processing billing webhook", {
        contentLength: billingWebhookBody.length,
        headers: req.headers,
      });

      const headers = Object.fromEntries(
        Object.entries(req.headers).map(([key, value]) => [
          key,
          Array.isArray(value) ? value[0] : value || "",
        ])
      );

      const event = validateEvent(billingWebhookBody, headers, webhookSecret);

      this.logger.log(`Received webhook event: ${event.type}`);

      switch (event.type) {
        case "order.created": {
          const result = await this.webhookService.processBillingWebhook(event.data);
          this.logger.log(`Order processed successfully for organization: ${result.id}`);
          return { success: true, message: "Order processed successfully" };
        }

        default:
          this.logger.warn(`Unhandled webhook event type: ${event.type}`);
          return { success: true, message: "Event type not handled" };
      }
    } catch (error) {
      if (error instanceof WebhookVerificationError) {
        this.logger.error("Webhook verification failed", { error: error.message });
        throw new ForbiddenException("Webhook verification failed");
      }

      this.logger.error("Error processing billing webhook", {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}
