import { ArrowRightIcon } from "lucide-react";
import { Link } from "react-router";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { NavigationMenu, NavigationMenuList } from "@/components/ui/navigation-menu";
import { Path } from "@/enums/paths";

export function Header() {
  return (
    <header className="fixed right-0 left-0 z-[9999] flex w-full justify-center">
      <div className="mx-auto w-full border-b bg-background px-16">
        <nav aria-label="Main navigation">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center space-x-10">
              <div className="flex items-center space-x-4">
                <Logo size={24} />
                <span className="font-black text-xl">
                  <span className="bg-gradient-to-t from-primary to-primary/90 bg-clip-text text-transparent">
                    Snapflow
                  </span>
                  <span className="bg-gradient-to-t from-[#7D5AF3] to-[#ae62fc]/90 bg-clip-text text-transparent">
                    .io
                  </span>
                </span>
              </div>
              <NavigationMenu className="hidden items-center md:flex" aria-label="Main menu">
                <NavigationMenuList className="mt-0.5 flex items-center space-x-4 text-slate-200">
                  <Link
                    to={Path.PRICING}
                    className="flex items-center font-bold text-sm hover:text-primary"
                  >
                    Pricing
                  </Link>
                  <Link to={"/"} className="flex items-center font-bold text-sm hover:text-primary">
                    Docs
                  </Link>
                </NavigationMenuList>
              </NavigationMenu>
            </div>
            <div className="flex items-center">
              <Button className="flex items-center rounded-lg" size={"sm"} asChild>
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
