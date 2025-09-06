import { createContext, type ReactNode, useMemo } from "react";
import { toast } from "sonner";

import { useAuthData } from "../hooks/use-auth-data";
import { type AuthLocalization, authLocalization } from "../localization/auth";
import type { AccountOptions, AccountOptionsContext } from "../types/account-options";
import type { AdditionalFields } from "../types/additional-fields";
import type { AnyAuthClient } from "../types/any-auth-client";
import type { AuthClient } from "../types/auth-client";
import type { AuthHooks } from "../types/auth-hooks";
import type { AuthMutators } from "../types/auth-mutators";
import type { AvatarOptions } from "../types/avatar-options";
import type { CaptchaOptions } from "../types/captcha-options";
import type { CredentialsOptions } from "../types/credentials-options";
import type { DeleteUserOptions } from "../types/delete-user-options";
import type { GenericOAuthOptions } from "../types/generic-oauth-options";
import type { GravatarOptions } from "../types/gravatar-options";
import type { Link } from "../types/link";
import type { RenderToast } from "../types/render-toast";
import type { SignUpOptions } from "../types/signup-options";
import type { SocialOptions } from "../types/social-options";
import type { AuthViewPaths } from "./view-paths";
import { accountViewPaths, authViewPaths } from "./view-paths";

const DefaultLink: Link = ({ href, className, children }) => (
  <a className={className} href={href}>
    {children}
  </a>
);

const defaultNavigate = (href: string) => {
  window.location.href = href;
};

const defaultReplace = (href: string) => {
  window.location.replace(href);
};

const defaultToast: RenderToast = ({ variant = "default", message }) => {
  if (variant === "default") {
    toast(message);
  } else {
    toast[variant](message);
  }
};

export type AuthUIContextType = {
  authClient: AuthClient;
  /**
   * Additional fields for users
   */
  additionalFields?: AdditionalFields;
  /**
   * API Key plugin configuration
   */
  apiKey?:
    | {
        /**
         * Prefix for API Keys
         */
        prefix?: string;
        /**
         * Metadata for API Keys
         */
        metadata?: Record<string, unknown>;
      }
    | boolean;
  /**
   * Avatar configuration
   * @default undefined
   */
  avatar?: AvatarOptions;
  /**
   * Base path for the auth views
   * @default "/auth"
   */
  basePath: string;
  /**
   * Front end base URL for auth API callbacks
   */
  baseURL?: string;
  /**
   * Captcha configuration
   */
  captcha?: CaptchaOptions;
  credentials?: CredentialsOptions;
  /**
   * Default redirect URL after authenticating
   * @default "/"
   */
  redirectTo: string;
  /**
   * Enable or disable user change email support
   * @default true
   */
  changeEmail?: boolean;
  /**
   * User Account deletion configuration
   * @default undefined
   */
  deleteUser?: DeleteUserOptions;
  /**
   * Show Verify Email card for unverified emails
   */
  emailVerification?: boolean;
  /**
   * Freshness age for Session data
   * @default 60 * 60 * 24
   */
  freshAge: number;
  /**
   * Generic OAuth provider configuration
   */
  genericOAuth?: GenericOAuthOptions;
  /**
   * Gravatar configuration
   */
  gravatar?: boolean | GravatarOptions;
  hooks: AuthHooks;
  localization: typeof authLocalization;
  /**
   * Enable or disable Magic Link support
   * @default false
   */
  magicLink?: boolean;
  /**
   * Enable or disable Email OTP support
   * @default false
   */
  emailOTP?: boolean;
  /**
   * Enable or disable Multi Session support
   * @default false
   */
  multiSession?: boolean;
  mutators: AuthMutators;
  /**
   * Whether the name field should be required
   * @default true
   */
  nameRequired?: boolean;
  /**
   * Enable or disable One Tap support
   * @default false
   */
  oneTap?: boolean;
  /**
   * Perform some User updates optimistically
   * @default false
   */
  optimistic?: boolean;
  /**
   * Enable or disable Passkey support
   * @default false
   */
  passkey?: boolean;
  /**
   * Forces better-auth-tanstack to refresh the Session on the auth callback page
   * @default false
   */
  persistClient?: boolean;
  /**
   * Account configuration
   */
  account?: AccountOptionsContext;
  /**
   * Sign Up configuration
   */
  signUp?: SignUpOptions;
  /**
   * Social provider configuration
   */
  social?: SocialOptions;
  toast: RenderToast;
  /**
   * Enable or disable two-factor authentication support
   * @default undefined
   */
  twoFactor?: ("otp" | "totp")[];
  viewPaths: AuthViewPaths;
  /**
   * Navigate to a new URL
   * @default window.location.href
   */
  navigate: (href: string) => void;
  /**
   * Called whenever the Session changes
   */
  onSessionChange?: () => void | Promise<void>;
  /**
   * Replace the current URL
   * @default navigate
   */
  replace: (href: string) => void;
  /**
   * Custom Link component for navigation
   * @default <a>
   */
  Link: Link;
};

