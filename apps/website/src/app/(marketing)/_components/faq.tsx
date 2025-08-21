"use client";

import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SITE_CONFIG } from "@/constants/site";

export default function FAQ() {
  const faqItems = [
    {
      question: "What makes Snapflow different?",
      answer:
        "Standard shipping takes 3-5 business days, depending on your location. Express shipping options are available at checkout for 1-2 business day delivery.",
    },
    {
      question: "What payment methods do you accept?",
      answer:
        "We accept all major credit cards (Visa, Mastercard, American Express), PayPal, Apple Pay, and Google Pay. For enterprise customers, we also offer invoicing options.",
    },
    {
      question: "Can I change or cancel my order?",
      answer:
        "You can modify or cancel your order within 1 hour of placing it. After this window, please contact our customer support team who will assist you with any changes.",
    },
    {
      question: "Do you ship internationally?",
      answer:
        "Yes, we ship to over 50 countries worldwide. International shipping typically takes 7-14 business days. Additional customs fees may apply depending on your country's import regulations.",
    },
    {
      question: "What is your return policy?",
      answer:
        "We offer a 30-day return policy for most items. Products must be in original condition with tags attached. Some specialty items may have different return terms, which will be noted on the product page.",
    },
  ];

  return (
    <section>
      <div className="mx-auto max-w-5xl px-4 md:px-6">
        <div className="mx-auto mb-12 flex max-w-2xl flex-col items-center text-center">
          <h2 className="!leading-snug mt-4 font-bold font-heading text-2xl md:text-4xl lg:text-5xl">
            Frequently Asked Questions
          </h2>
          <p className="mt-4 text-center text-accent-foreground/80 text-base md:text-lg">
            Discover quick and comprehensive answers to common questions about our platform,
            services, and features.
          </p>
        </div>
        <div className="mx-auto mt-12 max-w-2/3">
          <Accordion
            type="single"
            collapsible
            className="w-full rounded-2xl border bg-card px-8 py-3 shadow-sm ring-muted dark:ring-0"
          >
            {faqItems.map((item, index) => (
              <AccordionItem key={index} value={index.toString()} className="border-dashed">
                <AccordionTrigger className="cursor-pointer text-base hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-base">{item.answer}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <p className="mt-6 w-full px-8 text-center text-muted-foreground">
            Can't find what you're looking for? Contact us at{" "}
            <Link
              href={`mailto:${SITE_CONFIG.SUPPORT_EMAIL}`}
              className="font-medium text-primary hover:underline"
            >
              {SITE_CONFIG.SUPPORT_EMAIL}
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
