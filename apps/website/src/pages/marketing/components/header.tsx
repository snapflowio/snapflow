import { ArrowRightIcon } from "lucide-react";
import { Link } from "react-router";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { NavigationMenu, NavigationMenuList } from "@/components/ui/navigation-menu";
import { Path } from "@/enums/paths";

export function Header() {
  return (
    <header className="sticky top-10 right-0 left-0 z-[9999] flex justify-center">
      <div className="mx-auto w-full max-w-[1048px] rounded-lg border bg-background/30 px-8 backdrop-blur-lg">
        <nav aria-label="Main navigation">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-4">
                <Logo />
                <span className="font-bold text-xl">Snapflow</span>
              </div>
              <NavigationMenu className="hidden items-center md:flex" aria-label="Main menu">
                <NavigationMenuList className="mt-0.5 flex items-center space-x-4 text-slate-200">
                  <Link
                    to={Path.PRICING}
                    className="flex items-center font-bold text-sm hover:underline"
                  >
                    Pricing
                  </Link>
                  <Link to={"/"} className="flex items-center font-bold text-sm hover:underline">
                    Docs
                  </Link>
                </NavigationMenuList>
              </NavigationMenu>
            </div>
            <div className="flex items-center">
              <Button className="flex items-center rounded-lg" variant={"mono"} size="lg" asChild>
                <Link to="/dashboard" className="flex items-center">
                  Open App
                  <ArrowRightIcon />
                </Link>
              </Button>
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}
