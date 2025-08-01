import type { HTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";

export default function Avatar(props: HTMLAttributes<HTMLDivElement>) {
  const { className, children, ...otherProps } = props;

  return (
    <div
      className={twMerge(
        "size-20 overflow-hidden rounded-full border-4 border-primary bg-neutral-900 p-1",
        className
      )}
      {...otherProps}
    >
      {children}
    </div>
  );
}
