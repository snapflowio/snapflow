import { cn } from "@snapflow/ui";
import { type RefObject, useContext, useEffect } from "react";
import ReCAPTCHA from "react-google-recaptcha";
import { AuthUIContext } from "../../lib/auth-ui-provider";

export function RecaptchaV2({ ref }: { ref: RefObject<ReCAPTCHA | null> }) {
  const { captcha } = useContext(AuthUIContext);

  useEffect(() => {
    (window as any).recaptchaOptions = {
      useRecaptchaNet: captcha?.recaptchaNet,
      enterprise: captcha?.enterprise,
    };
  }, [captcha]);

  if (!captcha) {
    return null;
  }

  return (
    <>
      <style>{`
                .grecaptcha-badge {
                    border-radius: var(--radius) !important;
                    --tw-shadow: 0 1px 2px 0 var(--tw-shadow-color, #0000000d);
                    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow) !important;
                    border-style: var(--tw-border-style) !important;
                    border-width: 1px;
                }

                .dark .grecaptcha-badge {
                    border-color: var(--input) !important;
                }
            `}</style>

      <ReCAPTCHA
        ref={ref}
        sitekey={captcha.siteKey}
        theme={"dark"}
        size={captcha.provider === "google-recaptcha-v2-invisible" ? "invisible" : "normal"}
        className={cn(
          captcha.provider === "google-recaptcha-v2-invisible"
            ? "absolute"
            : "bg-muted mx-auto h-[76px] w-[302px] overflow-hidden rounded"
        )}
      />
    </>
  );
}
