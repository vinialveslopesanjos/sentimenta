"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ds/Button";
import { getAttribution, track } from "@/lib/tracking";

type CampaignCtaProps = {
  href: string;
  label: string;
  campaign: string;
  location: string;
  variant?: "primary" | "secondary" | "outline";
};

export function CampaignCta({
  href,
  label,
  campaign,
  location,
  variant = "primary",
}: CampaignCtaProps) {
  return (
    <Link
      href={href}
      onClick={() => {
        track("landing_cta_clicked", {
          campaign,
          location,
          attribution: getAttribution(),
        });
      }}
    >
      <Button size="lg" variant={variant} iconRight={<ArrowRight className="h-4 w-4" />}>
        {label}
      </Button>
    </Link>
  );
}
