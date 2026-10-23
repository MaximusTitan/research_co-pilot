/**
 * Built-in helper used when no AI model is configured (or a call fails).
 * Everything here is deterministic and extractive: it never invents facts or
 * sources, it only rearranges the student's own topic, notes and documents.
 */
import { clip, keywordOverlap, keywords, sentences } from "../text";
import type { AgentInput, AgentOutput } from "./schemas";

type L = "en" | "hi";

/** Sentence-ending mark for each language: Hindi uses the danda (।). */
const FULL_STOP: Record<L, string> = { en: ".", hi: "।" };

export function corePhrase(topic: string): string {
  return (
    topic
      .trim()
      .replace(/[?!.।]+/g, "")
      .replace(/^(why|how|what|when|where|who|which|does|do|did|is|are|can|should|could|will)\s+/i, "")
      .replace(/^(is|are|do|does|did|can|will|has|have)\s+/i, "")
      .trim() || topic.trim()
  );
}

const ANGLES: Record<L, ((c: string) => AgentOutput<"plan">["angles"][number])[]> = {
  en: [
    (c) => ({ emoji: "🔍", tag: "lots", title: `What causes ${c}?`, questions: [`What are the main causes of ${c}?`, `Which cause of ${c} has the strongest evidence?`, `How do scientists measure ${c}?`] }),
    (c) => ({ emoji: "🌍", tag: "easy", title: `What are the effects of ${c}?`, questions: [`Who or what is most affected by ${c}?`, `What would happen if ${c} continued?`, `How does ${c} affect everyday life?`] }),
    (c) => ({ emoji: "🛠️", tag: "easy", title: `How can we help with ${c}?`, questions: [`What solutions to ${c} have been tried?`, `Which solutions to ${c} work best, and why?`, `What can young people do about ${c}?`] }),
    (c) => ({ emoji: "📈", tag: "harder", title: `How has ${c} changed over time?`, questions: [`How has ${c} changed in the last 20 years?`, `What events changed ${c} the most?`, `What do experts predict about ${c}?`] }),
    (c) => ({ emoji: "🏘️", tag: "fewer", title: `${c} in my community`, questions: [`How does ${c} show up where I live?`, `Who in my community is working on ${c}?`, `How could my school learn more about ${c}?`] }),
    (c) => ({ emoji: "⚖️", tag: "harder", title: `What do experts disagree about?`, questions: [`What are the different opinions about ${c}?`, `Which evidence do both sides of the ${c} debate use?`, `What would settle the debate about ${c}?`] }),
    (c) => ({ emoji: "🧪", tag: "harder", title: `Testing an idea about ${c}`, questions: [`What simple experiment could test an idea about ${c}?`, `What data would I need to study ${c}?`, `What has past research on ${c} measured?`] }),
    (c) => ({ emoji: "🗺️", tag: "lots", title: `${c} around the world`, questions: [`How is ${c} different between countries?`, `Which country handles ${c} best, and how?`, `What can we learn from other places about ${c}?`] }),
  ],
  hi: [
    (c) => ({ emoji: "🔍", tag: "lots", title: `“${c}” के कारण क्या हैं?`, questions: [`“${c}” के मुख्य कारण क्या हैं?`, `किस कारण के पक्ष में सबसे मज़बूत सबूत है?`, `वैज्ञानिक “${c}” को कैसे मापते हैं?`] }),
    (c) => ({ emoji: "🌍", tag: "easy", title: `“${c}” के असर क्या हैं?`, questions: [`“${c}” का सबसे ज़्यादा असर किस पर पड़ता है?`, `अगर यह जारी रहा तो क्या होगा?`, `इसका रोज़मर्रा की ज़िंदगी पर क्या असर है?`] }),
    (c) => ({ emoji: "🛠️", tag: "easy", title: `हम कैसे मदद कर सकते हैं?`, questions: [`“${c}” के लिए कौन-से उपाय आज़माए गए हैं?`, `कौन-से उपाय सबसे अच्छे काम करते हैं, और क्यों?`, `युवा इसके लिए क्या कर सकते हैं?`] }),
    (c) => ({ emoji: "📈", tag: "harder", title: `समय के साथ यह कैसे बदला है?`, questions: [`पिछले 20 सालों में “${c}” कैसे बदला है?`, `किन घटनाओं ने इसे सबसे ज़्यादा बदला?`, `विशेषज्ञ इसके बारे में क्या अनुमान लगाते हैं?`] }),
    (c) => ({ emoji: "🏘️", tag: "fewer", title: `मेरे इलाके में`, questions: [`मेरे इलाके में “${c}” कैसे दिखता है?`, `मेरे इलाके में इस पर कौन काम कर रहा है?`, `मेरा स्कूल इसके बारे में और कैसे जान सकता है?`] }),
    (c) => ({ emoji: "⚖️", tag: "harder", title: `विशेषज्ञ किस बात पर असहमत हैं?`, questions: [`“${c}” के बारे में अलग-अलग राय क्या हैं?`, `दोनों पक्ष कौन-से सबूत इस्तेमाल करते हैं?`, `यह बहस कैसे सुलझ सकती है?`] }),
    (c) => ({ emoji: "🧪", tag: "harder", title: `एक विचार को परखना`, questions: [`“${c}” के बारे में किसी विचार को कौन-सा आसान प्रयोग परख सकता है?`, `इसे समझने के लिए मुझे कौन-से आँकड़े चाहिए?`, `पिछली रिसर्च ने क्या मापा है?`] }),
    (c) => ({ emoji: "🗺️", tag: "lots", title: `दुनिया भर में`, questions: [`अलग-अलग देशों में “${c}” कैसे अलग है?`, `कौन-सा देश इसे सबसे अच्छे से संभालता है, और कैसे?`, `हम दूसरी जगहों से क्या सीख सकते हैं?`] }),
  ],
};

