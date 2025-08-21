"use client";

import { Footer } from "./_components/footer";
import { Header } from "./_components/header";

export default function MarketingLayout({ children }: React.PropsWithChildren) {
  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  );
}
