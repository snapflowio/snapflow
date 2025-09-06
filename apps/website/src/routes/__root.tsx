import { createRootRoute, Outlet } from "@tanstack/react-router";

import { Providers } from "@/providers/providers";

export const Route = createRootRoute({
  component: () => (
    <div className="font-geist">
      <Providers>
        <Outlet />
      </Providers>
    </div>
  ),
});