export type AuthUIProviderProps = {
  children: ReactNode;
  /**
   * Better Auth client returned from createAuthClient
   * @default Required
   * @remarks `AuthClient`
   */
  authClient: AnyAuthClient;
  /**
   * Enable account view & account configuration
   * @default { fields: ["image", "name"] }
   */
  account?: boolean | Partial<AccountOptions>;
  /**
   * Avatar configuration
   * @default undefined
   */
  avatar?: boolean | Partial<AvatarOptions>;
  /**
   * User Account deletion configuration
   * @default undefined
   */
  deleteUser?: DeleteUserOptions | boolean;
  /**
   * ADVANCED: Custom hooks for fetching auth data
   */
  hooks?: Partial<AuthHooks>;
  /**
   * Customize the paths for the auth views
   * @default authViewPaths
   * @remarks `AuthViewPaths`
   */
  viewPaths?: Partial<AuthViewPaths>;
  /**
   * Render custom Toasts
   * @default Sonner
   */
  toast?: RenderToast;
  /**
   * Customize the Localization strings
   * @default authLocalization
   * @remarks `AuthLocalization`
   */
  localization?: AuthLocalization;
  /**
   * ADVANCED: Custom mutators for updating auth data
   */
  mutators?: Partial<AuthMutators>;
  /**
   * Enable or disable Credentials support
   * @default { forgotPassword: true }
   */
  credentials?: boolean | CredentialsOptions;
  /**
   * Enable or disable Sign Up form
   * @default { fields: ["name"] }
   */
  signUp?: SignUpOptions | boolean;
} & Partial<
  Omit<
    AuthUIContextType,
    | "authClient"
    | "viewPaths"
    | "localization"
    | "mutators"
    | "toast"
    | "hooks"
    | "avatar"
    | "account"
    | "deleteUser"
    | "credentials"
    | "signUp"
    | "organization"
  >
>;

export const AuthUIContext = createContext<AuthUIContextType>({} as unknown as AuthUIContextType);

