import {
  BotIcon,
  BoxesIcon,
  BoxIcon,
  ChartLineIcon,
  CogIcon,
  CreditCard,
  HardDriveIcon,
  KeyRoundIcon,
  LayoutTemplateIcon,
  LogOutIcon,
  WorkflowIcon,
} from "lucide-react";
import { Path } from "@/enums/paths";

export const DASHBOARD_SIDEBAR_LINKS = [
  {
    title: "General",
    url: "#",
    items: [
      {
        title: "Dashboard",
        url: Path.DASHBOARD,
        icon: LayoutTemplateIcon,
        isActive: true,
      },
      {
        title: "Vera Builder",
        url: "#",
        icon: BotIcon,
      },
      {
        title: "Sandboxes",
        url: "#",
        icon: BoxIcon,
      },
      {
        title: "Images",
        url: "#",
        icon: BoxesIcon,
      },
      {
        title: "Storages",
        url: "#",
        icon: HardDriveIcon,
      },
      {
        title: "Triggers",
        url: "#",
        icon: WorkflowIcon,
      },
      {
        title: "API Keys",
        url: Path.API_KEYS,
        icon: KeyRoundIcon,
      },
      {
        title: "Usage",
        url: Path.USAGE,
        icon: ChartLineIcon,
      },
    ],
  },
  {
    title: "More",
    url: "#",
    items: [
      {
        title: "Billing",
        url: "#",
        icon: CreditCard,
      },
      {
        title: "Settings",
        url: "#",
        icon: CogIcon,
      },
      {
        title: "Logout",
        url: Path.LOGOUT,
        icon: LogOutIcon,
      },
    ],
  },
];

export const FOOTER_LINKS = [
  {
    title: "Product",
    links: [
      { name: "Home", href: "/" },
      { name: "Features", href: "/" },
      { name: "Pricing", href: "/" },
      { name: "Contact", href: "/" },
      { name: "Download", href: "/" },
    ],
  },
  {
    title: "Resources",
    links: [
      { name: "Blog", href: "/blog" },
      { name: "Help Center", href: "/help-center" },
      { name: "Community", href: "/community" },
      { name: "Guides", href: "/guides" },
    ],
  },
  {
    title: "Legal",
    links: [
      { name: "Privacy", href: "/privacy" },
      { name: "Terms", href: "/terms" },
      { name: "Cookies", href: "/cookies" },
    ],
  },
  {
    title: "Developers",
    links: [
      { name: "API Docs", href: "/api-docs" },
      { name: "SDKs", href: "/sdks" },
      { name: "Tools", href: "/tools" },
      { name: "Open Source", href: "/open-source" },
      { name: "Changelog", href: "/changelog" },
    ],
  },
];
