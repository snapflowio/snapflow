import { CardDescription, CardFooter, cn, Skeleton } from "@snapflow/ui";
import type { ReactNode } from "react";
import { SettingsActionButton } from "./settings-action-button";
import type { SettingsCardClassNames } from "./settings-card";

export interface SettingsCardFooterProps {
  className?: string;
  classNames?: SettingsCardClassNames;
  actionLabel?: ReactNode;
  disabled?: boolean;
  instructions?: ReactNode;
  isPending?: boolean;
  isSubmitting?: boolean;
  optimistic?: boolean;
  variant?: "default" | "destructive";
  action?: () => Promise<unknown> | unknown;
}

export function SettingsCardFooter({
  className,
  classNames,
  actionLabel,
  disabled,
  instructions,
  isPending,
  isSubmitting,
  variant,
  action,
}: SettingsCardFooterProps) {
  return (
    <CardFooter
      className={cn(
        "flex flex-row items-center justify-between gap-4 rounded-b-xl md:flex-row",
        (actionLabel || instructions) && "border-t !py-4",
        variant === "destructive" ? "border-destructive/30 bg-destructive/15" : "bg-sidebar",
        className,
        classNames?.footer
      )}
    >
      {isPending ? (
        <>
          {instructions && (
            <Skeleton
              className={cn("my-0.5 h-3 w-48 max-w-full md:h-4 md:w-56", classNames?.skeleton)}
            />
          )}

          {actionLabel && <Skeleton className={cn("h-8 w-14 md:ms-auto", classNames?.skeleton)} />}
        </>
      ) : (
        <>
          {instructions && (
            <CardDescription
              className={cn(
                "text-muted-foreground text-center text-xs md:text-start md:text-sm",
                classNames?.instructions
              )}
            >
              {instructions}
            </CardDescription>
          )}

          {actionLabel && (
            <SettingsActionButton
              classNames={classNames}
              actionLabel={actionLabel}
              disabled={disabled}
              isSubmitting={isSubmitting}
              variant={variant}
              onClick={action}
            />
          )}
        </>
      )}
    </CardFooter>
  );
}
