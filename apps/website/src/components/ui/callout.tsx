import { Ban, CircleCheckBig, Info } from "lucide-react";
import { cn } from "@/lib/util";

interface CalloutProps {
  twClass?: string;
  children?: React.ReactNode;
  type?: keyof typeof dataCallout;
}

const dataCallout = {
  error: {
    icon: Ban,
    classes: "border-[#FA3ABF] bg-[#560134] text-[#FA3ABF]",
  },
  info: {
    icon: Info,
    classes: "bg-[#1A2F51] text-[#479DEC]",
  },
  success: {
    icon: CircleCheckBig,
    classes: "bg-primary text-backgrounf",
  },
};

export function Callout({ children, twClass, type = "info", ...props }: CalloutProps) {
  const { icon: Icon, classes } = dataCallout[type];
  return (
    <div
      className={cn(
        "mt-6 flex items-start space-x-3 rounded-lg border px-4 py-3 text-[15.6px] dark:border-none",
        classes,
        twClass
      )}
      {...props}
    >
      <div className="mt-1 shrink-0">
        <Icon className="size-5" />
      </div>
      <div className="[&>p]:my-0">{children}</div>
    </div>
  );
}
