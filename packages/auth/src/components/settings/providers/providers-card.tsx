import { CardContent, cn } from "@snapflow/ui";
import { useContext } from "react";
import { AuthUIContext } from "../../../lib/auth-ui-provider";
import { socialProviders } from "../../../lib/social-providers";
import type { AuthLocalization } from "../../../localization/auth";
import type { Refetch } from "../../../types/refetch";
import type { SettingsCardClassNames } from "../shared/settings-card";
import { SettingsCard } from "../shared/settings-card";
import { SettingsCellSkeleton } from "../skeletons/settings-cell-skeleton";
import { ProviderCell } from "./provider-cell";

export interface ProvidersCardProps {
  className?: string;
  classNames?: SettingsCardClassNames;
  accounts?: { accountId: string; provider: string }[] | null;
  isPending?: boolean;
  localization?: Partial<AuthLocalization>;
  skipHook?: boolean;
  refetch?: Refetch;
}

export function ProvidersCard({
  className,
  classNames,
  accounts,
  isPending,
  localization,
  skipHook,
  refetch,
}: ProvidersCardProps) {
  const {
    hooks: { useListAccounts },
    localization: contextLocalization,
    social,
    genericOAuth,
  } = useContext(AuthUIContext);

  localization = { ...contextLocalization, ...localization };

  if (!skipHook) {
    const result = useListAccounts();
    accounts = result.data;
    isPending = result.isPending;
    refetch = result.refetch;
  }

  return (
    <SettingsCard
      className={className}
      classNames={classNames}
      title={localization.PROVIDERS}
      description={localization.PROVIDERS_DESCRIPTION}
      isPending={isPending}
    >
      <CardContent className={cn("grid gap-4", classNames?.content)}>
        {isPending ? (
          social?.providers?.map((provider) => (
            <SettingsCellSkeleton key={provider} classNames={classNames} />
          ))
        ) : (
          <>
            {social?.providers?.map((provider) => {
              const socialProvider = socialProviders.find(
                (socialProvider) => socialProvider.provider === provider
              );

              if (!socialProvider) {
                return null;
              }

              return (
                <ProviderCell
                  key={provider}
                  classNames={classNames}
                  account={accounts?.find((acc) => acc.provider === provider)}
                  provider={socialProvider}
                  refetch={refetch}
                />
              );
            })}

            {genericOAuth?.providers?.map((provider) => (
              <ProviderCell
                key={provider.provider}
                classNames={classNames}
                account={accounts?.find((acc) => acc.provider === provider.provider)}
                provider={provider}
                refetch={refetch}
                other
              />
            ))}
          </>
        )}
      </CardContent>
    </SettingsCard>
  );
}
