import { AuthContext } from "./common/interfaces/auth-context.interface";

declare global {
  interface Request {
    user?: AuthContext;
  }
}
