/*
  Every figure shown to users, with the page it comes from (constitution IV).
  Each entry records when it was checked and what the page says.
*/

export const SOURCES = {
  undeclaredActives: {
    // Verified 2026-10-17: Dermatology Times, "Journal Digest: October 14, 2026", summarizing
    // Abilov Z, James MJ, Porter ML, Popov YV. "Undeclared Pharmacologically Active Ingredients in
    // Over-the-Counter Skin Products." JAMA Network Open. 18 OTC products marketed online for
    // eczema, psoriasis, dermatitis and hyperpigmentation; 6 of 18 (33.3%) contained clobetasol
    // propionate, a superpotent prescription corticosteroid, absent from their labels.
    url: "https://dermatologytimes.com/view/journal-digest-october-14-2026",
    label: "JAMA Network Open, via Dermatology Times, Oct 2026",
    tested: 18,
    found: 6,
  },
  unverifiableBrands: {
    // Verified 2026-10-17: Dermatology Times, Oct 13, 2026, "AI-Era Skincare Report Finds Widespread
    // Gaps in Verifiable Product Claims": "M11 analyzed 633 skincare brands and 1,470 high-impact
    // product claims"; "47% of brands had no independently verifiable evidence behind any of the
    // high-impact claims evaluated." Caveat in the article: unverifiable is not necessarily false.
    url: "https://www.dermatologytimes.com/view/ai-era-skincare-report-finds-widespread-gaps-in-verifiable-product-claims",
    label: "M11 report, via Dermatology Times, Oct 2026",
    brands: 633,
    percent: 47,
  },
  magazineAds: {
    // Verified 2026-10-17: UNL News, July 31, 2015: nearly 300 ads from seven magazines (April 2013);
    // "fewer than one in five, 18 percent, of the claims made in the ads were deemed acceptable."
    // Journal of Global Fashion Marketing (Fowler, Carlson, Reisenwitz).
    url: "https://news.unl.edu/article/research-most-beauty-ad-claims-don-t-hold-up",
    label: "Journal of Global Fashion Marketing, via UNL News, 2015",
    percent: 18,
  },
  fdaApproval: {
    // Verified 2026-10-17: FDA "Cosmetics Safety Q&A: Prohibited Ingredients": a manufacturer
    // "may use almost any raw material as a cosmetic ingredient and market the product without
    // an approval from FDA" (color additives aside).
    url: "https://www.fda.gov/cosmetics/resources-consumers-cosmetics/cosmetics-safety-qa-prohibited-ingredients",
    label: "US Food and Drug Administration, Cosmetics Safety Q&A",
  },
  youcamFileRetention: {
    // Verified 2026-10-17: "Uploaded files and their associated file_id values are stored for
    // 30 days"; "the corresponding task_id remains valid for 30 days"; no delete endpoint listed.
    url: "https://docs.perfectcorp.com/develop/file_retention_period",
    label: "YouCam file retention period",
  },
  youcamSkinAnalysis: {
    // Verified 2026-10-17: AI Skin Analysis reference says results are kept for 24 hours.
    url: "https://docs.perfectcorp.com/reference/ai_skin_analysis",
    label: "YouCam AI Skin Analysis documentation",
  },
  anthropicPrivacy: {
    url: "https://www.anthropic.com/legal/privacy",
    label: "Anthropic privacy policy",
  },
} as const;
