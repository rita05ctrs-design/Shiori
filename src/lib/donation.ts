export type DonationPlatform = "kofi" | "buymeacoffee" | "paypal" | "generic";

export interface ResolvedDonationLink {
  configured: boolean;
  url: string | null;
  platform: DonationPlatform;
  platformLabel: string;
}

/**
 * Validates and classifies `NEXT_PUBLIC_DONATION_URL`.
 * Accepts only safe http(s) URLs and detects Ko-fi, Buy Me a Coffee, or PayPal.me.
 */
export function resolveDonationLink(rawUrl?: string | null): ResolvedDonationLink {
  const candidate = (rawUrl ?? "").trim();
  if (!candidate) {
    return {
      configured: false,
      url: null,
      platform: "generic",
      platformLabel: "Plateforme de soutien",
    };
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return {
        configured: false,
        url: null,
        platform: "generic",
        platformLabel: "Plateforme de soutien",
      };
    }

    const host = parsed.hostname.toLowerCase();
    let platform: DonationPlatform = "generic";
    let platformLabel = "Soutenir le projet";

    if (host.includes("ko-fi.com")) {
      platform = "kofi";
      platformLabel = "Ko-fi";
    } else if (host.includes("buymeacoffee.com")) {
      platform = "buymeacoffee";
      platformLabel = "Buy Me a Coffee";
    } else if (host.includes("paypal.me") || host.includes("paypal.com")) {
      platform = "paypal";
      platformLabel = "PayPal";
    }

    return {
      configured: true,
      url: parsed.toString(),
      platform,
      platformLabel,
    };
  } catch {
    return {
      configured: false,
      url: null,
      platform: "generic",
      platformLabel: "Plateforme de soutien",
    };
  }
}
