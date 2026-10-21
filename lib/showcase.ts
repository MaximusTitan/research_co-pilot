import { newId } from "./text";
import type { Note, Project, Section, Source } from "./types";

/**
 * A finished research project every account starts with, so new students can
 * see what each step looks like when it's done well. It's an ordinary project:
 * the student can open, change or delete it like their own.
 */
export const SHOWCASE_TOPIC = "Are neonicotinoid pesticides behind the decline of bees?";

type SourceSeed = Omit<Source, "id" | "saved" | "marked" | "keyQuote"> & { ref: number };

const SOURCES: SourceSeed[] = [
  {
    ref: 1,
    title: "Importance of pollinators in changing landscapes for world crops",
    url: "https://doi.org/10.1098/rspb.2006.3721",
    publisher: "Proceedings of the Royal Society B, 274(1608), 303–313",
    kind: "paper",
    year: 2007,
    authors: ["Alexandra-Maria Klein", "Bernard E. Vaissière", "James H. Cane", "Ingolf Steffan-Dewenter", "Saul A. Cunningham", "Claire Kremen", "Teja Tscharntke"],
    summary:
      "A global review of how much the world's crops depend on animal pollinators. Production of 87 of the 115 leading global food crops depends on animal pollination to some degree, and these crops make up about 35% of global food production by volume.",
    trust: "trusted",
    trustReason: "peerReviewed",
  },
  {
    ref: 2,
    title: "Global pollinator declines: trends, impacts and drivers",
    url: "https://doi.org/10.1016/j.tree.2010.01.007",
    publisher: "Trends in Ecology & Evolution, 25(6), 345–353",
    kind: "paper",
    year: 2010,
    authors: ["Simon G. Potts", "Jacobus C. Biesmeijer", "Claire Kremen", "Peter Neumann", "Oliver Schweiger", "William E. Kunin"],
    summary:
      "A review of evidence that wild and managed pollinators are declining in several regions. It names habitat loss, pesticides, pathogens, invasive species and climate change as drivers, and argues they often act together.",
    trust: "trusted",
    trustReason: "peerReviewed",
  },
  {
    ref: 3,
    title: "A common pesticide decreases foraging success and survival in honey bees",
    url: "https://doi.org/10.1126/science.1215039",
    publisher: "Science, 336(6079), 348–350",
    kind: "paper",
    year: 2012,
    authors: ["Mickaël Henry", "Maxime Béguin", "Fabrice Requier", "Orianne Rollin", "Jean-François Odoux", "Pierrick Aupinel", "Jean Aptel", "Sylvie Tchamitchian", "Axel Decourtye"],
    summary:
      "Researchers fitted honey bee foragers with tiny radio tags. Bees given a low, non-lethal dose of the neonicotinoid thiamethoxam were more likely to fail to find their way back to the hive, which raises the risk of colony collapse.",
    trust: "trusted",
    trustReason: "peerReviewed",
  },
  {
    ref: 4,
    title: "Neonicotinoid pesticide reduces bumble bee colony growth and queen production",
    url: "https://doi.org/10.1126/science.1215025",
    publisher: "Science, 336(6079), 351–352",
    kind: "paper",
    year: 2012,
    authors: ["Penelope R. Whitehorn", "Stephanie O'Connor", "Felix L. Wackers", "Dave Goulson"],
    summary:
      "Bumblebee colonies exposed to field-realistic levels of the neonicotinoid imidacloprid grew more slowly and produced 85% fewer new queens than unexposed colonies. Fewer queens means fewer colonies the following year.",
    trust: "trusted",
    trustReason: "peerReviewed",
  },
  {
    ref: 5,
    title: "Seed coating with a neonicotinoid insecticide negatively affects wild bees",
    url: "https://doi.org/10.1038/nature14420",
    publisher: "Nature, 521(7550), 77–80",
    kind: "paper",
    year: 2015,
    authors: ["Maj Rundlöf", "Georg K. S. Andersson", "Riccardo Bommarco", "Ingemar Fries", "Veronica Hederström", "Lina Herbertsson", "Ove Jonsson", "Björn K. Klatt", "Thorsten R. Pedersen", "Johanna Yourstone", "Henrik G. Smith"],
    summary:
      "A large field experiment in Sweden compared oilseed rape fields grown from clothianidin-coated seed with untreated fields. Treated fields had fewer wild bees, less solitary bee nesting and slower bumblebee colony growth, but honey bee colonies showed no clear effect.",
    trust: "trusted",
    trustReason: "peerReviewed",
  },
  {
    ref: 6,
    title: "Country-specific effects of neonicotinoid pesticides on honey bees and wild bees",
    url: "https://doi.org/10.1126/science.aaa1190",
    publisher: "Science, 356(6345), 1393–1395",
    kind: "paper",
    year: 2017,
    authors: ["Ben A. Woodcock", "James M. Bullock", "Richard F. Shore", "Matthew S. Heard", "M. Gloria Pereira", "John Redhead", "Lucy Ridding", "Hannah Dean", "Darren Sleep", "Peter Henrys", "Jodey Peyton", "Sarah Hulmes", "Lucy Hulmes", "Magda Sárospataki", "Cecilia Saure", "Mike Edwards", "Ellen Genersch", "Sebastian Knäbe", "Richard F. Pywell"],
    summary:
      "A field study of farms in the UK, Hungary and Germany. Neonicotinoid exposure harmed honey bee colonies' survival over winter in Hungary and the UK but not in Germany, and higher pesticide residues in wild bee nests were linked to lower reproduction.",
    trust: "trusted",
    trustReason: "peerReviewed",
  },
  {
    ref: 7,
    title: "Bee declines driven by combined stress from parasites, pesticides, and lack of flowers",
    url: "https://doi.org/10.1126/science.1255957",
    publisher: "Science, 347(6229), 1255957",
    kind: "paper",
    year: 2015,
    authors: ["Dave Goulson", "Elizabeth Nicholls", "Cristina Botías", "Ellen L. Rotheray"],
    summary:
      "A review arguing that bee declines come from several stresses working together: parasites such as the varroa mite, pesticides, and fewer flowers from habitat loss. A bee weakened by one stress copes worse with the others.",
    trust: "trusted",
    trustReason: "peerReviewed",
  },
  {
    ref: 8,
    title: "Neonicotinoids: risks to bees confirmed",
    url: "https://www.efsa.europa.eu/en/press/news/180228",
    publisher: "European Food Safety Authority",
    kind: "government",
    year: 2018,
    authors: [],
    summary:
      "The European Food Safety Authority updated its risk assessments of three neonicotinoids: clothianidin, imidacloprid and thiamethoxam. It concluded that most outdoor uses of these pesticides pose a risk to wild bees and honey bees.",
    trust: "trusted",
    trustReason: "government",
  },
  {
    ref: 9,
    title: "The assessment report on pollinators, pollination and food production",
    url: "https://doi.org/10.5281/zenodo.3402856",
    publisher: "Intergovernmental Science-Policy Platform on Biodiversity and Ecosystem Services (IPBES)",
    kind: "government",
    year: 2016,
    authors: [],
    summary:
      "A worldwide assessment by an intergovernmental science body. It estimates that between US$235 billion and US$577 billion of annual global crop output is at risk from pollinator loss. It lists pesticides among the main threats and recommends farming that relies less on them, for example through integrated pest management.",
    trust: "trusted",
    trustReason: "government",
  },
  {
    ref: 10,
    title: "Commission Implementing Regulation (EU) 2018/783 on the conditions of approval of the active substance imidacloprid",
    url: "https://eur-lex.europa.eu/eli/reg_impl/2018/783/oj",
    publisher: "Official Journal of the European Union",
    kind: "government",
    year: 2018,
    authors: [],
    summary:
      "The European Union law that restricted imidacloprid to use in permanent greenhouses only, banning its use on outdoor crops. Companion regulations 2018/784 and 2018/785 did the same for clothianidin and thiamethoxam.",
    trust: "trusted",
    trustReason: "government",
  },
];

