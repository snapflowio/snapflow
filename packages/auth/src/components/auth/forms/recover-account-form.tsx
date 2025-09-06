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
import { Loader2 } from "lucide-react";
import { useContext, useEffect } from "react";
import { useForm, useFormState } from "react-hook-form";
import * as z from "zod";
import { useOnSuccessTransition } from "../../../hooks/use-success-transition";
import { AuthUIContext } from "../../../lib/auth-ui-provider";
import { getLocalizedError } from "../../../lib/utils";
import type { AuthLocalization } from "../../../localization/auth";
import type { AuthFormClassNames } from "../auth-form";

export interface RecoverAccountFormProps {
  className?: string;
  classNames?: AuthFormClassNames;
  isSubmitting?: boolean;
  localization: Partial<AuthLocalization>;
  redirectTo?: string;
  setIsSubmitting?: (value: boolean) => void;
}

export function RecoverAccountForm({
  className,
  classNames,
  isSubmitting,
  localization,
  redirectTo,
  setIsSubmitting,
}: RecoverAccountFormProps) {
  const { authClient, localization: contextLocalization, toast } = useContext(AuthUIContext);

  localization = { ...contextLocalization, ...localization };

  const { onSuccess, isPending: transitionPending } = useOnSuccessTransition({
    redirectTo,
  });

  const formSchema = z.object({
    code: z.string().min(1, { message: localization.BACKUP_CODE_REQUIRED }),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
    },
  });

  const { isSubmitting: formIsSubmitting } = useFormState({ control: form.control });

  isSubmitting = isSubmitting || formIsSubmitting || transitionPending;

  useEffect(() => {
    setIsSubmitting?.(formIsSubmitting || transitionPending);
  }, [formIsSubmitting, transitionPending, setIsSubmitting]);

  async function verifyBackupCode({ code }: z.infer<typeof formSchema>) {
    try {
      await authClient.twoFactor.verifyBackupCode({
        code,
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
        onSubmit={form.handleSubmit(verifyBackupCode)}
        className={cn("grid gap-6", className, classNames?.base)}
      >
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={classNames?.label}>{localization.BACKUP_CODE}</FormLabel>

              <FormControl>
                <Input
                  placeholder={localization.BACKUP_CODE_PLACEHOLDER}
                  autoComplete="off"
                  className={classNames?.input}
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
          className={cn(classNames?.button, classNames?.primaryButton)}
        >
          {isSubmitting ? (
            <Loader2 className="animate-spin" />
          ) : (
            localization.RECOVER_ACCOUNT_ACTION
          )}
        </Button>
      </form>
    </Form>
  );
}
