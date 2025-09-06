import { Alert, AlertDescription, AlertTitle, cn } from "@snapflow/ui";
import { AlertCircle } from "lucide-react";
import { useFormState } from "react-hook-form";
import type { AuthFormClassNames } from "./auth/auth-form";

export interface FormErrorProps {
  title?: string;
  classNames?: AuthFormClassNames;
}

export function FormError({ title, classNames }: FormErrorProps) {
  const { errors } = useFormState();

  if (!errors.root?.message) {
    return null;
  }

  return (
    <Alert variant="destructive" className={cn(classNames?.error)}>
      <AlertCircle className="self-center" />
      <AlertTitle>{title || "Error"}</AlertTitle>
      <AlertDescription>{errors.root.message}</AlertDescription>
    </Alert>
  );
}
