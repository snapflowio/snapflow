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
    InputOTP,
} from "@snapflow/ui";
import { Loader2 } from "lucide-react";
import { useContext, useEffect, useState } from "react";
import { useForm, useFormState } from "react-hook-form";
import * as z from "zod";
import { useIsHydrated } from "../../../hooks/use-hydrated";
import { useOnSuccessTransition } from "../../../hooks/use-success-transition";
import { AuthUIContext } from "../../../lib/auth-ui-provider";
import { getLocalizedError } from "../../../lib/utils";
import type { AuthLocalization } from "../../../localization/auth";
import type { AuthFormClassNames } from "../auth-form";
import { OTPInputGroup } from "../otp-input-group";

export interface EmailOTPFormProps {
  className?: string;
  classNames?: AuthFormClassNames;
  callbackURL?: string;
  isSubmitting?: boolean;
  localization: Partial<AuthLocalization>;
  otpSeparators?: 0 | 1 | 2;
  redirectTo?: string;
  setIsSubmitting?: (value: boolean) => void;
}

export function EmailOTPForm(props: EmailOTPFormProps) {
  const [email, setEmail] = useState<string | undefined>();

  if (!email) {
    return <EmailForm {...props} setEmail={setEmail} />;
  }

  return <OTPForm {...props} email={email} />;
}

function EmailForm({
  className,
  classNames,
  isSubmitting,
  localization,
  setIsSubmitting,
  setEmail,
}: EmailOTPFormProps & {
  setEmail: (email: string) => void;
}) {
  const isHydrated = useIsHydrated();

  const { authClient, localization: contextLocalization, toast } = useContext(AuthUIContext);

  localization = { ...contextLocalization, ...localization };

  const formSchema = z.object({
    email: z.string().email({
      message: `${localization.EMAIL} ${localization.IS_INVALID}`,
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

  async function sendEmailOTP({ email }: z.infer<typeof formSchema>) {
    try {
      await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
        fetchOptions: { throw: true },
      });

      toast({
        variant: "success",
        message: localization.EMAIL_OTP_VERIFICATION_SENT,
      });

      setEmail(email);
    } catch (error) {
      toast({
        variant: "error",
        message: getLocalizedError({ error, localization }),
      });
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(sendEmailOTP)}
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

        <Button
          type="submit"
          disabled={isSubmitting}
          className={cn("w-full", classNames?.button, classNames?.primaryButton)}
        >
          {isSubmitting ? <Loader2 className="animate-spin" /> : localization.EMAIL_OTP_SEND_ACTION}
        </Button>
      </form>
    </Form>
  );
}

export function OTPForm({
  className,
  classNames,
  isSubmitting,
  localization,
  otpSeparators = 0,
  redirectTo,
  setIsSubmitting,
  email,
}: EmailOTPFormProps & {
  email: string;
}) {
  const { authClient, localization: contextLocalization, toast } = useContext(AuthUIContext);

  localization = { ...contextLocalization, ...localization };

  const { onSuccess, isPending: transitionPending } = useOnSuccessTransition({
    redirectTo,
  });

  const formSchema = z.object({
    code: z
      .string()
      .min(1, {
        message: `${localization.EMAIL_OTP} ${localization.IS_REQUIRED}`,
      })
      .min(6, {
        message: `${localization.EMAIL_OTP} ${localization.IS_INVALID}`,
      }),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
    },
  });

  const { isSubmitting: formIsSubmitting2 } = useFormState({ control: form.control });

  isSubmitting = isSubmitting || formIsSubmitting2 || transitionPending;

  useEffect(() => {
    setIsSubmitting?.(formIsSubmitting2 || transitionPending);
  }, [formIsSubmitting2, transitionPending, setIsSubmitting]);

  async function verifyCode({ code }: z.infer<typeof formSchema>) {
    try {
      await authClient.signIn.emailOtp({
        email,
        otp: code,
        fetchOptions: { throw: true },
      });

      await onSuccess();
    } catch (error) {
      toast({
        variant: "error",
        message: getLocalizedError({ error, localization }),
      });

      form.reset();
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(verifyCode)}
        className={cn("grid w-full gap-6", className, classNames?.base)}
      >
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={classNames?.label}>{localization.EMAIL_OTP}</FormLabel>

              <FormControl>
                <InputOTP
                  {...field}
                  maxLength={6}
                  onChange={(value) => {
                    field.onChange(value);

                    if (value.length === 6) {
                      form.handleSubmit(verifyCode)();
                    }
                  }}
                  containerClassName={classNames?.otpInputContainer}
                  className={classNames?.otpInput}
                  disabled={isSubmitting}
                >
                  <OTPInputGroup otpSeparators={otpSeparators} />
                </InputOTP>
              </FormControl>

              <FormMessage className={classNames?.error} />
            </FormItem>
          )}
        />

        <div className="grid gap-4">
          <Button
            type="submit"
            disabled={isSubmitting}
            className={cn(classNames?.button, classNames?.primaryButton)}
          >
            {isSubmitting && <Loader2 className="animate-spin" />}
            {localization.EMAIL_OTP_VERIFY_ACTION}
          </Button>
        </div>
      </form>
    </Form>
  );
}
