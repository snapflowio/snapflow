import Image from "next/image";
import Link from "next/link";

export function Logo({
  size = 28,
  asLink = false,
  className,
}: {
  size?: number;
  asLink?: boolean;
  className?: string;
}) {
  const logoImage = (
    <Image
      src="/branding/logo.png"
      alt="Snapflow"
      width={size}
      height={size}
      draggable={false}
      className={className}
      priority
    />
  );

  if (asLink) {
    return (
      <Link href="/" className="inline-flex items-center">
        {logoImage}
      </Link>
    );
  }

  return logoImage;
}