/** Notes in the student's own words, each tied to its source and the section it supports. */
const NOTES: { text: string; ref: number | null; section: string }[] = [
  { text: "87 of the 115 leading food crops depend on animal pollinators to some degree.", ref: 1, section: "intro" },
  { text: "Crops that need pollinators make up about 35% of global food production by volume.", ref: 1, section: "why" },
  { text: "Up to US$577 billion of yearly crop output is at risk if pollinators are lost.", ref: 9, section: "why" },
  { text: "Pollinators are declining in several regions, driven by habitat loss, pesticides, disease and climate change.", ref: 2, section: "intro" },
  { text: "Honey bee foragers given a low dose of thiamethoxam often failed to find their way back to the hive.", ref: 3, section: "honey" },
  { text: "Losing foragers like this raises the risk of a honey bee colony collapsing.", ref: 3, section: "honey" },
  { text: "In the UK and Hungary, neonicotinoids lowered honey bee colony survival over winter; in Germany they did not.", ref: 6, section: "honey" },
  { text: "Bumblebee colonies given imidacloprid produced 85% fewer new queens.", ref: 4, section: "wild" },
  { text: "Fields sown with clothianidin-coated seed had fewer wild bees and weaker bumblebee colonies.", ref: 5, section: "wild" },
  { text: "Honey bee colonies in the same Swedish fields showed no clear harm.", ref: 5, section: "wild" },
  { text: "More pesticide residue in wild bee nests was linked to fewer offspring.", ref: 6, section: "wild" },
  { text: "Bee declines come from parasites, pesticides and lack of flowers acting together.", ref: 7, section: "stress" },
  { text: "A bee weakened by one stress copes worse with the others.", ref: 7, section: "stress" },
  { text: "EFSA concluded in 2018 that most outdoor uses of three neonicotinoids put bees at risk.", ref: 8, section: "policy" },
  { text: "In 2018 the EU banned outdoor use of imidacloprid, clothianidin and thiamethoxam; only permanent greenhouses are allowed.", ref: 10, section: "policy" },
  { text: "Neonicotinoids can harm wild bees such as bumblebees by slowing colony growth.", ref: 4, section: "conclusion" },
  { text: "Banning pesticides alone won't fix the problem if bees still lack flowers and suffer from mites.", ref: null, section: "conclusion" },
];

