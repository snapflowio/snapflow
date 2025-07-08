import { Link } from "react-router";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Particles } from "@/components/ui/particles";
import { Wrapper } from "@/components/wrapper";
import { FOOTER_LINKS } from "@/constants/links";
import { SITE_CONFIG } from "@/constants/site";
import Container from "../components/container";

const Footer = () => {
  return (
    <footer className="relative w-full py-10">
      <Container>
        <Wrapper className="footer relative flex flex-col justify-between overflow-hidden pb-40 md:flex-row">
          <Particles
            className="-z-10 absolute inset-0 w-full"
            quantity={40}
            ease={10}
            color="#d4d4d8"
            refresh
          />
          <div className="flex max-w-48 flex-col items-start">
            <div className="flex items-center gap-2">
              <Logo size={24} />
              <span className="font-bold text-xl">{SITE_CONFIG.NAME}</span>
            </div>
            <p className="max-w mt-4 text-base">
              Your personal generalist AI agent.
            </p>
            <Button className="mt-8">
              <Link to="/app">Start for free</Link>
            </Button>
          </div>
          <div className="mt-10 grid w-full max-w-lg grid-cols-2 gap-8 md:mt-0 lg:grid-cols-4">
            {FOOTER_LINKS?.map((section, index) => (
              <div key={index} className="flex flex-col gap-4">
                <h4 className="font-medium text-sm">{section.title}</h4>
                <ul className="w-full space-y-4">
                  {section.links.map((link, index) => (
                    <li
                      key={index}
                      className="w-full text-muted-foreground text-sm transition-all hover:text-foreground"
                    >
                      <Link to={link.href} className="w-full">
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Wrapper>
      </Container>
      <Container>
        <Wrapper className="relative flex items-center justify-between pt-10">
          <p className="text-secondary-foreground text-sm">
            &copy; {new Date().getFullYear()} {SITE_CONFIG.NAME}. All rights
            reserved.
          </p>
        </Wrapper>
      </Container>
    </footer>
  );
};

export default Footer;
