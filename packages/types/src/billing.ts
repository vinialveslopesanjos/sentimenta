// ─── Billing & Plans ──────────────────────────────────────────────

import type { PlanSlug } from "./user";

export interface PlanLimits {
    max_connections: number;
    max_posts_per_sync: number;
    max_comments_per_post: number;
    syncs_per_month: number;
    /** Maximum Apify cost in BRL allowed per billing cycle */
    apify_budget_brl: number;
    /** Whether the plan includes health report generation */
    health_report: boolean;
    /** Whether the plan includes PDF export */
    pdf_export: boolean;
    /** Whether the plan supports multi-connection comparison */
    comparison: boolean;
}

export const PLAN_CONFIG: Record<PlanSlug, PlanLimits> = {
    free: {
        max_connections: 1,
        max_posts_per_sync: 5,
        max_comments_per_post: 50,
        syncs_per_month: 1,
        apify_budget_brl: 10,
        health_report: false,
        pdf_export: false,
        comparison: false,
    },
    creator: {
        max_connections: 3,
        max_posts_per_sync: 20,
        max_comments_per_post: 300,
        syncs_per_month: 10,
        apify_budget_brl: 80,
        health_report: true,
        pdf_export: false,
        comparison: false,
    },
    pro: {
        max_connections: 10,
        max_posts_per_sync: 50,
        max_comments_per_post: 500,
        syncs_per_month: 30,
        apify_budget_brl: 250,
        health_report: true,
        pdf_export: true,
        comparison: true,
    },
    agency: {
        max_connections: 30,
        max_posts_per_sync: 100,
        max_comments_per_post: 1000,
        syncs_per_month: 100,
        apify_budget_brl: 800,
        health_report: true,
        pdf_export: true,
        comparison: true,
    },
};

// ─── Pricing Display ──────────────────────────────────────────────

export interface PlanPricing {
    slug: PlanSlug;
    name: string;
    price_brl: number;
    description: string;
    highlight?: boolean;
}

export const PLAN_PRICING: PlanPricing[] = [
    {
        slug: "free",
        name: "Grátis",
        price_brl: 0,
        description: "Teste a Sentimenta com uma conexão e uma análise por mês.",
    },
    {
        slug: "creator",
        name: "Creator",
        price_brl: 67,
        description: "Para criadores que querem entender seu público de verdade.",
    },
    {
        slug: "pro",
        name: "Pro",
        price_brl: 167,
        description: "Para marcas e profissionais que levam redes sociais a sério.",
        highlight: true,
    },
    {
        slug: "agency",
        name: "Agency",
        price_brl: 397,
        description: "Para agências que gerenciam múltiplos perfis.",
    },
];
