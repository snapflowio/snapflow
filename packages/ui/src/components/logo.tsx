import Image from "next/image";
import Link from "next/link";

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <Link href={"/"}>
      <Image
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
