import { Outlet } from "react-router";
import { Footer } from "./components/footer";
import { Header } from "./components/header";

export function MarketingLayout() {
  return (
    <>
      <Header />
      <Outlet />
      <Footer />
    </>
  );
}
