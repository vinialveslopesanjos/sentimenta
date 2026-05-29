declare module "posthog-js" {
  type PostHogProperties = Record<string, unknown>;

  interface PostHogInitOptions {
    api_host?: string;
    capture_pageview?: boolean;
    capture_pageleave?: boolean;
    autocapture?: boolean;
    persistence?: string;
  }

  interface PostHog {
    init(apiKey: string, options?: PostHogInitOptions): void;
    capture(eventName: string, properties?: PostHogProperties): void;
    identify(distinctId: string, properties?: PostHogProperties): void;
    reset(): void;
  }

  const posthog: PostHog;
  export default posthog;
}
