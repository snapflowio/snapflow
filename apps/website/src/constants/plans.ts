export const PLANS = {
  FREE: "free",
  HOBBY: "hobby",
  PRO: "pro",
} as const;

export type Plan = (typeof PLANS)[keyof typeof PLANS];

export const INTERVALS = {
  MONTH: "month",
  YEAR: "year",
} as const;

export type Interval = (typeof INTERVALS)[keyof typeof INTERVALS];

export const CURRENCIES = {
  DEFAULT: "usd",
  USD: "usd",
  EUR: "eur",
} as const;

export type PricingFeature = {
  id: string;
  title: string;
  inludedIn: string[];
};

export const PRICING_FEATURES: PricingFeature[] = [
  {
    id: "1",
    title: "Basic filters",
    inludedIn: [PLANS.FREE, PLANS.HOBBY, PLANS.PRO],
  },
  {
    id: "2",
    title: "Threat actor data",
    inludedIn: [PLANS.FREE, PLANS.HOBBY, PLANS.PRO],
  },
  {
    id: "3",
    title: "Vulnerability data",
    inludedIn: [PLANS.HOBBY, PLANS.PRO],
  },
  {
    id: "4",
    title: "Dark web events",
    inludedIn: [PLANS.HOBBY, PLANS.PRO],
  },
  {
    id: "5",
    title: "Priority support",
    inludedIn: [PLANS.HOBBY, PLANS.PRO],
  },
  {
    id: "6",
    title: "Realtime notifications",
    inludedIn: [PLANS.HOBBY, PLANS.PRO],
  },
  {
    id: "7",
    title: "Advanced filters",
    inludedIn: [PLANS.HOBBY, PLANS.PRO],
  },
  {
    id: "8",
    title: "Realtime data access",
    inludedIn: [PLANS.PRO],
  },
  {
    id: "9",
    title: "Batch IP search",
    inludedIn: [PLANS.PRO],
  },
];

export type Currency = (typeof CURRENCIES)[keyof typeof CURRENCIES];

export const PRICING_PLANS = {
  [PLANS.FREE]: {
    id: PLANS.FREE,
    name: "Free",
    description:
      "Everything you need to get started, no credit card or payment information required.",
    highlight: "No credit card required. No hidden fees.",
    buttonHighlighted: false,
    features: ["50,000 requests"],
    price: 0,
  },
  [PLANS.HOBBY]: {
    id: PLANS.HOBBY,
    badge: "Most Popular",
    name: "Hobby",
    description:
      "For hacktivists wanting to go more in depth. Higher priority and access to more blocks.",
    highlight: "No credit card required. No hidden fees.",
    buttonHighlighted: true,
    features: ["1,000,000 requests"],
    price: 10,
  },
  [PLANS.PRO]: {
    id: PLANS.PRO,
    name: "Pro",
    description:
      "Get access to everything Quasec has to offer, with longer runtimes and priority support.",
    highlight: "No credit card required. No hidden fees.",
    features: ["Unlimited requests"],
    buttonHighlighted: false,
    price: 20,
  },
} satisfies PricingPlan;

export type PricingPlan<T extends Plan = Plan> = {
  [key in T]: {
    id: string;
    name: string;
    badge?: string;
    description: string;
    highlight: string;
    buttonHighlighted: boolean;
    features?: string[];
    price: number;
  };
};

export const pricingIds = {
  free: "free",
  hobby: "hobby",
  pro: "pro",
} as const;
