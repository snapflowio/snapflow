import type { CustomDecorator } from "@nestjs/common";
import { SetMetadata } from "@nestjs/common";

/**
 * Marks a route or a controller as public, allowing unauthenticated access.
 * When applied, the AuthGuard will skip authentication checks.
 */
export const Public = (): CustomDecorator<string> => SetMetadata("PUBLIC", true);
