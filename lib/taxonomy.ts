import taxonomy from "@/data/taxonomy.json";

export type TaxCategory = { slug: string; name: string; blurb: string; keywords: string[]; group: string };
export const CATEGORY_INDEX: TaxCategory[] = taxonomy.categories.map(({ slug, name, blurb, keywords, group }) => ({ slug, name, blurb, keywords, group: group ?? "Other" }));
export const GROUPS: string[] = (taxonomy as { groups?: string[] }).groups ?? ["Other"];
export const groupOf = (slug: string) => CATEGORY_INDEX.find((c) => c.slug === slug)?.group ?? "Other";

/** Categories grouped in taxonomy order, with their catalog counts. */
export function grouped<T extends { slug: string }>(cats: T[]) {
  return GROUPS.map((g) => ({ group: g, items: cats.filter((c) => groupOf(c.slug) === g) })).filter((x) => x.items.length);
}
