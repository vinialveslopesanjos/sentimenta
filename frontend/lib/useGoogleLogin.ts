import { useEffect, useCallback } from "react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with";
              shape?: "rectangular" | "pill" | "circle" | "square";
              logo_alignment?: "left" | "center";
              width?: number;
            }
  ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export function useGoogleLogin(onSuccess: (credential: string) => void) {
  const handleGoogleResponse = useCallback(
    (response: { credential: string }) => {
      onSuccess(response.credential);
    },
    [onSuccess]
  );

  useEffect(() => {
    if (window.google) {
      window.google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
        callback: handleGoogleResponse,
        auto_select: false,
      });
    }
  }, [handleGoogleResponse]);

  const renderButton = (elementId: string) => {
    const element = document.getElementById(elementId);
    if (element && window.google) {
      window.google.accounts.id.renderButton(element, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: element.offsetWidth,
      });
    }
  };

  return { renderButton };
}
