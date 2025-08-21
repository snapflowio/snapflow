import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FlickeringGrid } from "@/components/ui/flickering-grid";
import { RainbowButton } from "@/components/ui/rainbow-button";

const cpuPrice = {
  name: "Physical core (1 vCPU)",
  price: "0.0000131",
  note: "*each sandbox has a minimum of 1 core",
};

const memoryPrice = {
  name: "Memory",
  price: "0.00000222",
};

function LeftContent() {
  return (
    <div className="z-10">
      <h1 className="font-bold text-5xl leading-tight tracking-tighter md:text-7xl">
        Simple pricing <br />
        <span className="text-primary">without </span> all <br />
        the headaches
      </h1>
      <p className="mt-4 max-w-md text-lg text-muted-foreground">
        Pricing without the hassle, you always pay for what you use and nothing more. Only pay when
        your sandboxes are running. New accounts get <b>$10 worth of credit</b>, on us.
      </p>
      <div className="mt-8 flex items-center gap-4">
        <RainbowButton size="lg">Get Started</RainbowButton>
      </div>
    </div>
  );
}

function DecorativeBars() {
  return (
    <div className="absolute bottom-0 left-0 z-0 h-64 w-full overflow-hidden md:w-1/2 lg:h-80">
      <div className="absolute bottom-0 left-0 flex h-full items-end gap-1 md:gap-2 lg:gap-4">
        <FlickeringGrid
          className="relative inset-0 z-0 [mask-image:linear-gradient(to_top_right,white,transparent,transparent)]"
          squareSize={4}
          gridGap={6}
          color="#fff"
          maxOpacity={0.5}
          flickerChance={0.1}
          height={800}
          width={800}
        />
      </div>
    </div>
  );
}

function RightContent() {
  return (
    <Card className="z-10">
      <CardHeader>
        <CardTitle>Compute Pricing</CardTitle>
        <CardDescription>Pay by the CPU cycle</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-border/50 border-t pt-4">
          <h3 className="mb-4 font-medium text-muted-foreground text-sm">CPU</h3>
          <div className="flex items-start justify-between text-sm">
            <div>
              <p className="text-foreground/90">{cpuPrice.name}</p>
              <p className="mt-1 text-muted-foreground text-xs">{cpuPrice.note}</p>
            </div>
            <span className="whitespace-nowrap pl-4 font-mono text-foreground">
              ${cpuPrice.price} / core / sec
            </span>
          </div>
        </div>

        <div className="border-border/50 border-t pt-4">
          <h3 className="mb-4 font-medium text-muted-foreground text-sm">MEMORY</h3>
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground/90">{memoryPrice.name}</span>
            <span className="font-mono text-foreground">${memoryPrice.price} / GiB / sec</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PricingPage() {
  return (
    <div className="relative flex min-h-screen w-full justify-center overflow-x-hidden bg-background font-sans text-foreground">
      <main className="container mx-auto px-6 pt-32 pb-20 lg:pt-40">
        <div className="grid grid-cols-1 items-start gap-x-8 gap-y-16 lg:grid-cols-2">
          <LeftContent />
          <RightContent />
        </div>
      </main>
      <DecorativeBars />
    </div>
  );
}