const COACH: Record<L, { young: string; older: string }> = {
  en: {
    young: "That's a big topic! Let's make it smaller so you can go deeper.",
    older: "Good start. Narrowing it to one angle will give you a sharper, more researchable question.",
  },
  hi: {
    young: "यह बड़ा विषय है! चलिए इसे छोटा करते हैं, ताकि आप गहराई से समझ सकें।",
    older: "अच्छी शुरुआत है। एक नज़रिया चुनने से आपका सवाल ज़्यादा साफ़ और रिसर्च के लायक बनेगा।",
  },
};

const PLAN: Record<L, string[]> = {
  en: [
    "Pick one angle and one clear question.",
    "Find 3–5 sources, mostly marked Trusted.",
    "Save key facts as notes and sort them into themes.",
    "Turn your themes into an outline.",
    "Write each section in your own words, citing sources.",
    "Review originality, grammar and citations.",
  ],
  hi: [
    "एक नज़रिया और एक साफ़ सवाल चुनें।",
    "3–5 स्रोत खोजें, ज़्यादातर “भरोसेमंद” वाले।",
    "मुख्य तथ्य नोट्स में सेव करें और उन्हें विषय-समूहों में बाँटें।",
    "अपने विषय-समूहों से रूपरेखा बनाएँ।",
    "हर भाग अपने शब्दों में लिखें और स्रोतों का हवाला दें।",
    "मौलिकता, व्याकरण और हवाले जाँचें।",
  ],
};

export function offlinePlan(input: AgentInput<"plan">): AgentOutput<"plan"> {
  const core = corePhrase(input.topic).toLowerCase();
  const excluded = new Set((input.exclude ?? []).map((t) => t.toLowerCase()));
  const angles = ANGLES[input.locale]
    .map((make) => make(core))
    .filter((a) => !excluded.has(a.title.toLowerCase()))
    .slice(0, 4);
  const young = input.grade === "4-6" || input.grade === "7-8";
  return { coachMessage: COACH[input.locale][young ? "young" : "older"], angles, plan: PLAN[input.locale] };
}

