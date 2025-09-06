import { zodResolver } from "@hookform/resolvers/zod";
import {
    Button,
    cn,
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    Input,
} from "@snapflow/ui";
import type { BetterFetchOption } from "better-auth/react";
import { Loader2 } from "lucide-react";
import { useContext, useEffect } from "react";
import { useForm, useFormState } from "react-hook-form";
import * as z from "zod";
import { useCaptcha } from "../../../hooks/use-captcha";
import { useIsHydrated } from "../../../hooks/use-hydrated";
import { AuthUIContext } from "../../../lib/auth-ui-provider";
import { getLocalizedError } from "../../../lib/utils";
import type { AuthLocalization } from "../../../localization/auth";
import { Captcha } from "../../captcha/captcha";
import type { AuthFormClassNames } from "../auth-form";

export interface ForgotPasswordFormProps {
  className?: string;
  classNames?: AuthFormClassNames;
  isSubmitting?: boolean;
  localization: Partial<AuthLocalization>;
  setIsSubmitting?: (value: boolean) => void;
}

export function ForgotPasswordForm({
  className,
  classNames,
  isSubmitting,
  localization,
  setIsSubmitting,
}: ForgotPasswordFormProps) {
  const isHydrated = useIsHydrated();
  const { captchaRef, getCaptchaHeaders, resetCaptcha } = useCaptcha({
    localization,
  });

  const {
    authClient,
    basePath,
    baseURL,
    localization: contextLocalization,
    navigate,
    toast,
    viewPaths,
  } = useContext(AuthUIContext);

  localization = { ...contextLocalization, ...localization };

  const formSchema = z.object({
    email: z
      .string()
      .email({
        message: `${localization.EMAIL} ${localization.IS_INVALID}`,
      })
      .min(1, {
        message: `${localization.EMAIL} ${localization.IS_REQUIRED}`,
      }),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  const { isSubmitting: formIsSubmitting } = useFormState({ control: form.control });

  isSubmitting = isSubmitting || formIsSubmitting;

  useEffect(() => {
    setIsSubmitting?.(formIsSubmitting);
  }, [formIsSubmitting, setIsSubmitting]);

  async function forgotPassword({ email }: z.infer<typeof formSchema>) {
    try {
      const fetchOptions: BetterFetchOption = {
        throw: true,
        headers: await getCaptchaHeaders("/forget-password"),
      };

      await authClient.requestPasswordReset({
        email,
        redirectTo: `${baseURL}${basePath}/${viewPaths.RESET_PASSWORD}`,
        fetchOptions,
      });

      toast({
        variant: "success",
        message: localization.FORGOT_PASSWORD_EMAIL,
      });

      navigate(`${basePath}/${viewPaths.SIGN_IN}${window.location.search}`);
    } catch (error) {
      toast({
        variant: "error",
        message: getLocalizedError({ error, localization }),
      });
      resetCaptcha();
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(forgotPassword)}
        noValidate={isHydrated}
        className={cn("grid w-full gap-6", className, classNames?.base)}
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={classNames?.label}>{localization.EMAIL}</FormLabel>

              <FormControl>
                <Input
                  className={classNames?.input}
                  type="email"
                  placeholder={localization.EMAIL_PLACEHOLDER}
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>

              <FormMessage className={classNames?.error} />
            </FormItem>
          )}
        />

        <Captcha ref={captchaRef} localization={localization} action="/forget-password" />

        <Button
          type="submit"
          disabled={isSubmitting}
          className={cn("w-full", classNames?.button, classNames?.primaryButton)}
        >
          {isSubmitting ? (
            <Loader2 className="animate-spin" />
          ) : (
            localization.FORGOT_PASSWORD_ACTION
          )}
        </Button>
      </form>
    </Form>
  );
}
