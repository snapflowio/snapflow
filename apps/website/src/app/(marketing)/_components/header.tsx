import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { NavigationMenu, NavigationMenuList } from "@/components/ui/navigation-menu";
import { Path } from "@/constants/paths";

export function Header() {
  return (
    <header className="fixed top-0 right-0 left-0 z-[9999] flex w-full justify-center">
      <div className="mx-auto w-full border-b bg-background px-16">
        <nav aria-label="Main navigation">
          <div className="grid h-16 grid-cols-3 items-center">
            {/* Left - Navigation Links */}
            <div className="flex items-center justify-start">
              <NavigationMenu className="hidden items-center md:flex" aria-label="Main menu">
                <NavigationMenuList className="flex items-center space-x-6 text-slate-200">
                  <Link
                    href={Path.PRICING}
                    className="flex items-center font-bold text-sm hover:text-primary"
                  >
                    Pricing
                  </Link>
                  <Link
                    href={Path.BLOG}
                    className="flex items-center font-bold text-sm hover:text-primary"
                  >
                    Blog
                  </Link>
                  <Link
                    href={"/"}
                    className="flex items-center font-bold text-sm hover:text-primary"
                  >
                    Docs
                  </Link>
                  <Link
                    href={"https://discord.gg/8UhNBCV4aU"}
                    target="_blank"
                    className="flex items-center font-bold text-sm hover:text-primary"
                  >
                    Discord
                  </Link>
                </NavigationMenuList>
              </NavigationMenu>
            </div>

            {/* Center - Logo */}
            <div className="flex items-center justify-center">
              <Logo size={26} />
            </div>

            {/* Right - Open App Button */}
            <div className="flex items-center justify-end">
              <Button className="flex items-center rounded-lg" asChild>
                <Link href={Path.DASHBOARD} className="flex items-center">
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
