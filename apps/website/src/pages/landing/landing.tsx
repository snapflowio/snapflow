import { Header } from "./section/header";
import { Hero } from "./section/hero";

export default function Landing() {
  return (
    <>
      <Header />
      <main className="relative z-40 mx-auto w-full">
        <Hero />
      </main>
    </>
  );
}
