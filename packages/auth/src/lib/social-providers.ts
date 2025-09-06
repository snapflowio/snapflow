import {
  AppleIcon,
  DiscordIcon,
  FacebookIcon,
  GitHubIcon,
  GoogleIcon,
  type ProviderIcon,
} from "../components/provider-icons";

export const socialProviders = [
  {
    provider: "apple",
    name: "Apple",
    icon: AppleIcon,
  },
  {
    provider: "discord",
    name: "Discord",
    icon: DiscordIcon,
  },
  {
    provider: "facebook",
    name: "Facebook",
    icon: FacebookIcon,
  },
  {
    provider: "github",
    name: "GitHub",
    icon: GitHubIcon,
  },
  {
    provider: "google",
    name: "Google",
    icon: GoogleIcon,
  },
] as const;

export type Provider = {
  provider: string;
  name: string;
  icon?: ProviderIcon;
};
