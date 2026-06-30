import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bookmark, Eye, Star, Check } from "lucide-react";
import { Movie } from "@/lib/api";
import { StarRating } from "@/components/StarRating";
import { genreLabel } from "@/lib/utils";

interface Props {
  movie: Movie;
  inWatchlist: boolean;
  seenRating?: number;
  onWatchlist: (m: Movie) => void;
  onSeen: (m: Movie, rating: number) => void;
}

// One poster in the card-grid view of the history builder. Hover reveals two
// actions: save to watchlist, or mark seen (which opens a star rating).
export function BuilderCard({
  movie,
  inWatchlist,
  seenRating,
  onWatchlist,
  onSeen,
}: Props) {
  const [broken, setBroken] = useState(false);
  const [rating, setRating] = useState(false);
  const hasPoster = !!movie.poster_url && !broken;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.04, y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="group relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-border bg-card shadow-cinematic"
    >
      {hasPoster ? (
        <img
          src={movie.poster_url!}
          alt={movie.title}
          loading="lazy"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-radial p-3 text-center">
          <span className="text-sm font-semibold leading-tight text-foreground">
            {movie.title}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">
            {movie.year}
          </span>
        </div>
      )}

      {/* Tag badges. */}
      {inWatchlist && (
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-semibold text-primary-foreground backdrop-blur-sm">
          <Bookmark className="h-2.5 w-2.5 fill-current" /> Watchlist
        </div>
      )}
      {seenRating != null && (
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-semibold text-black backdrop-blur-sm">
          <Check className="h-2.5 w-2.5" /> {seenRating}
          <Star className="h-2.5 w-2.5 fill-current" />
        </div>
      )}

      {/* Hover overlay with the two actions. */}
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-background via-background/70 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
        <h3 className="text-sm font-semibold leading-tight text-foreground">
          {movie.title}
        </h3>
        <div className="mt-1 flex flex-wrap gap-1">
          {movie.genres.slice(0, 2).map((g) => (
            <span
              key={g}
              className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground"
            >
              {genreLabel(g)}
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-1.5">
          <button
            onClick={() => onWatchlist(movie)}
            title="Add to watchlist"
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-primary/40 bg-primary/15 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
          >
            <Bookmark className="h-3 w-3" /> Watchlist
          </button>
          <button
            onClick={() => setRating((v) => !v)}
            title="Mark as seen and rate"
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-amber-400/40 bg-amber-400/15 py-1.5 text-[11px] font-semibold text-amber-400 hover:bg-amber-400 hover:text-black"
          >
            <Eye className="h-3 w-3" /> Seen it
          </button>
        </div>
      </div>

      {/* Rating overlay. */}
      <AnimatePresence>
        {rating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-background/92 p-3 text-center backdrop-blur-sm"
          >
            <p className="text-xs text-muted-foreground">Your rating</p>
            <StarRating
              value={seenRating ?? 0}
              size={22}
              onChange={(r) => {
                onSeen(movie, r);
                setRating(false);
              }}
            />
            <button
              onClick={() => setRating(false)}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
