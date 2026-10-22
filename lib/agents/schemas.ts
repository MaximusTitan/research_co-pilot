import { z } from "zod";

const locale = z.enum(["en", "hi"]);
const grade = z.enum(["4-6", "7-8", "9-10", "11-12", "adult"]);
const shortText = z.string().trim().min(1).max(500);

// ---------- Inputs (validated on the server; limits keep requests small) ----------

export const planInput = z.object({
  topic: z.string().trim().min(5).max(500),
  writingType: z.enum(["essay", "report", "paper"]),
  grade,
  locale,
  exclude: z.array(shortText).max(40).default([]),
});

export const sourcesInput = z.object({
  question: shortText,
  topic: shortText,
  grade,
  locale,
  /** Page of results; "Find more" asks for the next page. */
  page: z.number().int().min(1).max(5).default(1),
});

export const analyzeInput = z.object({
  title: z.string().trim().min(1).max(200),
  text: z.string().trim().min(50).max(60_000),
  question: shortText,
  grade,
  locale,
});

export const synthesizeInput = z.object({
  question: shortText,
  notes: z
    .array(z.object({ id: z.string().max(64), text: z.string().trim().min(1).max(1000), source: z.string().max(300).nullable() }))
    .min(1)
    .max(80),
  sections: z.array(z.string().trim().min(1).max(120)).max(20),
  locale,
});

export const gapsInput = z.object({
  question: shortText,
  sections: z
    .array(z.object({ title: z.string().trim().min(1).max(120), notes: z.array(z.string().max(1000)).max(40) }))
    .max(20),
  grade,
  locale,
});

export const verifyInput = z.object({
  claims: z
    .array(z.object({ id: z.string().max(64), sentence: z.string().trim().min(1).max(1000), evidence: z.string().max(6000) }))
    .min(1)
    .max(40),
  locale,
});

export const improveInput = z.object({
  paragraph: z.string().trim().min(10).max(4000),
  grade,
  locale,
});

const writingType = z.enum(["essay", "report", "paper"]);
const noteRef = z.object({ id: z.string().max(64), text: z.string().trim().min(1).max(1000), source: z.string().max(300).nullable() });
const savedSourceRef = z.object({ ref: z.number().int().min(1), title: z.string().max(300), summary: z.string().max(1500) });

export const outlineInput = z.object({
  question: shortText,
  writingType,
  grade,
  locale,
  notes: z.array(noteRef).min(1).max(80),
});

export const draftInput = z.object({
  question: shortText,
  writingType,
  grade,
  locale,
  section: z.object({
    kind: z.enum(["intro", "body", "conclusion"]),
    title: z.string().trim().min(1).max(120),
    keyPoint: z.string().max(500).nullable(),
  }),
  /** Every section title in order, so the draft fits the whole paper. */
  outline: z.array(z.string().max(120)).max(20),
  notes: z.array(z.object({ text: z.string().trim().min(1).max(1000), ref: z.number().int().min(1).nullable() })).max(40),
  sources: z.array(savedSourceRef).max(30),
  /** The student's current text for this section, kept and built on. */
  existing: z.string().max(8000).default(""),
});

export const fixClaimInput = z.object({
  sentence: z.string().trim().min(1).max(1000),
  problem: z.enum(["uncitedClaim", "weakSupport", "carefulSource", "missingSource"]),
  sources: z.array(savedSourceRef).max(30),
  notes: z.array(z.string().max(1000)).max(40),
  grade,
  locale,
});

export const feedbackInput = z.object({
  question: shortText,
  writingType,
  grade,
  locale,
  sections: z.array(z.object({ title: z.string().trim().min(1).max(120), text: z.string().max(8000) })).min(1).max(20),
});

export const abstractInput = z.object({
  question: shortText,
  writingType,
  grade,
  locale,
  sections: z.array(z.object({ title: z.string().trim().min(1).max(120), text: z.string().max(8000) })).min(1).max(20),
});

// ---------- Outputs (also used as Claude structured-output schemas) ----------

export const planOutput = z.object({
  coachMessage: z.string(),
  angles: z.array(
    z.object({
      title: z.string(),
      emoji: z.string(),
      tag: z.enum(["lots", "easy", "harder", "fewer"]),
      questions: z.array(z.string()),
    }),
  ),
  plan: z.array(z.string()),
});

export const sourceDto = z.object({
  title: z.string(),
  url: z.string().nullable(),
  publisher: z.string(),
  kind: z.enum(["paper", "government", "education", "encyclopedia", "news", "blog", "website", "document"]),
  year: z.number().nullable(),
  // Models often send null when the author is unknown; treat that as no authors.
  authors: z
    .array(z.string())
    .nullish()
    .transform((value) => value ?? []),
  summary: z.string(),
  keyQuote: z.string().nullable(),
  trust: z.enum(["trusted", "check", "careful"]),
  trustReason: z.enum([
    "peerReviewed",
    "government",
    "education",
    "encyclopedia",
    "news",
    "blogNoAuthor",
    "blogWithAuthor",
    "unknownSite",
    "userDocument",
  ]),
});

export const sourcesOutput = z.object({ sources: z.array(sourceDto) });

export const analyzeOutput = z.object({
  summary: z.string(),
  keyFindings: z.array(z.string()),
});

export const synthesizeOutput = z.object({
  assignments: z.array(z.object({ noteId: z.string(), section: z.string() })),
  contradictions: z.array(z.object({ noteIds: z.array(z.string()), explanation: z.string() })),
});

export const gapsOutput = z.object({
  gaps: z.array(z.object({ question: z.string(), why: z.string() })),
});

export const verifyOutput = z.object({
  results: z.array(
    z.object({ id: z.string(), verdict: z.enum(["supported", "partial", "unsupported"]), explanation: z.string() }),
  ),
});

export const improveOutput = z.object({
  suggestions: z.array(z.object({ original: z.string(), replacement: z.string(), why: z.string() })),
});

export const outlineOutput = z.object({
  sections: z.array(z.object({ title: z.string(), keyPoint: z.string(), noteIds: z.array(z.string()) })),
});

export const draftOutput = z.object({ text: z.string() });

export const fixClaimOutput = z.object({ replacement: z.string(), explanation: z.string() });

export const feedbackOutput = z.object({
  overall: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.object({ section: z.string(), advice: z.string() })),
});

export const abstractOutput = z.object({ abstract: z.string(), keywords: z.array(z.string()) });

export const agents = {
  plan: { input: planInput, output: planOutput },
  sources: { input: sourcesInput, output: sourcesOutput },
  analyze: { input: analyzeInput, output: analyzeOutput },
  synthesize: { input: synthesizeInput, output: synthesizeOutput },
  gaps: { input: gapsInput, output: gapsOutput },
  verify: { input: verifyInput, output: verifyOutput },
  improve: { input: improveInput, output: improveOutput },
  outline: { input: outlineInput, output: outlineOutput },
  draft: { input: draftInput, output: draftOutput },
  fixClaim: { input: fixClaimInput, output: fixClaimOutput },
  feedback: { input: feedbackInput, output: feedbackOutput },
  abstract: { input: abstractInput, output: abstractOutput },
} as const;

export type AgentName = keyof typeof agents;
export type AgentInput<A extends AgentName> = z.input<(typeof agents)[A]["input"]>;
export type AgentOutput<A extends AgentName> = z.infer<(typeof agents)[A]["output"]>;
export type SourceDto = z.infer<typeof sourceDto>;

export interface AgentResponse<A extends AgentName> {
  mode: "ai" | "offline";
  data: AgentOutput<A>;
}
