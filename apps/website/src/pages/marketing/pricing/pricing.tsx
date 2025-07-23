import { GridPattern } from "@/components/ui/grid-pattern";
import { cn } from "@/lib/util";
import { PricingTable } from "./components/pricing-table";

export function Pricing() {
  return (
    <>
      <GridPattern
        className={cn(
          "stroke-muted [mask-image:linear-gradient(to_bottom_right,white,transparent,transparent)]"
        )}
      />
      <main className="container my-32 flex-1 items-center justify-center">
        <div className="-z-20 absolute top-0 h-2/3 w-full rounded-lg bg-background" />
        <PricingTable />
      </main>
    </>
  );
}
