import { useEffect, useState } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
} from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  Eye,
  Star,
  Check,
  Bookmark,
} from "lucide-react";
import { Movie } from "@/lib/api";
import { StarRating } from "@/components/StarRating";
import { genreLabel } from "@/lib/utils";

interface Props {
  deck: Movie[];
  watchlistIds: Set<number>;
  seenRatings: Map<number, number>;
  onWatchlist: (m: Movie) => void;
  onSeen: (m: Movie, rating: number) => void;
  onNeedMore?: () => void; // called as the pointer nears the end of the deck
}

const THRESHOLD = 110; // px of drag before an action / navigation fires

// A web-first browsing deck for building a watch history. One big poster at a
// time. Left / right browse (reversible, the card never disappears); up saves
// to the watchlist; down marks it seen and opens a quick star rating. Backed by
// mouse drag (any direction), a labelled button row, and arrow keys.
export function SwipeDeck({
  deck,
  watchlistIds,
  seenRatings,
  onWatchlist,
  onSeen,
  onNeedMore,
}: Props) {
  const [index, setIndex] = useState(0);
  const [rating, setRating] = useState(false); // is the rating overlay open?
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Directional hint opacities driven by the live drag offset.
  const upHint = useTransform(y, [-THRESHOLD, -20], [1, 0]);
  const downHint = useTransform(y, [20, THRESHOLD], [0, 1]);
  const leftHint = useTransform(x, [-THRESHOLD, -20], [1, 0]);
  const rightHint = useTransform(x, [20, THRESHOLD], [0, 1]);

  const movie = deck[index];

  const go = (delta: number) => {
    setRating(false);
    setIndex((i) => Math.min(Math.max(i + delta, 0), deck.length - 1));
  };

  // Prefetch more cards when within 3 of the end.
  useEffect(() => {
    if (onNeedMore && deck.length - index <= 3) onNeedMore();
  }, [index, deck.length, onNeedMore]);

  const watchlist = () => {
    if (!movie) return;
    onWatchlist(movie);
    go(1);
  };
  const commitSeen = (r: number) => {
    if (!movie) return;
    onSeen(movie, r);
    setRating(false);
    go(1);
  };

  // Keyboard: arrows browse / act; the rating overlay captures 1 to 5.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (rating) {
        if (e.key >= "1" && e.key <= "5") commitSeen(Number(e.key));
        if (e.key === "Escape") setRating(false);
        return;
      }
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowUp") watchlist();
      else if (e.key === "ArrowDown") setRating(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movie, rating, index, deck.length]);

  if (!movie) return null;

  const onWatchlistAlready = watchlistIds.has(movie.movieId);
  const seenRating = seenRatings.get(movie.movieId);
  const hasPoster = !!movie.poster_url;

  const onDragEnd = (
    _: unknown,
    info: { offset: { x: number; y: number } },
  ) => {
    const { x: dx, y: dy } = info.offset;
    if (Math.abs(dy) > Math.abs(dx)) {
      if (dy < -THRESHOLD) return watchlist();
      if (dy > THRESHOLD) return setRating(true);
    } else {
      if (dx < -THRESHOLD) return go(1);
      if (dx > THRESHOLD) return go(-1);
    }
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative h-[460px] w-[300px] select-none">
        {/* Stacked peek of the next card for depth. */}
        {deck[index + 1] && (
          <div className="absolute inset-0 translate-y-3 scale-[0.96] rounded-2xl border border-border bg-card opacity-60" />
        )}

        <AnimatePresence initial={false}>
          <motion.div
            key={movie.movieId}
            drag={!rating}
            dragSnapToOrigin
            style={{ x, y }}
            onDragEnd={onDragEnd}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            whileDrag={{ scale: 1.03 }}
            className="absolute inset-0 cursor-grab overflow-hidden rounded-2xl border border-border bg-card shadow-cinematic active:cursor-grabbing"
          >
            {hasPoster ? (
              <img
                src={movie.poster_url!}
                alt={movie.title}
                draggable={false}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-radial p-6 text-center">
                <span className="text-xl font-bold text-foreground">
                  {movie.title}
                </span>
                <span className="mt-1 text-muted-foreground">{movie.year}</span>
              </div>
            )}

            {/* Tag badge (already on watchlist / already seen). */}
            {onWatchlistAlready && (
              <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-primary/90 px-2.5 py-1 text-xs font-semibold text-primary-foreground backdrop-blur-sm">
                <Bookmark className="h-3 w-3 fill-current" /> On watchlist
              </div>
            )}
            {seenRating != null && (
              <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-amber-500/90 px-2.5 py-1 text-xs font-semibold text-black backdrop-blur-sm">
                <Check className="h-3 w-3" /> Seen
                <Star className="h-3 w-3 fill-current" />
                {seenRating}
              </div>
            )}

            {/* Title / meta footer. */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/85 to-transparent p-4">
              <h3 className="text-lg font-bold leading-tight text-foreground">
                {movie.title}
              </h3>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                {movie.year && <span>{movie.year}</span>}
                {movie.rating != null && (
                  <span className="flex items-center gap-0.5 text-amber-400">
                    <Star className="h-3 w-3 fill-amber-400" />
                    {movie.rating.toFixed(1)}
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {movie.genres.slice(0, 3).map((g) => (
                  <span
                    key={g}
                    className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground"
                  >
                    {genreLabel(g)}
                  </span>
                ))}
              </div>
            </div>

            {/* Directional drag hints. */}
            <motion.div
              style={{ opacity: upHint }}
              className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-center bg-gradient-to-b from-primary/70 to-transparent py-6 text-sm font-bold uppercase tracking-wider text-primary-foreground"
            >
              <Bookmark className="mr-1.5 h-4 w-4" /> Watchlist
            </motion.div>
            <motion.div
              style={{ opacity: downHint }}
              className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center bg-gradient-to-t from-amber-500/80 to-transparent py-6 text-sm font-bold uppercase tracking-wider text-black"
            >
              <Eye className="mr-1.5 h-4 w-4" /> Seen it
            </motion.div>
            <motion.div
              style={{ opacity: leftHint }}
              className="pointer-events-none absolute inset-y-0 left-0 flex items-center bg-gradient-to-r from-background/80 to-transparent px-3 text-xs font-bold uppercase text-foreground"
            >
              Next
            </motion.div>
            <motion.div
              style={{ opacity: rightHint }}
              className="pointer-events-none absolute inset-y-0 right-0 flex items-center bg-gradient-to-l from-background/80 to-transparent px-3 text-xs font-bold uppercase text-foreground"
            >
              Back
            </motion.div>

            {/* Rating overlay (down / Seen it). */}
            <AnimatePresence>
              {rating && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-background/90 p-6 text-center backdrop-blur-sm"
                >
                  <p className="text-sm text-muted-foreground">
                    How many stars for
                  </p>
                  <p className="text-lg font-bold text-foreground">
                    {movie.title}
                  </p>
                  <StarRating value={seenRating ?? 0} onChange={commitSeen} />
                  <button
                    onClick={() => setRating(false)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Button row. */}
      <div className="flex items-center gap-3">
        <DeckButton label="Back" onClick={() => go(-1)} disabled={index === 0}>
          <ChevronLeft className="h-5 w-5" />
        </DeckButton>
        <DeckButton label="Watchlist" tone="primary" onClick={watchlist}>
          <ArrowUp className="h-5 w-5" />
        </DeckButton>
        <DeckButton
          label="Seen it"
          tone="amber"
          onClick={() => setRating(true)}
        >
          <Eye className="h-5 w-5" />
        </DeckButton>
        <DeckButton
          label="Next"
          onClick={() => go(1)}
          disabled={index >= deck.length - 1}
        >
          <ChevronRight className="h-5 w-5" />
        </DeckButton>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Card {index + 1} of {deck.length}
        <span className="mx-2">&middot;</span>
        arrows to browse, up for watchlist, down to rate
      </p>
    </div>
  );
}

function DeckButton({
  children,
  label,
  onClick,
  disabled,
  tone = "default",
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "primary" | "amber";
}) {
  const tones = {
    default: "border-border bg-card text-foreground hover:bg-secondary",
    primary:
      "border-primary/40 bg-primary/15 text-primary hover:bg-primary hover:text-primary-foreground",
    amber:
      "border-amber-400/40 bg-amber-400/15 text-amber-400 hover:bg-amber-400 hover:text-black",
  } as const;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1 rounded-xl border px-4 py-2 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]}`}
    >
      {children}
      {label}
    </button>
  );
}
