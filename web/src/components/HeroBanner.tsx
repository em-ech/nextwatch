import { motion } from "framer-motion";
import { Star, Sparkles } from "lucide-react";
import { Movie } from "@/lib/api";

interface Props {
  movie: Movie; // the top pick
}

// Full-bleed cinematic hero for the strongest recommendation. Uses the TMDB
// backdrop when available, otherwise a crimson radial gradient.
export function HeroBanner({ movie }: Props) {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="relative h-[60vh] min-h-[380px] w-full overflow-hidden"
    >
      {movie.backdrop_url ? (
        <img
          src={movie.backdrop_url}
          alt={movie.title}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-radial" />
      )}
      {/* Cinematic fade to background, bottom + left */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/20 to-transparent" />

      <div className="relative z-10 flex h-full max-w-6xl flex-col justify-end px-6 pb-14">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6 }}
        >
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-primary">
            <Sparkles className="h-4 w-4" />
            Your top pick
          </div>
          <h1 className="max-w-2xl text-5xl font-extrabold leading-tight text-foreground drop-shadow-lg">
            {movie.title}
          </h1>
          <div className="mt-3 flex items-center gap-4 text-muted-foreground">
            {movie.year && <span>{movie.year}</span>}
            {movie.match !== undefined && (
              <span className="flex items-center gap-1 font-bold text-primary">
                <Star className="h-4 w-4 fill-primary" />
                {movie.match}% match
              </span>
            )}
            <span className="hidden gap-1 sm:flex">
              {movie.genres.slice(0, 3).map((g) => (
                <span
                  key={g}
                  className="rounded bg-secondary/80 px-2 py-0.5 text-xs text-secondary-foreground backdrop-blur-sm"
                >
                  {g}
                </span>
              ))}
            </span>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}