export function offlineAnalyze(input: AgentInput<"analyze">): AgentOutput<"analyze"> {
  const all = sentences(input.text).filter((s) => s.text.split(/\s+/).length >= 6);
  const ranked = all
    .map((s, i) => ({ i, text: s.text, score: keywordOverlap(input.question, s.text) + keywords(s.text).length * 0.001 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .sort((a, b) => a.i - b.i);
  const summary = clip(all.slice(0, 2).map((s) => s.text).join(" "), 400);
  return { summary, keyFindings: ranked.map((r) => r.text) };
}

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function offlineSynthesize(input: AgentInput<"synthesize">): AgentOutput<"synthesize"> {
  const assignments: AgentOutput<"synthesize">["assignments"] = [];
  const leftovers: typeof input.notes = [];

  for (const note of input.notes) {
    let best: { section: string; score: number } | null = null;
    for (const section of input.sections) {
      const score = keywordOverlap(section, note.text);
      if (score > 0 && (!best || score > best.score)) best = { section, score };
    }
    if (best) assignments.push({ noteId: note.id, section: best.section });
    else leftovers.push(note);
  }

  // Group the rest by a keyword that at least two notes share.
  const counts = new Map<string, number>();
  for (const note of leftovers) for (const k of new Set(keywords(note.text))) counts.set(k, (counts.get(k) ?? 0) + 1);
  for (const note of leftovers) {
    const shared = [...new Set(keywords(note.text))]
      .filter((k) => (counts.get(k) ?? 0) >= 2)
      .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))[0];
    if (shared) assignments.push({ noteId: note.id, section: titleCase(shared) });
  }
  return { assignments, contradictions: [] };
}

const GAPS: Record<L, ((q: string) => { question: string; why: string })[]> = {
  en: [
    () => ({ question: "Who is most affected, and why them?", why: "Showing who is affected makes your work matter to readers." }),
    () => ({ question: "What do experts disagree about?", why: "Good research shows more than one side." }),
    () => ({ question: "What has changed in the last five years?", why: "Recent evidence keeps your work up to date." }),
    () => ({ question: "What solutions have been tried, and did they work?", why: "Readers will want to know what can be done." }),
  ],
  hi: [
    () => ({ question: "इसका सबसे ज़्यादा असर किस पर पड़ता है, और क्यों?", why: "यह दिखाना कि असर किस पर है, आपके काम को पाठकों के लिए अहम बनाता है।" }),
    () => ({ question: "विशेषज्ञ किस बात पर असहमत हैं?", why: "अच्छी रिसर्च एक से ज़्यादा पक्ष दिखाती है।" }),
    () => ({ question: "पिछले पाँच सालों में क्या बदला है?", why: "नए सबूत आपके काम को ताज़ा रखते हैं।" }),
    () => ({ question: "कौन-से उपाय आज़माए गए हैं, और क्या वे काम आए?", why: "पाठक जानना चाहेंगे कि क्या किया जा सकता है।" }),
  ],
};

export function offlineGaps(input: AgentInput<"gaps">): AgentOutput<"gaps"> {
  const covered = input.sections.flatMap((s) => [s.title, ...s.notes]).join(" ");
  const gaps = GAPS[input.locale]
    .map((make) => make(input.question))
    .filter((g) => keywordOverlap(g.question, covered) < 0.5)
    .slice(0, 3);
  return { gaps };
}

const VERDICT_TEXT: Record<L, Record<"supported" | "partial" | "unsupported", string>> = {
  en: {
    supported: "Most key words in your sentence also appear in this source.",
    partial: "Only some of your sentence matches this source. Re-read it to be sure.",
    unsupported: "Your sentence shares few words with this source. Check that it really says this.",
  },
  hi: {
    supported: "आपके वाक्य के ज़्यादातर मुख्य शब्द इस स्रोत में भी हैं।",
    partial: "आपके वाक्य का कुछ ही हिस्सा इस स्रोत से मेल खाता है। पक्का करने के लिए इसे फिर से पढ़ें।",
    unsupported: "आपके वाक्य के बहुत कम शब्द इस स्रोत में हैं। जाँचें कि स्रोत सच में यही कहता है।",
  },
};

export function offlineVerify(input: AgentInput<"verify">): AgentOutput<"verify"> {
  return {
    results: input.claims.map((c) => {
      const score = keywordOverlap(c.sentence.replace(/\[[\d,\s]+\]/g, ""), c.evidence);
      const verdict = score >= 0.5 ? "supported" : score >= 0.25 ? "partial" : "unsupported";
      return { id: c.id, verdict, explanation: VERDICT_TEXT[input.locale][verdict] };
    }),
  };
}

// Devanagari has no \b word boundaries in JavaScript regex, so Hindi patterns match the phrase directly.
const IMPROVEMENTS: Record<L, [RegExp, string, string][]> = {
  en: [
    [/\ba lot of\b/i, "many", "“Many” is shorter and more formal."],
    [/\bvery important\b/i, "essential", "One strong word beats two weak ones."],
    [/\bvery big\b/i, "huge", "One strong word beats two weak ones."],
    [/\bthings\b/i, "factors", "Be specific about what you mean."],
    [/\bI think\b/, "The evidence suggests", "Research writing leans on evidence, not feelings."],
    [/\bscientists think\b/i, "studies show", "Name what the evidence is. Then cite it."],
    [/\bkind of\b/i, "somewhat", "Sounds more confident and formal."],
    [/\bgets\b/i, "becomes", "A more precise verb."],
  ],
  hi: [
    [/बहुत सारी चीज़ें/, "कई कारण", "अपनी बात साफ़-साफ़ बताएँ।"],
    [/बहुत ज़रूरी/, "आवश्यक", "एक मज़बूत शब्द दो कमज़ोर शब्दों से बेहतर है।"],
    [/मुझे लगता है/, "सबूत बताते हैं", "रिसर्च लेखन भावनाओं पर नहीं, सबूतों पर टिका होता है।"],
    [/वैज्ञानिक सोचते हैं/, "अध्ययन बताते हैं", "बताएँ कि सबूत क्या है, फिर उसका हवाला दें।"],
  ],
};

export function offlineImprove(input: AgentInput<"improve">): AgentOutput<"improve"> {
  const suggestions: AgentOutput<"improve">["suggestions"] = [];
  for (const [pattern, replacement, why] of IMPROVEMENTS[input.locale]) {
    const match = input.paragraph.match(pattern);
    if (match) suggestions.push({ original: match[0], replacement, why });
  }
  return { suggestions };
}

const OTHER_SECTION: Record<L, string> = { en: "Other findings", hi: "अन्य निष्कर्ष" };

export function offlineOutline(input: AgentInput<"outline">): AgentOutput<"outline"> {
  const grouped = offlineSynthesize({ question: input.question, notes: input.notes, sections: [], locale: input.locale });
  const bySection = new Map<string, string[]>();
  for (const a of grouped.assignments) bySection.set(a.section, [...(bySection.get(a.section) ?? []), a.noteId]);
  const assigned = new Set(grouped.assignments.map((a) => a.noteId));
  const rest = input.notes.filter((n) => !assigned.has(n.id)).map((n) => n.id);
  if (rest.length) bySection.set(OTHER_SECTION[input.locale], rest);

  const textOf = new Map(input.notes.map((n) => [n.id, n.text]));
  return {
    sections: [...bySection].map(([title, noteIds]) => ({
      title,
      keyPoint: clip(textOf.get(noteIds[0]) ?? "", 160),
      noteIds,
    })),
  };
}

function asSentence(text: string, ref: number | null, locale: L): string {
  const core = text.trim().replace(/[.!?।]+$/, "");
  const stop = FULL_STOP[locale];
  return ref === null ? `${core}${stop}` : `${core} [${ref}]${stop}`;
}

function listTitles(titles: string[], locale: L): string {
  const and = locale === "hi" ? "और" : "and";
  if (titles.length <= 1) return titles.join("");
  return `${titles.slice(0, -1).join(", ")} ${and} ${titles[titles.length - 1]}`;
}

const DRAFT_TEXT: Record<L, { intro: (q: string, list: string) => string; conclusion: (q: string, list: string) => string }> = {
  en: {
    intro: (q, list) => `This question matters: ${q} ${list ? `This piece looks at ${list}.` : ""}`.trim(),
    conclusion: (q, list) => `So, what is the answer to "${q}"? ${list ? `The evidence points to ${list}.` : ""} There is still more to find out, so future research could explore what remains unknown.`.replace(/\s+/g, " ").trim(),
  },
  hi: {
    intro: (q, list) => `यह सवाल अहम है: ${q} ${list ? `यह लेख ${list} पर नज़र डालता है।` : ""}`.trim(),
    conclusion: (q, list) => `तो, “${q}” का जवाब क्या है? ${list ? `सबूत ${list} की ओर इशारा करते हैं।` : ""} अभी बहुत कुछ जानना बाकी है, इसलिए आगे की रिसर्च उन बातों को खोज सकती है जो अभी पता नहीं हैं।`.replace(/\s+/g, " ").trim(),
  },
};

/** A starter draft stitched only from the student's notes, with their citation numbers. */
export function offlineDraft(input: AgentInput<"draft">): AgentOutput<"draft"> {
  const text = DRAFT_TEXT[input.locale];
  const bodyTitles = input.outline.filter((title, i) => i > 0 && i < input.outline.length - 1).map((title) => title.toLowerCase());
  const list = listTitles(bodyTitles, input.locale);

  if (input.section.kind === "intro") return { text: text.intro(input.question, list) };
  if (input.section.kind === "conclusion") return { text: text.conclusion(input.question, list) };
  if (input.notes.length === 0) return { text: "" };

  const lead = input.section.keyPoint ? asSentence(input.section.keyPoint, null, input.locale) : "";
  const body = input.notes.map((n) => asSentence(n.text, n.ref, input.locale)).join(" ");
  return { text: [lead, body].filter(Boolean).join(" ") };
}

const FIX_TEXT: Record<L, { cited: string; none: string }> = {
  en: {
    cited: "Added a citation to the saved source that best matches this sentence. Check that it really says this.",
    none: "None of your saved sources seem to support this sentence. Find a source for it, or remove it.",
  },
  hi: {
    cited: "उस सेव किए गए स्रोत का हवाला जोड़ा गया जो इस वाक्य से सबसे ज़्यादा मेल खाता है। जाँचें कि स्रोत सच में यही कहता है।",
    none: "आपका कोई भी सेव किया गया स्रोत इस वाक्य को साबित करता नहीं लगता। इसके लिए स्रोत खोजें, या इसे हटा दें।",
  },
};

export function offlineFixClaim(input: AgentInput<"fixClaim">): AgentOutput<"fixClaim"> {
  const core = input.sentence.replace(/\s*\[[\d,\s]+\]/g, "").trim();
  let best: { ref: number; score: number } | null = null;
  for (const s of input.sources) {
    const score = keywordOverlap(core, `${s.title} ${s.summary}`);
    if (!best || score > best.score) best = { ref: s.ref, score };
  }
  if (!best || best.score < 0.15) return { replacement: input.sentence, explanation: FIX_TEXT[input.locale].none };
  return { replacement: asSentence(core, best.ref, input.locale), explanation: FIX_TEXT[input.locale].cited };
}

const FEEDBACK_TEXT: Record<L, { overall: string; cites: string; complete: string; short: string; noCite: string; empty: string }> = {
  en: {
    overall: "Quick feedback based on length and citations. Turn on the AI for detailed feedback on your ideas.",
    cites: "You support your facts with citations.",
    complete: "Every section has writing in it.",
    short: "This section is short. Add a fact from your notes and explain why it matters.",
    noCite: "Add citations so readers can check where your facts come from.",
    empty: "This section is empty. Draft it from your notes.",
  },
  hi: {
    overall: "लंबाई और हवालों के आधार पर छोटी-सी राय। अपने विचारों पर विस्तार से राय पाने के लिए AI चालू करें।",
    cites: "आप अपने तथ्यों के साथ हवाले देते हैं।",
    complete: "हर भाग में कुछ लिखा है।",
    short: "यह भाग छोटा है। अपने नोट्स से एक तथ्य जोड़ें और बताएँ कि यह क्यों ज़रूरी है।",
    noCite: "हवाले जोड़ें, ताकि पाठक जाँच सकें कि आपके तथ्य कहाँ से आए हैं।",
    empty: "यह भाग खाली है। अपने नोट्स से इसका मसौदा लिखें।",
  },
};

export function offlineFeedback(input: AgentInput<"feedback">): AgentOutput<"feedback"> {
  const text = FEEDBACK_TEXT[input.locale];
  const improvements: AgentOutput<"feedback">["improvements"] = [];
  let anyCited = false;
  input.sections.forEach((s, i) => {
    const wordCount = s.text.trim().split(/\s+/).filter(Boolean).length;
    const cited = /\[\d/.test(s.text);
    anyCited ||= cited;
    const isBody = i > 0 && i < input.sections.length - 1;
    if (wordCount === 0) improvements.push({ section: s.title, advice: text.empty });
    else if (wordCount < 40) improvements.push({ section: s.title, advice: text.short });
    else if (isBody && !cited) improvements.push({ section: s.title, advice: text.noCite });
  });
  const strengths = [
    ...(anyCited ? [text.cites] : []),
    ...(input.sections.every((s) => s.text.trim()) ? [text.complete] : []),
  ];
  return { overall: text.overall, strengths, improvements };
}

/** An abstract made of each section's opening sentence, with keywords from the research question. */
export function offlineAbstract(input: AgentInput<"abstract">): AgentOutput<"abstract"> {
  const openers = input.sections
    .map((s) => sentences(s.text)[0]?.text.replace(/\s*\[[\d,\s]+\]/g, "") ?? "")
    .filter(Boolean)
    .slice(0, 5);
  const counts = new Map<string, number>();
  for (const k of keywords([input.question, ...input.sections.map((s) => s.text)].join(" "))) counts.set(k, (counts.get(k) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);
  return { abstract: openers.join(" "), keywords: top };
}

const INTERVIEW_TEXT: Record<L, { focus: (c: string) => string; audience: string; audiences: [string, string][]; purpose: string; purposes: [string, string][] }> = {
  en: {
    focus: (c) => `Which part of ${c} interests you most?`,
    audience: "Who is your paper for?",
    audiences: [
      ["My teacher and class", "The usual school reader"],
      ["Younger students", "Simple words, clear examples"],
      ["Parents and families", "Practical and everyday"],
      ["People who know the subject", "More detail and evidence"],
    ],
    purpose: "What should your paper do?",
    purposes: [
      ["Explain what is known", "Clear and neutral"],
      ["Compare different views", "Weigh each side"],
      ["Argue for an answer", "Take a clear position"],
      ["Suggest solutions", "Focus on what can be done"],
    ],
  },
  hi: {
    focus: (c) => `“${c}” का कौन-सा हिस्सा आपको सबसे दिलचस्प लगता है?`,
    audience: "आपका पेपर किसके लिए है?",
    audiences: [
      ["मेरे शिक्षक और कक्षा", "सामान्य स्कूल पाठक"],
      ["छोटे छात्र", "आसान शब्द, साफ़ उदाहरण"],
      ["माता-पिता और परिवार", "व्यावहारिक और रोज़मर्रा"],
      ["विषय के जानकार", "ज़्यादा विवरण और सबूत"],
    ],
    purpose: "आपका पेपर क्या करे?",
    purposes: [
      ["जो पता है उसे समझाए", "साफ़ और निष्पक्ष"],
      ["अलग-अलग राय की तुलना करे", "हर पक्ष को परखे"],
      ["एक जवाब के पक्ष में तर्क दे", "साफ़ पक्ष ले"],
      ["उपाय सुझाए", "क्या किया जा सकता है"],
    ],
  },
};

/** Which of the purposes fit each kind of writing: essays argue, reports explain. */
const PURPOSES: Record<AgentInput<"interview">["writingType"], number[]> = { essay: [1, 2, 3], report: [0, 3], paper: [0, 1, 2, 3] };

/**
 * Without AI: three fixed questions (which part of the topic, who it's for,
 * what it should do), then the research question of the chosen angle.
 */
export function offlineInterview(input: AgentInput<"interview">): AgentOutput<"interview"> {
  const text = INTERVIEW_TEXT[input.locale];
  const answers = input.answers ?? [];
  const angles = offlinePlan({ topic: input.topic, writingType: input.writingType, grade: input.grade, locale: input.locale, exclude: [] }).angles.slice(0, 4);
  const steps = [
    { question: text.focus(corePhrase(input.topic).toLowerCase()), options: angles.map((a) => ({ label: a.title, hint: a.questions[0] })) },
    { question: text.audience, options: text.audiences.map(([label, hint]) => ({ label, hint })) },
    { question: text.purpose, options: text.purposes.filter((_, i) => PURPOSES[input.writingType].includes(i)).map(([label, hint]) => ({ label, hint })) },
  ];
  const next = steps[answers.length];
  if (next && answers.length < (input.maxQuestions ?? 6)) return { done: false, ...next, multi: false, researchQuestion: "" };
  const chosen = angles.find((a) => a.title === answers[0]?.answer);
  return { done: true, question: "", options: [], multi: false, researchQuestion: chosen?.questions[0] ?? answers[0]?.answer ?? input.topic };
}
