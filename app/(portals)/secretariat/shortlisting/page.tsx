import { getShortlistCategories } from "@/lib/data/shortlisting";
import { ShortlistCategoryCard } from "@/components/secretariat/ShortlistCategoryCard";

export default async function ShortlistingPage() {
  const categories = await getShortlistCategories();

  return (
    <div className="flex flex-col h-full">
      <div className="h-17 border-b border-border flex items-center px-6 sm:px-7 flex-shrink-0">
        <h1 className="font-heading font-extrabold text-[19px] text-navy-dark">Shortlisting</h1>
      </div>
      <div className="p-6 sm:p-7 overflow-y-auto flex-1 flex flex-col gap-4">
        <p className="text-[13px] text-text-muted -mt-1">
          Ranked by Stage 1 score within sector. No default threshold is set — configure a top-N or top-N% cutoff per
          sector before applying it; NECA hasn&rsquo;t decided the approach yet (doc section 13).
        </p>
        {categories.map((category) => (
          <ShortlistCategoryCard key={category.sectorId} category={category} />
        ))}
        {categories.length === 0 && (
          <div className="text-sm text-text-muted border border-border rounded-2xl p-6">
            No submitted applications yet.
          </div>
        )}
      </div>
    </div>
  );
}
