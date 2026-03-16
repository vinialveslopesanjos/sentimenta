import type { PlanSlug } from "./user";

export interface PlanLimits {
    max_connections: number;
    max_posts_per_sync: number;
    max_comments_per_post: number;
    syncs_per_month: number;
    apify_budget_brl: number;
    health_report: boolean;
    pdf_export: boolean;
    comparison: boolean;
}

export const PLAN_CONFIG: Record<PlanSlug, PlanLimits> = {
    free: {
        max_connections: 1,
        max_posts_per_sync: 2,
        max_comments_per_post: 100,
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
        max_connections: 5,
        max_posts_per_sync: 50,
        max_comments_per_post: 500,
        syncs_per_month: 30,
        apify_budget_brl: 250,
        health_report: true,
        pdf_export: true,
        comparison: true,
    },
    agency: {
        max_connections: 15,
        max_posts_per_sync: 100,
        max_comments_per_post: 1000,
        syncs_per_month: 60,
        apify_budget_brl: 800,
        health_report: true,
        pdf_export: true,
        comparison: true,
    },
    enterprise: {
        max_connections: 30,
        max_posts_per_sync: 200,
        max_comments_per_post: 2500,
        syncs_per_month: 120,
        apify_budget_brl: 2000,
        health_report: true,
        pdf_export: true,
        comparison: true,
    },
    admin: {
        max_connections: 100,
        max_posts_per_sync: 999999,
        max_comments_per_post: 999999,
        syncs_per_month: 999999,
        apify_budget_brl: 999999,
        health_report: true,
        pdf_export: true,
        comparison: true,
    },
};

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
        name: "Gratis",
        price_brl: 0,
        description: "Teste a Sentimenta com uma conexao e uma analise por mes.",
    },
    {
        slug: "creator",
        name: "Creator",
        price_brl: 67,
        description: "Para criadores que querem entender seu publico de verdade.",
    },
    {
        slug: "pro",
        name: "Pro",
        price_brl: 167,
        description: "Para marcas e profissionais que levam redes sociais a serio.",
        highlight: true,
    },
    {
        slug: "agency",
        name: "Agency",
        price_brl: 397,
        description: "Para agencias que gerenciam multiplos perfis.",
    },
    {
        slug: "enterprise",
        name: "Enterprise",
        price_brl: 0,
        description: "Sob consulta para operacoes de maior porte.",
    },
];
