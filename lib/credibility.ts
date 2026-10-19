import type { SourceKind, Trust, TrustReasonKey } from "./types";

export interface CredibilityInput {
  url: string | null;
  kind?: SourceKind;
  authors?: string[];
  peerReviewed?: boolean;
}

export interface Credibility {
  trust: Trust;
  kind: SourceKind;
  /** Key into the i18n `trustReason` table. */
  reasonKey: TrustReasonKey;
}

const NEWS_HOSTS = [
  "nationalgeographic.com",
  "bbc.co.uk",
  "bbc.com",
  "reuters.com",
  "apnews.com",
  "nytimes.com",
  "theguardian.com",
  "scientificamerican.com",
  "nature.com",
  "science.org",
];

const BLOG_HINTS = ["blog", "medium.com", "substack.com", "wordpress.com", "blogspot.com", "tumblr.com"];

export function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function matchesHost(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/**
 * Rates how much a student should trust a source, based on where it comes from.
 * This is a starting point for the student's own judgement, not a verdict.
 */
export function rateSource(input: CredibilityInput): Credibility {
  if (input.kind === "document") {
    return { trust: "check", kind: "document", reasonKey: "userDocument" };
  }
  if (input.peerReviewed) {
    return { trust: "trusted", kind: "paper", reasonKey: "peerReviewed" };
  }

  const host = hostOf(input.url);
  const hasAuthor = (input.authors?.length ?? 0) > 0;
  if (!host) {
    return { trust: "careful", kind: input.kind ?? "website", reasonKey: "unknownSite" };
  }
  if (/\.gov$|\.gov\.[a-z]{2}$|\.mil$/.test(host) || host.endsWith(".europa.eu") || matchesHost(host, "who.int")) {
    return { trust: "trusted", kind: "government", reasonKey: "government" };
  }
  if (/\.edu$|\.ac\.[a-z]{2}$|\.edu\.[a-z]{2}$/.test(host)) {
    return { trust: "trusted", kind: "education", reasonKey: "education" };
  }
  if (matchesHost(host, "wikipedia.org") || matchesHost(host, "britannica.com")) {
    return { trust: "check", kind: "encyclopedia", reasonKey: "encyclopedia" };
  }
  if (NEWS_HOSTS.some((d) => matchesHost(host, d))) {
    return { trust: "trusted", kind: "news", reasonKey: "news" };
  }
  if (BLOG_HINTS.some((hint) => host.includes(hint))) {
    return hasAuthor
      ? { trust: "check", kind: "blog", reasonKey: "blogWithAuthor" }
      : { trust: "careful", kind: "blog", reasonKey: "blogNoAuthor" };
  }
  return { trust: hasAuthor ? "check" : "careful", kind: input.kind ?? "website", reasonKey: "unknownSite" };
}

/** Only http(s) links may be rendered as anchors. */
export function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
