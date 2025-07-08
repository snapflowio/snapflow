import { useEffect, useRef, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useLocation } from "react-router";
import { Loading } from "@/components/loading";
import { ApiClient } from "@/api/api-client";
import { ApiContext } from "@/context/api-context";

export const ApiProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const {
    user,
    isAuthenticated,
    isLoading,
    loginWithRedirect,
    getAccessTokenSilently,
  } = useAuth0();
  const location = useLocation();

  const apiRef = useRef<ApiClient | null>(null);
  const [isApiReady, setIsApiReady] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      if (isAuthenticated) {
        try {
          const token = await getAccessTokenSilently();
          setAccessToken(token);
        } catch (error) {
          void loginWithRedirect({ appState: { returnTo: location.pathname } });
        }
      }
    };
    fetchToken();
  }, [isAuthenticated, getAccessTokenSilently, loginWithRedirect, location]);

  useEffect(() => {
    if (user && accessToken) {
      if (!apiRef.current) {
        apiRef.current = new ApiClient(accessToken);
      } else {
        apiRef.current.setAccessToken(accessToken);
      }
      setIsApiReady(true);
    } else {
      setIsApiReady(false);
    }
  }, [user, accessToken]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated)
      void loginWithRedirect({ appState: { returnTo: location.pathname } });
  }, [isLoading, isAuthenticated, loginWithRedirect, location]);

  if (isLoading || !isApiReady) return <Loading />;

  return (
    <ApiContext.Provider value={apiRef.current}>{children}</ApiContext.Provider>
  );
};
