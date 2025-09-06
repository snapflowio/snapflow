import { AuthQueryContext, createAuthHooks } from "@daveyplate/better-auth-tanstack";
import { useIsRestoring, useQueryClient } from "@tanstack/react-query";
import { useCallback, useContext, useMemo } from "react";

import type { AuthHooks } from "../../types/auth-hooks";
import type { AuthMutators } from "../../types/auth-mutators";

export function useTanstackOptions({ authClient }: { authClient: any }) {
  const authHooks = useMemo(() => createAuthHooks(authClient), [authClient]);

  const {
    useUnlinkAccount,
    useUpdateUser,
    useDeletePasskey,
    useRevokeSession,
    useRevokeDeviceSession,
    useSetActiveSession,
  } = authHooks;
  const queryClient = useQueryClient();

  const { mutateAsync: updateUserAsync } = useUpdateUser();
  const { mutateAsync: deletePasskeyAsync } = useDeletePasskey();
  const { mutateAsync: unlinkAccountAsync } = useUnlinkAccount();
  const { mutateAsync: revokeSessionAsync } = useRevokeSession();
  const { mutateAsync: revokeDeviceSessionAsync } = useRevokeDeviceSession();
  const { setActiveSessionAsync } = useSetActiveSession();
  const { sessionKey } = useContext(AuthQueryContext);

  const hooks = useMemo(
    () => ({
      ...(authHooks as Partial<AuthHooks>),
      useIsRestoring,
    }),
    [authHooks]
  );

  const mutators = useMemo(
    () =>
      ({
        updateUser: async (params) => {
          const { error } = await updateUserAsync({
            ...params,
            fetchOptions: { throw: false },
          });
          if (error) {
            throw error;
          }
        },
        unlinkAccount: async (params) => {
          const { error } = await unlinkAccountAsync({
            ...params,
            fetchOptions: { throw: false },
          });
          if (error) {
            throw error;
          }
        },
        deletePasskey: async (params) => {
          const { error } = await deletePasskeyAsync({
            ...params,
            fetchOptions: { throw: false },
          });
          if (error) {
            throw error;
          }
        },
        revokeSession: async (params) => {
          const { error } = await revokeSessionAsync({
            ...params,
            fetchOptions: { throw: false },
          });
          if (error) {
            throw error;
          }
        },
        setActiveSession: async (params) => {
          const { error } = await setActiveSessionAsync({
            ...params,
            fetchOptions: { throw: false },
          });
          if (error) {
            throw error;
          }
        },
        revokeDeviceSession: async (params) => {
          const { error } = await revokeDeviceSessionAsync({
            ...params,
            fetchOptions: { throw: false },
          });
          if (error) {
            throw error;
          }
        },
      }) as AuthMutators,
    [
      updateUserAsync,
      deletePasskeyAsync,
      unlinkAccountAsync,
      revokeSessionAsync,
      revokeDeviceSessionAsync,
      setActiveSessionAsync,
    ]
  );

  const onSessionChange = useCallback(async () => {
    await queryClient.refetchQueries({ queryKey: sessionKey });

    queryClient.invalidateQueries({
      predicate: (query) => query.queryKey !== sessionKey,
    });
  }, [queryClient, sessionKey]);

  return {
    hooks,
    mutators,
    onSessionChange,
    optimistic: true,
  };
}
