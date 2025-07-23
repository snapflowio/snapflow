import type { HTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";

export default function Key(props: HTMLAttributes<HTMLDivElement>) {
  const { className, children, ...otherProps } = props;

  return (
    <div
      className={twMerge(
        "inline-flex size-14 items-center justify-center rounded-2xl bg-card font-medium text-white text-xl",
        className,
      )}
      {...otherProps}
    >
      {children}
    </div>
  );
}
