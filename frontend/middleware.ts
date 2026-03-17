import { NextRequest, NextResponse } from "next/server";
import { defaultLocale, locales, type Locale } from "./i18n/config";

const COOKIE_NAME = "NEXT_LOCALE";

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

  // Check existing cookie
  const existingLocale = request.cookies.get(COOKIE_NAME)?.value as Locale | undefined;
  if (existingLocale && locales.includes(existingLocale)) {
    // Cookie exists and is valid - pass along
    const response = NextResponse.next();
    return response;
  }

  // No cookie: detect from Accept-Language
  const acceptLanguage = request.headers.get("accept-language");
  const detectedLocale = getPreferredLocale(acceptLanguage);

  // Set cookie for future requests
  const response = NextResponse.next();
  response.cookies.set(COOKIE_NAME, detectedLocale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
  });

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
