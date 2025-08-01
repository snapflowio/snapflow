import Image from "next/image";
import Link from "next/link";

export function Logo({ size = 28, asLink = true }: { size?: number; asLink?: boolean }) {
  const logoImage = (
    <Image
      src={"/branding/logo.png"}
      alt="snapflow logo"
      width={size}
      height={size}
      draggable="false"
    />
  );

  if (!asLink) {
    return (
      <>
        {logoImage}
        <span className="sr-only">Snapflow logo</span>
      </>
    );
  }

  return (
    <Link href={"/"}>
      {logoImage}
      <span className="sr-only">Snapflow logo</span>
    </Link>
  );
}