function section(kind: Section["kind"], title: string, keyPoint: string, draft: string): Section {
  return { id: newId(), kind, title, keyPoint, draft };
}

export function showcaseProject(now = Date.now()): Project {
  const sources: Source[] = SOURCES.map((s) => ({ ...s, id: newId(), keyQuote: null, saved: true, marked: false }));
  const idOfRef = (ref: number | null) => (ref === null ? null : (sources.find((s) => s.ref === ref)?.id ?? null));

  const sections = {
    intro: section(
      "intro",
      "Introduction",
      "Bees are declining, and neonicotinoid pesticides are one suspected cause.",
      "Much of the food on our plates depends on insects that carry pollen from flower to flower. Production of 87 of the world's 115 leading food crops depends on animal pollination to some degree [1]. Yet in many regions, wild and managed pollinators are in decline [2].\n\nScientists have linked this decline to several causes, including habitat loss, disease and pesticides [2]. One group of pesticides, the neonicotinoids, has drawn special attention. This paper asks whether neonicotinoids are behind the decline of bees, and what the evidence means for how we farm.",
    ),
    why: section(
      "body",
      "Why bees matter",
      "Bees support a large share of the world's food and its value.",
      "Crops that rely on pollinators make up about 35% of global food production by volume [1]. They include many fruits, vegetables and nuts that give our diets variety and vitamins.\n\nThe economic stakes are high as well. A global assessment estimated that between US$235 billion and US$577 billion of annual crop output is at risk from pollinator loss [9]. Losing bees would make healthy food scarcer and more expensive.",
    ),
    honey: section(
      "body",
      "Effects on honey bees",
      "Neonicotinoids can stop honey bees finding their way home, but results vary by place.",
      "Neonicotinoids do not need to kill a bee outright to do harm. In a French experiment, foragers given a low dose of thiamethoxam were more likely to fail to find their way back to the hive [3]. A colony that keeps losing foragers this way faces a higher risk of collapse [3].\n\nField results are less consistent. A large study across three countries found that neonicotinoids lowered honey bee colony survival over winter in the UK and Hungary, but not in Germany [6]. This suggests that local conditions, such as colony health and food supply, shape how much damage the pesticides cause.",
    ),
    wild: section(
      "body",
      "Effects on wild bees",
      "Wild bees, especially bumblebees, show clearer harm than honey bees.",
      "The evidence is stronger for wild bees than for honey bees. When bumblebee colonies were exposed to realistic levels of imidacloprid, they produced 85% fewer new queens [4]. Since each queen founds next year's colony, this loss can shrink bumblebee populations over time.\n\nA field experiment in Sweden points the same way. Oilseed rape fields grown from clothianidin-coated seed had fewer wild bees and weaker bumblebee colonies, while honey bee colonies in the same fields showed no clear harm [5]. In another study, more pesticide residue in wild bee nests was linked to fewer offspring [6].",
    ),
    stress: section(
      "body",
      "One threat among many",
      "Pesticides combine with parasites and lack of flowers to weaken bees.",
      "Neonicotinoids are not the only threat bees face. Researchers argue that bee declines come from parasites, pesticides and a lack of flowers acting together [7]. A bee weakened by one of these stresses copes worse with the others [7].\n\nThis helps explain why studies sometimes disagree. A well-fed colony with few mites may survive pesticide exposure that would tip a stressed colony into collapse. It also means that removing one threat will not, on its own, bring bees back.",
    ),
    policy: section(
      "body",
      "How governments responded",
      "Europe restricted outdoor use after reviewing the evidence.",
      "In 2018, the European Food Safety Authority reviewed the evidence on clothianidin, imidacloprid and thiamethoxam [8]. It concluded that most outdoor uses of these three neonicotinoids pose a risk to both wild bees and honey bees [8]. Later that year, the European Union banned the outdoor use of all three, allowing them only in permanent greenhouses [10].\n\nThe international assessment of pollinators also lists pesticides among the main threats and calls for farming that relies less on them [9]. Together, these reviews show that scientists and regulators now treat neonicotinoids as a real risk to bees.",
    ),
    conclusion: section(
      "conclusion",
      "Conclusion",
      "Neonicotinoids harm bees, but they are one cause among several.",
      "The evidence shows that neonicotinoids can harm bees, especially wild bees such as bumblebees [4, 5]. They disrupt foraging, reduce colony growth and cut the number of new queens. However, they are not the whole story, because parasites and a lack of flowers weaken bees too.\n\nRestricting these pesticides was a sensible step, but it should be combined with planting more wildflowers and keeping hives healthy. Future research could test which mix of these actions helps bee populations recover fastest.",
    ),
  };

  const notes: Note[] = NOTES.map((n) => ({
    id: newId(),
    text: n.text,
    sourceId: idOfRef(n.ref),
    sectionId: sections[n.section as keyof typeof sections].id,
  }));

  const question = "How do neonicotinoid pesticides affect bees, and should their use be restricted?";
  const angles = [
    { id: newId(), title: "Pesticides and bees", emoji: "🧪", tag: "lots" as const, questions: [question, "Should neonicotinoid pesticides be banned to protect pollinators?"] },
    { id: newId(), title: "Habitat and flowers", emoji: "🌻", tag: "easy" as const, questions: ["How does losing wildflower habitat affect bee populations?", "Can wildflower strips on farms help bees recover?"] },
    { id: newId(), title: "Parasites and disease", emoji: "🦠", tag: "harder" as const, questions: ["How much damage does the varroa mite do to honey bee colonies?"] },
    { id: newId(), title: "Climate change", emoji: "🌡️", tag: "fewer" as const, questions: ["Is a warming climate putting bees and flowers out of step?"] },
  ];
  return {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    topic: SHOWCASE_TOPIC,
    writingType: "paper",
    grade: "11-12",
    coachMessage:
      "This is a strong topic with lots of published research. Focus on one clear question, look at both honey bees and wild bees, and remember that pesticides are only one of several threats.",
    angles,
    selectedAngleId: angles[0].id,
    question,
    searchedFor: question,
    lastStep: "/review",
    plan: [
      "Choose one clear research question",
      "Find peer-reviewed studies and official reports",
      "Take notes in your own words and keep track of sources",
      "Group notes into sections with one main idea each",
      "Write each section and cite every fact",
      "Check citations, grammar and originality",
    ],
    sources,
    nextRef: SOURCES.length + 1,
    notes,
    sections: [sections.intro, sections.why, sections.honey, sections.wild, sections.stress, sections.policy, sections.conclusion],
    gaps: [],
  };
}
