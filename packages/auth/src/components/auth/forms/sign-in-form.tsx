import type { BetterFetchOption } from "@better-fetch/fetch";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    Button,
    Checkbox,
    cn,
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    Input,
} from "@snapflow/ui";
import { Loader2 } from "lucide-react";
import { useContext, useEffect, useMemo } from "react";
import { useForm, useFormState } from "react-hook-form";
import * as z from "zod";
import { useCaptcha } from "../../../hooks/use-captcha";
import { useIsHydrated } from "../../../hooks/use-hydrated";
import { useOnSuccessTransition } from "../../../hooks/use-success-transition";
import { AuthUIContext } from "../../../lib/auth-ui-provider";
import { getLocalizedError, getPasswordSchema, isValidEmail } from "../../../lib/utils";
import type { AuthLocalization } from "../../../localization/auth";
import type { PasswordValidation } from "../../../types/password-validation";
import { Captcha } from "../../captcha/captcha";
import { PasswordInput } from "../../password-input";
import type { AuthFormClassNames } from "../auth-form";

export interface SignInFormProps {
  className?: string;
  classNames?: AuthFormClassNames;
  isSubmitting?: boolean;
  localization: Partial<AuthLocalization>;
  redirectTo?: string;
  setIsSubmitting?: (isSubmitting: boolean) => void;
  passwordValidation?: PasswordValidation;
}

export function SignInForm({
  className,
  classNames,
  isSubmitting,
  localization,
  redirectTo,
  setIsSubmitting,
  passwordValidation,
}: SignInFormProps) {
  const isHydrated = useIsHydrated();
  const { captchaRef, getCaptchaHeaders, resetCaptcha } = useCaptcha({
    localization,
  });

  const {
    authClient,
    basePath,
    credentials,
    localization: contextLocalization,
    viewPaths,
    navigate,
    toast,
    Link,
  } = useContext(AuthUIContext);

  const rememberMeEnabled = credentials?.rememberMe;
  const usernameEnabled = credentials?.username;
  const contextPasswordValidation = credentials?.passwordValidation;

  localization = { ...contextLocalization, ...localization };
  passwordValidation = { ...contextPasswordValidation, ...passwordValidation };

  const { onSuccess, isPending: transitionPending } = useOnSuccessTransition({
    redirectTo,
  });

  const formSchema = useMemo(
    () =>
      z.object({
        email: usernameEnabled
          ? z.string().min(1, {
              message: `${localization.USERNAME} ${localization.IS_REQUIRED}`,
            })
          : z.string().email({
              message: `${localization.EMAIL} ${localization.IS_INVALID}`,
            }),
        password: getPasswordSchema(passwordValidation, localization),
        rememberMe: z.boolean().optional(),
      }),
    [
      usernameEnabled,
      localization.USERNAME,
      localization.IS_REQUIRED,
      localization.EMAIL,
      localization.IS_INVALID,
      passwordValidation,
    ]
  );

  const defaultValues = useMemo(
    () => ({
      email: "",
      password: "",
      rememberMe: !rememberMeEnabled,
    }),
    [rememberMeEnabled]
  );

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const { isSubmitting: formIsSubmitting } = useFormState({ control: form.control });

  isSubmitting = isSubmitting || formIsSubmitting || transitionPending;

  useEffect(() => {
    setIsSubmitting?.(formIsSubmitting || transitionPending);
  }, [formIsSubmitting, transitionPending, setIsSubmitting]);

  async function signIn({ email, password, rememberMe }: z.infer<typeof formSchema>) {
    try {
      let response: Record<string, unknown> = {};

      if (usernameEnabled && !isValidEmail(email)) {
        const fetchOptions: BetterFetchOption = {
          throw: true,
          headers: await getCaptchaHeaders("/sign-in/username"),
        };

        response = await authClient.signIn.username({
          username: email,
          password,
          rememberMe,
          fetchOptions,
        });
      } else {
        const fetchOptions: BetterFetchOption = {
          throw: true,
          headers: await getCaptchaHeaders("/sign-in/email"),
        };

        response = await authClient.signIn.email({
          email,
          password,
          rememberMe,
          fetchOptions,
        });
      }

      if (response.twoFactorRedirect) {
        navigate(`${basePath}/${viewPaths.TWO_FACTOR}${window.location.search}`);
      } else {
        await onSuccess();
      }
    } catch (error) {
      form.resetField("password");
      resetCaptcha();

      toast({
        variant: "error",
        message: getLocalizedError({ error, localization }),
      });
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(signIn)}
        noValidate={isHydrated}
        className={cn("grid w-full gap-6", className, classNames?.base)}
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={classNames?.label}>
                {usernameEnabled ? localization.USERNAME : localization.EMAIL}
              </FormLabel>

              <FormControl>
                <Input
                  autoComplete={usernameEnabled ? "username" : "email"}
                  className={classNames?.input}
                  type={usernameEnabled ? "text" : "email"}
                  placeholder={
                    usernameEnabled
                      ? localization.SIGN_IN_USERNAME_PLACEHOLDER
                      : localization.EMAIL_PLACEHOLDER
                  }
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>

              <FormMessage className={classNames?.error} />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel className={classNames?.label}>{localization.PASSWORD}</FormLabel>

                {credentials?.forgotPassword && (
                  <Link
                    className={cn("text-sm hover:underline", classNames?.forgotPasswordLink)}
                    href={`${basePath}/${viewPaths.FORGOT_PASSWORD}${isHydrated ? window.location.search : ""}`}
                  >
                    {localization.FORGOT_PASSWORD_LINK}
                  </Link>
                )}
              </div>

              <FormControl>
                <PasswordInput
                  autoComplete="current-password"
                  className={classNames?.input}
                  placeholder={localization.PASSWORD_PLACEHOLDER}
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>

              <FormMessage className={classNames?.error} />
            </FormItem>
          )}
        />

        {rememberMeEnabled && (
          <FormField
            control={form.control}
            name="rememberMe"
            render={({ field }) => (
              <FormItem className="flex">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isSubmitting}
                  />
                </FormControl>

                <FormLabel>{localization.REMEMBER_ME}</FormLabel>
              </FormItem>
            )}
          />
        )}

        <Captcha ref={captchaRef} localization={localization} action="/sign-in/email" />

        <Button
          type="submit"
          disabled={isSubmitting}
          className={cn("w-full", classNames?.button, classNames?.primaryButton)}
        >
          {isSubmitting ? <Loader2 className="animate-spin" /> : localization.SIGN_IN_ACTION}
        </Button>
      </form>
    </Form>
  );
}
