import { useEffect, useMemo, useState } from "react";
import { IdTokenClaims, useLogto } from "@logto/react";
import { Loading } from "@/components/loading";
import { ApiClient } from "@/api/api-client";
import { ApiContext } from "@/context/api-context";
import { Path } from "@/enums/paths";

export const ApiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, getIdTokenClaims, getIdToken, signIn, fetchUserInfo } =
    useLogto();

  const [authState, setAuthState] = useState<{
    user?: IdTokenClaims;
    apiClient?: ApiClient;
    isInitialized: boolean;
  }>({
    isInitialized: false,
  });

  useEffect(() => {
    if (isLoading) return;

    if (authState.isInitialized) return;

    if (!isAuthenticated) {
      void signIn({ redirectUri: window.location.origin + Path.CALLBACK });
      return;
    }

    const initialize = async () => {
      try {
        await fetchUserInfo();

        const [token, user] = await Promise.all([getIdToken(), getIdTokenClaims()]);

        if (!token || !user)
          throw new Error("Token or user claims not available after successful validation.");

        setAuthState({
          user,
          apiClient: new ApiClient(token),
          isInitialized: true,
        });
      } catch (error) {
        console.error("Failed to initialize API provider, redirecting to sign in:", error);
        void signIn({ redirectUri: window.location.origin + Path.CALLBACK });
      }
    };

    void initialize();
  }, [isLoading, isAuthenticated, signIn, fetchUserInfo, getIdToken, getIdTokenClaims]);

  const contextValue = useMemo(() => {
    if (!authState.apiClient || !authState.user) {
      return null;
    }

    return Object.assign(
      Object.create(Object.getPrototypeOf(authState.apiClient)),
      authState.apiClient,
      { user: authState.user }
    );
  }, [authState.apiClient, authState.user]);

  if (!contextValue) return <Loading />;

  return <ApiContext.Provider value={contextValue}>{children}</ApiContext.Provider>;
};
