import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from "@nestjs/common";
import { isProxyContext } from "../../common/interfaces/proxy-content.interface";
import { getAuthContext } from "../context/get-auth-context";

@Injectable()
export class ProxyGuard implements CanActivate {
  protected readonly logger = new Logger(ProxyGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    getAuthContext(context, isProxyContext);
    return true;
  }
}
