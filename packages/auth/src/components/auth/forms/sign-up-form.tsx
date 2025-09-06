import { zodResolver } from "@hookform/resolvers/zod";
import {
    Button,
    Checkbox,
    cn,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    Input,
    Textarea,
} from "@snapflow/ui";
import type { BetterFetchOption } from "better-auth/react";
import { Loader2, Trash2Icon, UploadCloudIcon } from "lucide-react";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useForm, useFormState } from "react-hook-form";
import * as z from "zod";
import { useCaptcha } from "../../../hooks/use-captcha";
import { useIsHydrated } from "../../../hooks/use-hydrated";
import { useOnSuccessTransition } from "../../../hooks/use-success-transition";
import { AuthUIContext } from "../../../lib/auth-ui-provider";
import { fileToBase64, resizeAndCropImage } from "../../../lib/image-utils";
import { getLocalizedError, getPasswordSchema, getSearchParam } from "../../../lib/utils";
import type { AuthLocalization } from "../../../localization/auth";
import type { PasswordValidation } from "../../../types/password-validation";
import { Captcha } from "../../captcha/captcha";
import { PasswordInput } from "../../password-input";
import { UserAvatar } from "../../user-avatar";
import type { AuthFormClassNames } from "../auth-form";

export interface SignUpFormProps {
  className?: string;
  classNames?: AuthFormClassNames;
  callbackURL?: string;
  isSubmitting?: boolean;
  localization: Partial<AuthLocalization>;
  redirectTo?: string;
  setIsSubmitting?: (value: boolean) => void;
  passwordValidation?: PasswordValidation;
}

