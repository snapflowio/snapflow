import type { BetterFetchError } from "@better-fetch/fetch";
import type { User } from "better-auth";

import type { AnyAuthClient } from "./any-auth-client";
import type { AuthClient } from "./auth-client";
import type { Refetch } from "./refetch";

type AnyAuthSession = AnyAuthClient["$Infer"]["Session"];

type AuthHook<T> = {
  isPending: boolean;
  data?: T | null;
  error?: BetterFetchError | null;
  refetch?: Refetch;
};

export type AuthHooks = {
  useSession: () => ReturnType<AnyAuthClient["useSession"]>;
  useListAccounts: () => AuthHook<{ accountId: string; provider: string }[]>;
  useAccountInfo: (params: Parameters<AuthClient["accountInfo"]>[0]) => AuthHook<{ user: User }>;
  useListDeviceSessions: () => AuthHook<AnyAuthClient["$Infer"]["Session"][]>;
  useListSessions: () => AuthHook<AnyAuthSession["session"][]>;
  useListPasskeys: () => Partial<ReturnType<AuthClient["useListPasskeys"]>>;
  useIsRestoring?: () => boolean;
};
