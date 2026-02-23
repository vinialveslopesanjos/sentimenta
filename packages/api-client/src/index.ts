/**
 * @sentimenta/api-client
 *
 * Universal API client used by both Next.js (web) and React Native (mobile).
 * Handles JWT injection, error formatting, and typed responses.
 *
 * Usage (web):   import { createApiClient } from "@sentimenta/api-client";
 * Usage (mobile): same import, different `baseUrl` from env.
 */

export { createApiClient, type ApiClient } from "./client";
export { type ApiError } from "./errors";
