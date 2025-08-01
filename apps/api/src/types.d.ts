import { AuthContext } from "./common/interfaces/auth-context.interface";
import { User } from "./user/user.entity";

declare global {
  interface Request {
    user?: AuthContext;
  }
}
