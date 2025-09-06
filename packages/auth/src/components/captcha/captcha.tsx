import HCaptcha from "@hcaptcha/react-hcaptcha";
import { Turnstile } from "@marsidev/react-turnstile";
import { type RefObject, useContext } from "react";

import { AuthUIContext } from "../../lib/auth-ui-provider";
import type { AuthLocalization } from "../../localization/auth";
import { RecaptchaBadge } from "./recaptcha-badge";
import { RecaptchaV2 } from "./recaptcha-v2";

// Default captcha endpoints
const DEFAULT_CAPTCHA_ENDPOINTS = ["/sign-up/email", "/sign-in/email", "/forget-password"];

interface CaptchaProps {
  ref: RefObject<any>;
  localization: Partial<AuthLocalization>;
  action?: string; // Optional action to check if it's in the endpoints list
}

export function Captcha({ ref, localization, action }: CaptchaProps) {
  const { captcha } = useContext(AuthUIContext);
  if (!captcha) {
    return null;
  }

  // If action is provided, check if it's in the list of captcha-enabled endpoints
  if (action) {
    const endpoints = captcha.endpoints || DEFAULT_CAPTCHA_ENDPOINTS;
    if (!endpoints.includes(action)) {
      return null;
    }
  }

  const showRecaptchaV2 =
    captcha.provider === "google-recaptcha-v2-checkbox" ||
    captcha.provider === "google-recaptcha-v2-invisible";

  const showRecaptchaBadge =
    captcha.provider === "google-recaptcha-v3" ||
    captcha.provider === "google-recaptcha-v2-invisible";

  const showTurnstile = captcha.provider === "cloudflare-turnstile";

  const showHCaptcha = captcha.provider === "hcaptcha";

  return (
    <>
      {showRecaptchaV2 && <RecaptchaV2 ref={ref} />}
      {showRecaptchaBadge && <RecaptchaBadge localization={localization} />}
      {showTurnstile && (
        <Turnstile
          className="mx-auto"
          ref={ref}
          siteKey={captcha.siteKey}
          options={{
            theme: "dark",
            size: "flexible",
          }}
        />
      )}
      {showHCaptcha && (
        <div className="mx-auto">
          <HCaptcha ref={ref} sitekey={captcha.siteKey} theme={"dark"} />
        </div>
      )}
    </>
  );
}
