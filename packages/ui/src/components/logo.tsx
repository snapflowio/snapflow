import { Link } from "@tanstack/react-router";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <Link to={"/"}>
      <img
        src={"/branding/logo.png"}
        alt="snapflow logo"
        width={size}
        height={size}
        draggable="false"
      />
      <span className="sr-only">Snapflow logo</span>
    </Link>
  );
}
