/**
 * @sentimenta/types
 *
 * Single source of truth for all TypeScript interfaces
 * shared between apps/web (Next.js) and apps/mobile (React Native / Expo).
 *
 * Both apps import from here — never duplicate type definitions.
 */

export * from "./user";
export * from "./connection";
export * from "./data-snapshot";
export * from "./post";
export * from "./comment";
export * from "./dashboard";
export * from "./pipeline";
export * from "./billing";