export const AuthUIProvider = ({
  children,
  authClient: authClientProp,
  account: accountProp,
  avatar: avatarProp,
  deleteUser: deleteUserProp,
  social: socialProp,
  genericOAuth: genericOAuthProp,
  basePath = "/auth",
  baseURL = "",
  captcha,
  redirectTo = "/",
  credentials: credentialsProp,
  changeEmail = true,
  freshAge = 60 * 60 * 24,
  hooks: hooksProp,
  mutators: mutatorsProp,
  localization: localizationProp,
  nameRequired = true,
  signUp: signUpProp = true,
  toast = defaultToast,
  viewPaths: viewPathsProp,
  navigate,
  replace,
  Link = DefaultLink,
  ...props
}: AuthUIProviderProps) => {
  const authClient = authClientProp as AuthClient;

  const avatar = useMemo<AvatarOptions | undefined>(() => {
    if (!avatarProp) {
      return;
    }

    if (avatarProp === true) {
      return {
        extension: "png",
        size: 128,
      };
    }

    return {
      upload: avatarProp.upload,
      delete: avatarProp.delete,
      extension: avatarProp.extension || "png",
      size: avatarProp.size || (avatarProp.upload ? 256 : 128),
    };
  }, [avatarProp]);

  const account = useMemo<AccountOptionsContext | undefined>(() => {
    if (accountProp === false) {
      return;
    }

    if (accountProp === true || accountProp === undefined) {
      return {
        basePath: "/account",
        fields: ["image", "name"],
        viewPaths: accountViewPaths,
      };
    }

    // Remove trailing slash from basePath
    const basePath = accountProp.basePath?.endsWith("/")
      ? accountProp.basePath.slice(0, -1)
      : accountProp.basePath;

    return {
      basePath: basePath ?? "/account",
      fields: accountProp.fields || ["image", "name"],
      viewPaths: { ...accountViewPaths, ...accountProp.viewPaths },
    };
  }, [accountProp]);

  const deleteUser = useMemo<DeleteUserOptions | undefined>(() => {
    if (!deleteUserProp) {
      return;
    }

    if (deleteUserProp === true) {
      return {};
    }

    return deleteUserProp;
  }, [deleteUserProp]);

  const social = useMemo<SocialOptions | undefined>(() => {
    if (!socialProp) {
      return;
    }

    return socialProp;
  }, [socialProp]);

  const genericOAuth = useMemo<GenericOAuthOptions | undefined>(() => {
    if (!genericOAuthProp) {
      return;
    }

    return genericOAuthProp;
  }, [genericOAuthProp]);

  const credentials = useMemo<CredentialsOptions | undefined>(() => {
    if (credentialsProp === false) {
      return;
    }

    if (credentialsProp === true) {
      return {
        forgotPassword: true,
      };
    }

    return {
      ...credentialsProp,
      forgotPassword: credentialsProp?.forgotPassword ?? true,
    };
  }, [credentialsProp]);

  const signUp = useMemo<SignUpOptions | undefined>(() => {
    if (signUpProp === false) {
      return;
    }

    if (signUpProp === true || signUpProp === undefined) {
      return {
        fields: ["name"],
      };
    }

    return {
      fields: signUpProp.fields || ["name"],
    };
  }, [signUpProp]);

  const defaultMutators = useMemo(() => {
    return {
      deletePasskey: (params) =>
        authClient.passkey.deletePasskey({
          ...params,
          fetchOptions: { throw: true },
        }),
      revokeDeviceSession: (params) =>
        authClient.multiSession.revoke({
          ...params,
          fetchOptions: { throw: true },
        }),
      revokeSession: (params) =>
        authClient.revokeSession({
          ...params,
          fetchOptions: { throw: true },
        }),
      setActiveSession: (params) =>
        authClient.multiSession.setActive({
          ...params,
          fetchOptions: { throw: true },
        }),
      updateUser: (params) =>
        authClient.updateUser({
          ...params,
          fetchOptions: { throw: true },
        }),
      unlinkAccount: (params) =>
        authClient.unlinkAccount({
          ...params,
          fetchOptions: { throw: true },
        }),
    } as AuthMutators;
  }, [authClient]);

  const defaultHooks = useMemo(() => {
    return {
      useSession: authClient.useSession,
      useListAccounts: () =>
        useAuthData({
          queryFn: authClient.listAccounts,
          cacheKey: "listAccounts",
        }),
      useAccountInfo: (params) =>
        useAuthData({
          queryFn: () => authClient.accountInfo(params),
          cacheKey: `accountInfo:${JSON.stringify(params)}`,
        }),
      useListDeviceSessions: () =>
        useAuthData({
          queryFn: authClient.multiSession.listDeviceSessions,
          cacheKey: "listDeviceSessions",
        }),
      useListSessions: () =>
        useAuthData({
          queryFn: authClient.listSessions,
          cacheKey: "listSessions",
        }),
      useListPasskeys: authClient.useListPasskeys,
    } as AuthHooks;
  }, [authClient]);

  const viewPaths = useMemo(() => {
    return { ...authViewPaths, ...viewPathsProp };
  }, [viewPathsProp]);

  const localization = useMemo(() => {
    return { ...authLocalization, ...localizationProp };
  }, [localizationProp]);

  const hooks = useMemo(() => {
    return { ...defaultHooks, ...hooksProp };
  }, [defaultHooks, hooksProp]);

  const mutators = useMemo(() => {
    return { ...defaultMutators, ...mutatorsProp };
  }, [defaultMutators, mutatorsProp]);

  // Remove trailing slash from baseURL
  baseURL = baseURL.endsWith("/") ? baseURL.slice(0, -1) : baseURL;

  // Remove trailing slash from basePath
  basePath = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;

  const { data: sessionData } = hooks.useSession();

  return (
    <AuthUIContext.Provider
      value={{
        authClient,
        avatar,
        basePath: basePath === "/" ? "" : basePath,
        baseURL,
        captcha,
        redirectTo,
        changeEmail,
        credentials,
        deleteUser,
        freshAge,
        genericOAuth,
        hooks,
        mutators,
        localization,
        nameRequired,
        account,
        signUp,
        social,
        toast,
        navigate: navigate || defaultNavigate,
        replace: replace || navigate || defaultReplace,
        viewPaths,
        Link,
        ...props,
      }}
    >
      {children}
    </AuthUIContext.Provider>
  );
};
