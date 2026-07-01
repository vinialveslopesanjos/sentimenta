import { NextRequest, NextResponse } from "next/server";
import { defaultLocale, locales, type Locale } from "./i18n/config";

const COOKIE_NAME = "NEXT_LOCALE";

function createNonce(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function buildCsp(nonce: string): string {
  const isProduction = process.env.NODE_ENV === "production";
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    ...(isProduction ? [] : ["'unsafe-eval'"]),
    "https://accounts.google.com",
    "https://www.googletagmanager.com",
    "https://www.clarity.ms",
    "https://*.clarity.ms",
  ].join(" ");

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' https:",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://sentimenta.com.br https://api.sentimenta.com.br https://accounts.google.com https://*.clarity.ms",
    "frame-src 'self' https://accounts.google.com",
    "form-action 'self'",
    "report-uri /api/v1/security/csp-report",
    "upgrade-insecure-requests",
  ].join("; ");
}

function attachCsp(response: NextResponse, nonce: string) {
  const headerName = process.env.NODE_ENV === "production"
    ? "Content-Security-Policy"
    : "Content-Security-Policy-Report-Only";
  response.headers.set(headerName, buildCsp(nonce));
}

function getPreferredLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale;

  // Parse Accept-Language header
  const languages = acceptLanguage
    .split(",")
    .map((lang) => {
      const [code, q] = lang.trim().split(";q=");
      return { code: code.trim().toLowerCase(), quality: q ? parseFloat(q) : 1 };
    })
    .sort((a, b) => b.quality - a.quality);

  // If ANY Portuguese variant is present, always return pt-BR
  for (const lang of languages) {
    if (lang.code.startsWith("pt")) return "pt-BR";
  }

  // If explicitly English or any non-Portuguese, return en
  for (const lang of languages) {
    if (lang.code.startsWith("en")) return "en";
  }

  // Default: Portuguese (safeguard for Brazilians)
  return defaultLocale;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes, static files, Next.js internals
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/health") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const nonce = createNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Check existing cookie
  const existingLocale = request.cookies.get(COOKIE_NAME)?.value as Locale | undefined;
  if (existingLocale && locales.includes(existingLocale)) {
    attachCsp(response, nonce);
    return response;
  }

  // No cookie: detect from Accept-Language
  const acceptLanguage = request.headers.get("accept-language");
  const detectedLocale = getPreferredLocale(acceptLanguage);

  // Set cookie for future requests
  response.cookies.set(COOKIE_NAME, detectedLocale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
  });
  attachCsp(response, nonce);

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
