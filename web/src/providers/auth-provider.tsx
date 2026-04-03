/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { User } from "@snapflow/api-client";
import { useNavigate } from "react-router";
import { apiClient } from "@/api/api-client";
import { Path } from "@/constants/paths";
import { AuthContext, IAuthContext } from "@/context/auth-context";

export function AuthProvider(props: { children: ReactNode }) {
  const authApi = apiClient.authApi;
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    apiClient.onAuthFailure(() => {
      setUser(null);
      navigate(Path.LOGIN, { replace: true });
    });
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;

    authApi
      .getSession()
      .then((res) => {
        if (!cancelled) {
          setUser(res.data);
          setIsPending(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setIsPending(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authApi]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error?: string }> => {
      try {
        const res = await authApi.signIn({ email, password });
        setUser(res.data.user);
        return {};
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to sign in";
        return { error: message };
      }
    },
    [authApi]
  );

  const signUp = useCallback(
    async (
      name: string,
      email: string,
      password: string
    ): Promise<{ error?: string; success?: boolean }> => {
      try {
        await authApi.signUp({ name, email, password });
        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create account";
        return { error: message };
      }
    },
    [authApi]
  );

  const signOut = useCallback(async () => {
    try {
      await authApi.signOut();
    } catch {
    } finally {
      setUser(null);
    }
  }, [authApi]);

  const updateUser = useCallback(
    async (name: string): Promise<{ error?: string }> => {
      try {
        const res = await authApi.updateUser({ name });
        setUser(res.data);
        return {};
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update profile";
        return { error: message };
      }
    },
    [authApi]
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<{ error?: string }> => {
      try {
        await authApi.changePassword({
          current_password: currentPassword,
          new_password: newPassword,
        });
        return {};
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to change password";
        return { error: message };
      }
    },
    [authApi]
  );

  const sendVerificationEmail = useCallback(
    async (email: string): Promise<{ error?: string }> => {
      try {
        await authApi.sendVerificationEmail({ email });
        return {};
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to send verification email";
        return { error: message };
      }
    },
    [authApi]
  );

  const contextValue: IAuthContext = useMemo(
    () => ({
      user,
      token: null,
      isPending,
      signIn,
      signUp,
      signOut,
      updateUser,
      changePassword,
      sendVerificationEmail,
    }),
    [user, isPending, signIn, signUp, signOut, updateUser, changePassword, sendVerificationEmail]
  );

  return <AuthContext.Provider value={contextValue}>{props.children}</AuthContext.Provider>;
}
