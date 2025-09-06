import type { AuthLocalization } from "@/localization/auth";
import {
    Button,
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
    Label,
} from "@snapflow/ui";
import { cn } from "@snapflow/ui/lib/utils";
import { MenuIcon } from "lucide-react";
import { useContext, useMemo } from "react";
import { AuthUIContext } from "../../lib/auth-ui-provider";
import { getViewByPath } from "../../lib/utils";
import type { AccountViewPath } from "../../server";
import { AccountSettingsCards } from "../settings/account-settings-cards";
import { SecuritySettingsCards } from "../settings/security-settings-cards";
import type { SettingsCardClassNames } from "../settings/shared/settings-card";

export interface AccountViewProps {
  className?: string;
  classNames?: {
    base?: string;
    cards?: string;
    drawer?: { menuItem?: string };
    sidebar?: { base?: string; button?: string; buttonActive?: string };
    card?: SettingsCardClassNames;
  };
  localization?: AuthLocalization;
  path?: string;
  pathname?: string;
  view?: AccountViewPath;
  hideNav?: boolean;
}

export function AccountView({
  className,
  classNames,
  localization: localizationProp,
  path: pathProp,
  pathname,
  view: viewProp,
  hideNav,
}: AccountViewProps) {
  const {
    apiKey,
    localization: contextLocalization,
    account: accountOptions,
    Link,
  } = useContext(AuthUIContext);

  if (!accountOptions) {
    return null;
  }

  const localization = useMemo(
    () => ({ ...contextLocalization, ...localizationProp }),
    [contextLocalization, localizationProp]
  );

  const path = pathProp ?? pathname?.split("/").pop();

  const view = viewProp || getViewByPath(accountOptions.viewPaths, path) || "SETTINGS";

  const navItems: {
    view: AccountViewPath;
    label: string;
  }[] = [
    { view: "SETTINGS", label: localization.ACCOUNT },
    { view: "SECURITY", label: localization.SECURITY },
  ];

  if (apiKey) {
    navItems.push({
      view: "API_KEYS",
      label: localization.API_KEYS,
    });
  }

  return (
    <div
      className={cn(
        "flex w-full grow flex-col gap-4 md:flex-row md:gap-12",
        className,
        classNames?.base
      )}
    >
      {!hideNav && (
        <div className="flex justify-between gap-2 md:hidden">
          <Label className="text-base font-semibold">
            {navItems.find((i) => i.view === view)?.label}
          </Label>

          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="outline">
                <MenuIcon />
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle className="hidden">{localization.SETTINGS}</DrawerTitle>
              </DrawerHeader>
              <div className="flex flex-col px-4 pb-4">
                {navItems.map((item) => (
                  <Link
                    key={item.view}
                    href={`${accountOptions?.basePath}/${accountOptions?.viewPaths[item.view]}`}
                  >
                    <Button
                      size="lg"
                      className={cn(
                        "w-full justify-start px-4 transition-none",
                        classNames?.drawer?.menuItem,
                        view === item.view ? "font-semibold" : "text-foreground/70"
                      )}
                      variant="ghost"
                    >
                      {item.label}
                    </Button>
                  </Link>
                ))}
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      )}

      {!hideNav && (
        <div className="hidden md:block">
          <div className={cn("flex w-48 flex-col gap-1 lg:w-60", classNames?.sidebar?.base)}>
            {navItems.map((item) => (
              <Link
                key={item.view}
                href={`${accountOptions?.basePath}/${accountOptions?.viewPaths[item.view]}`}
              >
                <Button
                  size="lg"
                  className={cn(
                    "w-full justify-start px-4 transition-none",
                    classNames?.sidebar?.button,
                    view === item.view ? "font-semibold" : "text-foreground/70",
                    view === item.view && classNames?.sidebar?.buttonActive
                  )}
                  variant="ghost"
                >
                  {item.label}
                </Button>
              </Link>
            ))}
          </div>
        </div>
      )}

      {view === "SETTINGS" && (
        <AccountSettingsCards classNames={classNames} localization={localization} />
      )}

      {view === "SECURITY" && (
        <SecuritySettingsCards classNames={classNames} localization={localization} />
      )}
    </div>
  );
}
