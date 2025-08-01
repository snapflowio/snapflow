import {
  BlocksIcon,
  CheckCircleIcon,
  CircleCheckIcon,
  CreditCardIcon,
  LayoutIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { Check } from "@/components/bootstrap/components/check";
import { ForEach } from "@/components/bootstrap/components/for-each";
import { Switch } from "@/components/bootstrap/components/switch-case";
import { Whenever } from "@/components/bootstrap/components/whenever";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/util";
import { PRICING_FEATURES, PRICING_PLANS } from "@/constants/plans";

export function PricingTable() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <ForEach items={Object.values(PRICING_PLANS)}>
        {(plan) => <PricingCard key={plan.id} pricing={plan} />}
      </ForEach>
    </div>
  );
}

type PricingCardProps = {
  pricing: (typeof PRICING_PLANS)[keyof typeof PRICING_PLANS];
};

function PricingCard({ pricing }: PricingCardProps) {
  return (
    <Card className="relative max-w-96 rounded-4xl px-2 pt-22">
      <Switch match={pricing.id}>
        <Switch.Case value={"free"}>
          <div className="absolute inset-x-8 top-10 bottom-auto w-fit rounded-xl bg-accent p-3">
            <BlocksIcon size={26} />
          </div>
        </Switch.Case>
        <Switch.Case value={"hobby"}>
          <div className="absolute inset-x-8 top-10 bottom-auto w-fit rounded-xl bg-accent p-3">
            <LayoutIcon size={26} />
          </div>
        </Switch.Case>
        <Switch.Case value={"pro"}>
          <div className="absolute inset-x-8 top-10 bottom-auto w-fit rounded-xl bg-accent p-3">
            <CreditCardIcon size={26} />
          </div>
        </Switch.Case>
      </Switch>
      <CardHeader>
        <CardTitle className="mt-4 font-bold font-heading text-3xl">{pricing.name}</CardTitle>
        <CardDescription className="mt-4">{pricing.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="flex items-end gap-2 text-primary">
          <span className="font-bold font-heading text-5xl">
            <Check>
              <Check.When condition={pricing.id === "free"}>Free</Check.When>
              <Check.Else>${pricing.price}</Check.Else>
            </Check>
          </span>
        </p>
        <div className="flex flex-col gap-4 pt-5">
          <p className="font-medium text-md">Features in {pricing.name} plan:</p>
          <ul className="flex flex-col gap-3">
            <Whenever condition={pricing.features?.length > 0}>
              <ForEach items={pricing.features}>
                {(feature, index) => (
                  <li key={`${feature} ${index}`} className="flex items-start gap-3">
                    <CheckCircleIcon className="size-5 shrink-0" />
                    <span className="text-md">{feature}</span>
                  </li>
                )}
              </ForEach>
            </Whenever>
            <ForEach items={PRICING_FEATURES}>
              {(feature) => (
                <li key={feature.id} className="flex items-start gap-3">
                  <Whenever condition={feature.inludedIn.includes(pricing.id)} not={false}>
                    <CircleCheckIcon className="size-5 shrink-0" />
                  </Whenever>
                  <Whenever condition={!feature.inludedIn.includes(pricing.id)}>
                    <XIcon className="size-5 shrink-0 text-muted-foreground/60" />
                  </Whenever>
                  <span
                    className={cn(
                      "text-md",
                      !feature.inludedIn.includes(pricing.id) ? "text-muted-foreground/60" : ""
                    )}
                  >
                    {feature.title}
                  </span>
                </li>
              )}
            </ForEach>
          </ul>
        </div>
      </CardContent>
      <CardFooter className="mt-5">
        <Button
          size="lg"
          className="w-full cursor-pointer"
          type="submit"
          variant={pricing.buttonHighlighted ? "default" : "secondary"}
          asChild
        >
          <Link href={""}>Get Started</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
