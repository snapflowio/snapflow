import { features } from "@/constants/features";
import { cn } from "@/lib/utils";
import { SignedIn, SignedOut } from "@snapflow/auth";
import {
    Button,
    Logo,
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
    navigationMenuTriggerStyle,
} from "@snapflow/ui";
import { Link } from "@tanstack/react-router";
import { ChevronRightIcon, MenuIcon } from "lucide-react";
import { forwardRef, useState } from "react";

const ListItem = forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div"> & { icon: React.ReactNode }
>(({ className, title, children, icon, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <div
          ref={ref}
          className={cn(
            "z-50 flex select-none items-start gap-3 rounded-md border border-transparent px-4 py-3 leading-none no-underline outline-none transition-colors hover:border-gray-element-border hover:bg-gray-element hover:text-gray-foreground focus:border-gray-element-border focus:bg-gray-element focus:text-gray-foreground",
            className
          )}
          {...props}
        >
          <div className="size-[18px]">{icon}</div>
          <div className="space-y-2">
            <div className="font-medium text-foreground text-sm leading-none">{title}</div>
            <p className="line-clamp-2 text-xs leading-normal">{children}</p>
          </div>
        </div>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = "ListItem";

export const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className={cn("z-50 w-full pt-4 pb-0 md:py-4")}>
      <div className="container flex items-center justify-between transition-all">
        <div className="flex items-center gap-3">
          <Logo size={34} />
          <span className="font-black text-lg tracking-wide">Snapflow</span>
        </div>

        <NavigationMenu className="hidden md:block">
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Features</NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="-translate-y-1/2 absolute top-1/2 right-36 z-30 size-20 rounded-full bg-pink opacity-50 blur-3xl" />
                <ul className="grid gap-3 p-3 md:w-[450px] lg:w-[550px] lg:grid-cols-[1fr_0.85fr]">
                  <div className="flex flex-col gap-3">
                    {features(18).map((feature) => (
                      <ListItem key={feature.title} title={feature.title} icon={feature.icon}>
                        {feature.description}
                      </ListItem>
                    ))}
                  </div>
                  <li>
                    <NavigationMenuLink asChild>
                      <div className="flex size-full select-none flex-col justify-end rounded-md border border-gray-element-border bg-gray-element/50 px-6 py-3 pt-6 no-underline outline-none backdrop-blur-lg transition-colors hover:bg-gray-element/75 focus:shadow-md">
                        <Logo size={34} />
                        <div className="mt-4 mb-2 font-medium text-foreground text-lg">Snapflow</div>
                        <p className="text-foreground-muted text-sm leading-snug">
                          Helping students stay productive and on top of their work.
                        </p>

                        <a
                          href={"/"}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="mt-6 flex items-center gap-2 py-2 text-sm transition-colors hover:text-gray-foreground"
                        >
                          Contribute <ChevronRightIcon size={13} />
                        </a>
                      </div>
                    </NavigationMenuLink>
                  </li>
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link to="/">
                <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                  Blog
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink
                href={""}
                target="_blank"
                rel="noreferrer noopener"
                className={navigationMenuTriggerStyle()}
              >
                Contribute
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink
                href={""}
                target="_blank"
                rel="noreferrer noopener"
                className={navigationMenuTriggerStyle()}
              >
                Discord
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
        <div className="hidden items-center gap-4 md:flex">
          <SignedIn>
            <Button size="sm" asChild>
              <Link to="/home">
                Open App <ChevronRightIcon size={16} />
              </Link>
            </Button>
          </SignedIn>
          <SignedOut>
            <Button size="sm" asChild>
              <a href="/auth/sign-in">Login</a>
            </Button>
          </SignedOut>
        </div>
        <div className="block md:hidden">
          <button
            type="button"
            onClick={() => {
              setMenuOpen((prev) => !prev);
            }}
          >
            <MenuIcon size={24} />
          </button>
        </div>
      </div>
      <div className={cn("block h-0 overflow-hidden md:hidden", menuOpen && "h-full pt-6")}>
        <div className="container">
          <ul className="flex flex-col gap-3">
            <li>
              <Link to="/">Early access</Link>
            </li>
            <li>
              <Link to="/">Blog</Link>
            </li>
            <li>
              <a href={"/"} target="_blank" rel="noreferrer noopener">
                Contribute
              </a>
            </li>
            <li>
              <a href={"/"} target="_blank" rel="noreferrer noopener">
                Discord
              </a>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};
