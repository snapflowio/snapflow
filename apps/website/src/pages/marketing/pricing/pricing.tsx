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
      <main className="container flex-1 items-center justify-center py-32">
        <PricingTable />
      </main>
    </>
  );
}
