import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { usePathname } from "next/navigation";
import { Loading } from "@/components/loading";
import { ApiClient } from "@/api/api-client";
import { ApiContext } from "@/context/api-context";

export const ApiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading, loginWithRedirect, getAccessTokenSilently } =
    useAuth0();
  const pathname = usePathname();
  const apiRef = useRef<ApiClient | null>(null);
  const [isApiReady, setIsApiReady] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const handleLoginRedirect = useCallback(() => {
    void loginWithRedirect({ appState: { returnTo: pathname } });
  }, [loginWithRedirect, pathname]);

  useEffect(() => {
    const fetchToken = async () => {
      if (isAuthenticated) {
        try {
          const token = await getAccessTokenSilently();
          setAccessToken(token);
        } catch (error) {
          handleLoginRedirect();
        }
      } else if (!isLoading) {
        setAccessToken(null);
      }
    };
    fetchToken();
  }, [isAuthenticated, isLoading, getAccessTokenSilently, handleLoginRedirect]);

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
    if (!isLoading && !isAuthenticated) handleLoginRedirect();
  }, [isLoading, isAuthenticated, handleLoginRedirect]);

  if (isLoading || !isApiReady) return <Loading />;

  return <ApiContext.Provider value={apiRef.current}>{children}</ApiContext.Provider>;
};