export function SignUpForm({
  className,
  classNames,
  callbackURL,
  isSubmitting,
  localization,
  redirectTo,
  setIsSubmitting,
  passwordValidation,
}: SignUpFormProps) {
  const isHydrated = useIsHydrated();
  const { captchaRef, getCaptchaHeaders, resetCaptcha } = useCaptcha({
    localization,
  });

  const {
    additionalFields,
    authClient,
    basePath,
    baseURL,
    credentials,
    localization: contextLocalization,
    nameRequired,
    persistClient,
    redirectTo: contextRedirectTo,
    signUp: signUpOptions,
    viewPaths,
    navigate,
    toast,
    avatar,
  } = useContext(AuthUIContext);

  const confirmPasswordEnabled = credentials?.confirmPassword;
  const usernameEnabled = credentials?.username;
  const contextPasswordValidation = credentials?.passwordValidation;
  const signUpFields = signUpOptions?.fields;

  localization = { ...contextLocalization, ...localization };
  passwordValidation = { ...contextPasswordValidation, ...passwordValidation };

  // Avatar upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const getRedirectTo = useCallback(
    () => redirectTo || getSearchParam("redirectTo") || contextRedirectTo,
    [redirectTo, contextRedirectTo]
  );

  const getCallbackURL = useCallback(
    () =>
      `${baseURL}${
        callbackURL ||
        (persistClient
          ? `${basePath}/${viewPaths.CALLBACK}?redirectTo=${getRedirectTo()}`
          : getRedirectTo())
      }`,
    [callbackURL, persistClient, basePath, viewPaths, baseURL, getRedirectTo]
  );

  const { onSuccess, isPending: transitionPending } = useOnSuccessTransition({
    redirectTo,
  });

  // Create the base schema for standard fields
  const defaultFields = {
    email: z.string().email({
      message: `${localization.EMAIL} ${localization.IS_INVALID}`,
    }),
    password: getPasswordSchema(passwordValidation, localization),
    name:
      signUpFields?.includes("name") && nameRequired
        ? z.string().min(1, {
            message: `${localization.NAME} ${localization.IS_REQUIRED}`,
          })
        : z.string().optional(),
    image: z.string().optional(),
    username: usernameEnabled
      ? z.string().min(1, {
          message: `${localization.USERNAME} ${localization.IS_REQUIRED}`,
        })
      : z.string().optional(),
    confirmPassword: confirmPasswordEnabled
      ? getPasswordSchema(passwordValidation, {
          PASSWORD_REQUIRED: localization.CONFIRM_PASSWORD_REQUIRED,
          PASSWORD_TOO_SHORT: localization.PASSWORD_TOO_SHORT,
          PASSWORD_TOO_LONG: localization.PASSWORD_TOO_LONG,
          INVALID_PASSWORD: localization.INVALID_PASSWORD,
        })
      : z.string().optional(),
  };

  const schemaFields: Record<string, z.ZodTypeAny> = {};

  // Add additional fields from signUpFields
  if (signUpFields) {
    for (const field of signUpFields) {
      if (field === "name") {
        continue;
      } // Already handled above
      if (field === "image") {
        continue;
      } // Already handled above

      const additionalField = additionalFields?.[field];
      if (!additionalField) {
        continue;
      }

      let fieldSchema: z.ZodTypeAny;

      // Create the appropriate schema based on field type
      if (additionalField.type === "number") {
        fieldSchema = additionalField.required
          ? z.preprocess(
              (val) => (!val ? undefined : Number(val)),
              z.number({
                message: `${additionalField.label} ${localization.IS_INVALID}`,
              })
            )
          : z.coerce
              .number({
                message: `${additionalField.label} ${localization.IS_INVALID}`,
              })
              .optional();
      } else if (additionalField.type === "boolean") {
        fieldSchema = additionalField.required
          ? z.coerce
              .boolean({
                message: `${additionalField.label} ${localization.IS_INVALID}`,
              })
              .refine((val) => val === true, {
                message: `${additionalField.label} ${localization.IS_REQUIRED}`,
              })
          : z.coerce
              .boolean({
                message: `${additionalField.label} ${localization.IS_INVALID}`,
              })
              .optional();
      } else {
        fieldSchema = additionalField.required
          ? z.string().min(1, `${additionalField.label} ${localization.IS_REQUIRED}`)
          : z.string().optional();
      }

      schemaFields[field] = fieldSchema;
    }
  }

  const formSchema = useMemo(
    () =>
      z
        .object(defaultFields)
        .extend(schemaFields)
        .refine(
          (data) => {
            // Skip validation if confirmPassword is not enabled
            if (!confirmPasswordEnabled) {
              return true;
            }
            return data.password === data.confirmPassword;
          },
          {
            message: localization.PASSWORDS_DO_NOT_MATCH!,
            path: ["confirmPassword"],
          }
        ),
    [defaultFields, schemaFields, confirmPasswordEnabled, localization.PASSWORDS_DO_NOT_MATCH]
  );

  // Create default values for the form
  const defaultValues: Record<string, unknown> = useMemo(() => {
    const values: Record<string, unknown> = {
      email: "",
      password: "",
      ...(confirmPasswordEnabled && { confirmPassword: "" }),
      ...(signUpFields?.includes("name") ? { name: "" } : {}),
      ...(usernameEnabled ? { username: "" } : {}),
      ...(signUpFields?.includes("image") && avatar ? { image: "" } : {}),
    };

    // Add default values for additional fields
    if (signUpFields) {
      for (const field of signUpFields) {
        if (field === "name") {
          continue;
        }
        if (field === "image") {
          continue;
        }
        const additionalField = additionalFields?.[field];
        if (!additionalField) {
          continue;
        }

        values[field] = additionalField.type === "boolean" ? false : "";
      }
    }

    return values;
  }, [confirmPasswordEnabled, signUpFields, usernameEnabled, avatar, additionalFields]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const { isSubmitting: formIsSubmitting } = useFormState({ control: form.control });

  isSubmitting = isSubmitting || formIsSubmitting || transitionPending;

  useEffect(() => {
    setIsSubmitting?.(formIsSubmitting || transitionPending);
  }, [formIsSubmitting, transitionPending, setIsSubmitting]);

  const handleAvatarChange = async (file: File) => {
    if (!avatar) {
      return;
    }

    setUploadingAvatar(true);

    try {
      const resizedFile = await resizeAndCropImage(
        file,
        crypto.randomUUID(),
        avatar.size,
        avatar.extension
      );

      let image: string | undefined | null;

      if (avatar.upload) {
        image = await avatar.upload(resizedFile);
      } else {
        image = await fileToBase64(resizedFile);
      }

      if (image) {
        setAvatarImage(image);
        form.setValue("image", image);
      } else {
        setAvatarImage(null);
        form.setValue("image", "");
      }
    } catch (error) {
      console.error(error);
      toast({
        variant: "error",
        message: getLocalizedError({ error, localization }),
      });
    }

    setUploadingAvatar(false);
  };

  const handleDeleteAvatar = () => {
    setAvatarImage(null);
    form.setValue("image", "");
  };

  const openFileDialog = () => fileInputRef.current?.click();

  async function signUp({
    email,
    password,
    name,
    username,
    confirmPassword,
    image,
    ...additionalFieldValues
  }: z.infer<typeof formSchema>) {
    try {
      // Validate additional fields with custom validators if provided
      for (const [field, value] of Object.entries(additionalFieldValues)) {
        const additionalField = additionalFields?.[field];
        if (!additionalField?.validate) {
          continue;
        }

        if (typeof value === "string" && !(await additionalField.validate(value))) {
          form.setError(field, {
            message: `${additionalField.label} ${localization.IS_INVALID}`,
          });
          return;
        }
      }

      const fetchOptions: BetterFetchOption = {
        throw: true,
        headers: await getCaptchaHeaders("/sign-up/email"),
      };

      const additionalParams: Record<string, unknown> = {};

      if (username !== undefined) {
        additionalParams.username = username;
      }

      if (image !== undefined) {
        additionalParams.image = image;
      }

      const data = await authClient.signUp.email({
        email: email as string,
        password: password as string,
        name: (name as string) || "",
        ...additionalParams,
        ...additionalFieldValues,
        callbackURL: getCallbackURL(),
        fetchOptions,
      });

      if ("token" in data && data.token) {
        await onSuccess();
      } else {
        navigate(`${basePath}/${viewPaths.SIGN_IN}${window.location.search}`);
        toast({
          variant: "success",
          message: localization.SIGN_UP_EMAIL!,
        });
      }
    } catch (error) {
      toast({
        variant: "error",
        message: getLocalizedError({ error, localization }),
      });

      form.resetField("password");
      form.resetField("confirmPassword");
      resetCaptcha();
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(signUp)}
        noValidate={isHydrated}
        className={cn("grid w-full gap-6", className, classNames?.base)}
      >
        {signUpFields?.includes("image") && avatar && (
          <>
            <input
              ref={fileInputRef}
              accept="image/*"
              disabled={uploadingAvatar}
              hidden
              type="file"
              onChange={(e) => {
                const file = e.target.files?.item(0);
                if (file) {
                  handleAvatarChange(file);
                }
                e.target.value = "";
              }}
            />

            <FormField
              control={form.control}
              name="image"
              render={() => (
                <FormItem>
                  <FormLabel>{localization.AVATAR}</FormLabel>

                  <div className="flex items-center gap-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          className="size-fit rounded-full"
                          size="icon"
                          variant="ghost"
                          type="button"
                        >
                          <UserAvatar
                            isPending={uploadingAvatar}
                            className="size-16"
                            user={
                              avatarImage
                                ? {
                                    name: form.watch("name") as string,
                                    email: form.watch("email") as string,
                                    image: avatarImage,
                                  }
                                : null
                            }
                            localization={localization}
                          />
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent
                        align="start"
                        onCloseAutoFocus={(e) => e.preventDefault()}
                      >
                        <DropdownMenuItem onClick={openFileDialog} disabled={uploadingAvatar}>
                          <UploadCloudIcon />
                          {localization.UPLOAD_AVATAR}
                        </DropdownMenuItem>

                        {avatarImage && (
                          <DropdownMenuItem onClick={handleDeleteAvatar} disabled={uploadingAvatar}>
                            <Trash2Icon />
                            {localization.DELETE_AVATAR}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={openFileDialog}
                      disabled={uploadingAvatar}
                    >
                      {uploadingAvatar && <Loader2 className="animate-spin" />}

                      {localization.UPLOAD}
                    </Button>
                  </div>

                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {signUpFields?.includes("name") && (
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={classNames?.label}>{localization.NAME}</FormLabel>

                <FormControl>
                  <Input
                    className={classNames?.input}
                    placeholder={localization.NAME_PLACEHOLDER}
                    disabled={isSubmitting}
                    {...field}
                    value={field.value as string}
                  />
                </FormControl>

                <FormMessage className={classNames?.error} />
              </FormItem>
            )}
          />
        )}

        {usernameEnabled && (
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={classNames?.label}>{localization.USERNAME}</FormLabel>

                <FormControl>
                  <Input
                    className={classNames?.input}
                    placeholder={localization.USERNAME_PLACEHOLDER}
                    disabled={isSubmitting}
                    {...field}
                    value={field.value as string}
                  />
                </FormControl>

                <FormMessage className={classNames?.error} />
              </FormItem>
            )}
          />
        )}

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
                  value={field.value as string}
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
              <FormLabel className={classNames?.label}>{localization.PASSWORD}</FormLabel>

              <FormControl>
                <PasswordInput
                  autoComplete="new-password"
                  className={classNames?.input}
                  placeholder={localization.PASSWORD_PLACEHOLDER}
                  disabled={isSubmitting}
                  enableToggle
                  {...field}
                  value={field.value as string}
                />
              </FormControl>

              <FormMessage className={classNames?.error} />
            </FormItem>
          )}
        />

        {confirmPasswordEnabled && (
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={classNames?.label}>{localization.CONFIRM_PASSWORD}</FormLabel>

                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    className={classNames?.input}
                    placeholder={localization.CONFIRM_PASSWORD_PLACEHOLDER}
                    disabled={isSubmitting}
                    enableToggle
                    {...field}
                    value={field.value as string}
                  />
                </FormControl>

                <FormMessage className={classNames?.error} />
              </FormItem>
            )}
          />
        )}

        {signUpFields
          ?.filter((field) => field !== "name" && field !== "image")
          .map((field) => {
            const additionalField = additionalFields?.[field];
            if (!additionalField) {
              console.error(`Additional field ${field} not found`);
              return null;
            }

            return additionalField.type === "boolean" ? (
              <FormField
                key={field}
                control={form.control}
                name={field}
                render={({ field: formField }) => (
                  <FormItem className="flex">
                    <FormControl>
                      <Checkbox
                        checked={formField.value as boolean}
                        onCheckedChange={formField.onChange}
                        disabled={isSubmitting}
                      />
                    </FormControl>

                    <FormLabel className={classNames?.label}>{additionalField.label}</FormLabel>

                    <FormMessage className={classNames?.error} />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                key={field}
                control={form.control}
                name={field}
                render={({ field: formField }) => (
                  <FormItem>
                    <FormLabel className={classNames?.label}>{additionalField.label}</FormLabel>

                    <FormControl>
                      {additionalField.type === "number" ? (
                        <Input
                          className={classNames?.input}
                          type="number"
                          placeholder={
                            additionalField.placeholder ||
                            (typeof additionalField.label === "string" ? additionalField.label : "")
                          }
                          disabled={isSubmitting}
                          {...formField}
                          value={formField.value as number}
                        />
                      ) : additionalField.multiline ? (
                        <Textarea
                          className={classNames?.input}
                          placeholder={
                            additionalField.placeholder ||
                            (typeof additionalField.label === "string" ? additionalField.label : "")
                          }
                          disabled={isSubmitting}
                          {...formField}
                          value={formField.value as string}
                        />
                      ) : (
                        <Input
                          className={classNames?.input}
                          type="text"
                          placeholder={
                            additionalField.placeholder ||
                            (typeof additionalField.label === "string" ? additionalField.label : "")
                          }
                          disabled={isSubmitting}
                          {...formField}
                          value={formField.value as string}
                        />
                      )}
                    </FormControl>

                    <FormMessage className={classNames?.error} />
                  </FormItem>
                )}
              />
            );
          })}

        <Captcha ref={captchaRef} localization={localization} action="/sign-up/email" />

        <Button
          type="submit"
          disabled={isSubmitting}
          className={cn("w-full", classNames?.button, classNames?.primaryButton)}
        >
          {isSubmitting ? <Loader2 className="animate-spin" /> : localization.SIGN_UP_ACTION}
        </Button>
      </form>
    </Form>
  );
}
