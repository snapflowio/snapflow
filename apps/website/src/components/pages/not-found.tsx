import { Button } from "@snapflow/ui";
import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";

export function NotFound() {
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden">
      <div className="container relative z-10 mx-auto px-4 py-16 text-center">
        <div className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 h-[300px] w-[600px] rounded-full blur-[128px]" />
        <div className="relative space-y-6">
          <h1 className="-tracking-tight font-black text-9xl">404</h1>
          <h2 className="pb-1 font-bold text-5xl text-white/80 tracking-tighter md:text-6xl">
            Page not found
          </h2>
          <p className="mx-auto max-w-[600px] text-lg text-muted-foreground">
            The page you are looking for doesnt exist or it has been moved.
          </p>
          <div className="pt-3">
            <Button className="rounded-full" asChild>
              <Link to={"/"}>
                <ArrowLeftIcon />
                <span>Go back home</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
