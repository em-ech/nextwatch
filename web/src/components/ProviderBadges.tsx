import { Movie } from "@/lib/api";
import { useRegion } from "@/lib/RegionContext";

interface Props {
  movie: Movie;
  max?: number;
}

// Small row of streaming-service logos for the current region. Renders nothing
// when the movie isn't on any flatrate (subscription) service there.
export function ProviderBadges({ movie, max = 4 }: Props) {
  const { region } = useRegion();
  const flatrate = movie.providers?.[region]?.flatrate ?? [];
  if (flatrate.length === 0) return null;

  return (
    <div className="mt-1.5 flex items-center gap-1">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        Stream
      </span>
      {flatrate.slice(0, max).map((p) => (
        <img
          key={p.name}
          src={p.logo}
          alt={p.name}
          title={p.name}
          className="h-5 w-5 rounded"
          loading="lazy"
        />
      ))}
    </div>
  );
}
