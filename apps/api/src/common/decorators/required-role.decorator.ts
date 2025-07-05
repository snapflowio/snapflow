import { Reflector } from "@nestjs/core";
import type { SystemRole } from "../../user/enums/system-role.enum";
import type { ApiRole } from "../interfaces/auth-context.interface";

export const RequiredSystemRole = Reflector.createDecorator<
  SystemRole | SystemRole[]
>();
export const RequiredApiRole = Reflector.createDecorator<ApiRole | ApiRole[]>();
