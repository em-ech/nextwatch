import { useEffect, useState } from "react";
import { Search, Sparkles, X, Star } from "lucide-react";
import {
  Movie,
  HistItem,
  ImportResponse,
  searchCatalog,
  getRecommendations,
} from "@/lib/api";
import { BrandLogo } from "@/components/BrandLogo";
import { PosterCard } from "@/components/PosterCard";
import { HeroBanner } from "@/components/HeroBanner";
import { ImportDropzone } from "@/components/ImportDropzone";
import { CategoryRow } from "@/components/CategoryRow";
import { TasteRadar } from "@/components/TasteRadar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface HistEntry {
  movie: Movie;
  rating: number;
}

interface GenreRow {
  genre: string;
  movies: Movie[];
}

interface BecauseRow {
  title: string;
  movies: Movie[];
}

const FETCH_N = 40; // wide pull so genre rows have material to group

export default function Index() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Movie[]>([]);
  const [history, setHistory] = useState<HistEntry[]>([]);
  const [recs, setRecs] = useState<Movie[]>([]);
  const [genreRows, setGenreRows] = useState<GenreRow[]>([]);
  const [because, setBecause] = useState<BecauseRow | null>(null);
  const [taste, setTaste] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(
      () =>
        searchCatalog(query)
          .then(setResults)
          .catch(() => {}),
      250,
    );
    return () => clearTimeout(t);
  }, [query]);

  const inHistory = (id: number) => history.some((h) => h.movie.movieId === id);

  const addMovie = (movie: Movie, rating = 4) => {
    if (!inHistory(movie.movieId)) setHistory((h) => [...h, { movie, rating }]);
    setQuery("");
    setResults([]);
  };

  const removeMovie = (id: number) =>
    setHistory((h) => h.filter((e) => e.movie.movieId !== id));

  // Single source of truth: given a history, pull recommendations and derive
  // the hero, top picks, genre rows, and the "because you watched" row.
  const refresh = async (hist: HistEntry[]) => {
    setLoading(true);
    try {
      const payload: HistItem[] = hist.map((h) => ({
        movieId: h.movie.movieId,
        rating: h.rating,
      }));
      const res = await getRecommendations(payload, FETCH_N);
      const all = res.recommendations;
      setRecs(all.slice(0, 14));
      setTaste(res.taste);

      const topGenres = res.taste
        ? Object.entries(res.taste)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([g]) => g)
        : [];
      setGenreRows(
        topGenres
          .map((g) => ({
            genre: g,
            movies: all.filter((m) => m.genres.includes(g)).slice(0, 12),
          }))
          .filter((r) => r.movies.length >= 4),
      );

      const last = hist[hist.length - 1];
      if (last) {
        const b = await getRecommendations(
          [{ movieId: last.movie.movieId, rating: 5 }],
          12,
        );
        setBecause({ title: last.movie.title, movies: b.recommendations });
      } else {
        setBecause(null);
      }
    } finally {
      setLoading(false);
    }
  };

  // "Learn from mistakes": a rejected rec becomes a low-rated history item,
  // then we re-query so the model corrects in real time.
  const reject = async (movie: Movie) => {
    const next = inHistory(movie.movieId)
      ? history
      : [...history, { movie, rating: 1 }];
    setHistory(next);
    await refresh(next);
  };

  const onImported = (res: ImportResponse) => {
    const imported: HistEntry[] = res.history.map((m) => ({
      movie: m,
      rating: m.rating,
    }));
    setHistory(imported);
    if (imported.length) refresh(imported);
  };

  const hasResults = recs.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Brand bar */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <BrandLogo />
          <span className="text-xs text-muted-foreground">
            Sequential movie recommender
          </span>
        </div>
      </div>

      {/* Hero: the top pick once we have recommendations, else a branded intro */}
      {hasResults ? (
        <HeroBanner movie={recs[0]} />
      ) : (
        <header className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 bg-gradient-radial" />
          <div className="relative z-10 mx-auto max-w-6xl px-6 py-20">
            <h1 className="text-5xl font-extrabold tracking-tight text-foreground">
              What to watch <span className="text-primary">next</span>
            </h1>
            <p className="mt-3 max-w-xl text-lg text-muted-foreground">
              Tell us what you have watched, or upload your watchlist. A
              sequential neural network predicts what you will enjoy next, and
              learns the moment it gets you wrong.
            </p>
          </div>
        </header>
      )}

      <main className="mx-auto max-w-6xl space-y-10 px-6 py-10">
        {/* Controls: search + import + history */}
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">
              Build your watch history
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a movie you have watched..."
                className="pl-9"
              />
              {results.length > 0 && (
                <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-popover shadow-cinematic">
                  {results.map((m) => (
                    <button
                      key={m.movieId}
                      onClick={() => addMovie(m)}
                      className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-secondary"
                    >
                      <span className="text-foreground">{m.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {m.year}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {history.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {history.map((h) => (
                  <span
                    key={h.movie.movieId}
                    className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground"
                  >
                    {h.movie.title}
                    <Star className="h-3 w-3 fill-primary text-primary" />
                    {h.rating}
                    <button
                      onClick={() => removeMovie(h.movie.movieId)}
                      className="text-muted-foreground hover:text-primary"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <Button
              onClick={() => refresh(history)}
              disabled={history.length === 0 || loading}
              className="shadow-red-glow"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {loading ? "Thinking..." : "Recommend what to watch next"}
            </Button>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">
              Or import your watchlist
            </h2>
            <ImportDropzone onImported={onImported} />
          </div>
        </section>

        {/* Recommendation rows */}
        {hasResults && (
          <div className="space-y-10">
            <CategoryRow
              title="Top picks for you"
              subtitle="Reject one and watch the model re-rank in real time."
            >
              {recs.map((m) => (
                <PosterCard
                  key={m.movieId}
                  movie={m}
                  showMatch
                  onReject={reject}
                />
              ))}
            </CategoryRow>

            {because && because.movies.length > 0 && (
              <CategoryRow title={`Because you watched ${because.title}`}>
                {because.movies.map((m) => (
                  <PosterCard
                    key={m.movieId}
                    movie={m}
                    showMatch
                    onAdd={(mv) => addMovie(mv)}
                  />
                ))}
              </CategoryRow>
            )}

            {genreRows.map((row) => (
              <CategoryRow key={row.genre} title={`More ${row.genre} for you`}>
                {row.movies.map((m) => (
                  <PosterCard
                    key={m.movieId}
                    movie={m}
                    showMatch
                    onAdd={(mv) => addMovie(mv)}
                  />
                ))}
              </CategoryRow>
            ))}

            {taste && (
              <section className="max-w-md">
                <TasteRadar taste={taste} />
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
