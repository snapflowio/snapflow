export const authViewPaths = {
  /** @default "callback" */
  CALLBACK: "callback",
  /** @default "email-otp" */
  EMAIL_OTP: "email-otp",
  /** @default "forgot-password" */
  FORGOT_PASSWORD: "forgot-password",
  /** @default "magic-link" */
  MAGIC_LINK: "magic-link",
  /** @default "recover-account" */
  RECOVER_ACCOUNT: "recover-account",
  /** @default "reset-password" */
  RESET_PASSWORD: "reset-password",
  /** @default "sign-in" */
  SIGN_IN: "sign-in",
  /** @default "sign-out" */
  SIGN_OUT: "sign-out",
  /** @default "sign-up" */
  SIGN_UP: "sign-up",
  /** @default "two-factor" */
  TWO_FACTOR: "two-factor",
  /** @default "accept-invitation" */
  ACCEPT_INVITATION: "accept-invitation",
};

export type AuthViewPaths = typeof authViewPaths;

// Account-scoped views (signed-in user)
export const accountViewPaths = {
  /** @default "settings" */
  SETTINGS: "settings",
  /** @default "security" */
  SECURITY: "security",
  /** @default "api-keys" */
  API_KEYS: "api-keys",
};

export type AccountViewPaths = typeof accountViewPaths;

// Organization-scoped views
export const organizationViewPaths = {
  /** @default "settings" */
  SETTINGS: "settings",
  /** @default "api-keys" */
  API_KEYS: "api-keys",
};

export type AuthViewPath = keyof AuthViewPaths;
export type AccountViewPath = keyof AccountViewPaths;
