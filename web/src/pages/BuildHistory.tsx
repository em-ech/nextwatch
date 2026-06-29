import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Sparkles, X, Star } from "lucide-react";
import {
  Movie,
  ImportResponse,
  searchCatalog,
  getSavedHistory,
  addSavedMovie,
  removeSavedMovie,
} from "@/lib/api";
import { useAuth } from "@/auth/AuthContext";
import { NavBar } from "@/components/NavBar";
import { ImportDropzone } from "@/components/ImportDropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface HistEntry {
  movie: Movie;
  rating: number;
}

export default function BuildHistory() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Movie[]>([]);
  const [history, setHistory] = useState<HistEntry[]>([]);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Hydrate the working history from the saved profile when logged in.
  useEffect(() => {
    if (!user) return;
    getSavedHistory()
      .then((saved) =>
        setHistory(saved.map((m) => ({ movie: m, rating: m.rating }))),
      )
      .catch(() => {});
  }, [user]);

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
    if (!inHistory(movie.movieId)) {
      setHistory((h) => [...h, { movie, rating }]);
      if (user) addSavedMovie(movie.movieId, rating).catch(() => {});
    }
    setQuery("");
    setResults([]);
  };

  const removeMovie = (id: number) => {
    setHistory((h) => h.filter((e) => e.movie.movieId !== id));
    if (user) removeSavedMovie(id).catch(() => {});
  };

  const onImported = (res: ImportResponse) => {
    const imported: HistEntry[] = res.history.map((m) => ({
      movie: m,
      rating: m.rating,
    }));
    setHistory(imported);
    if (user) {
      imported.forEach((h) =>
        addSavedMovie(h.movie.movieId, h.rating).catch(() => {}),
      );
    }
  };

  const seeRecommendations = () => navigate("/results", { state: { history } });

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

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

      <main className="mx-auto max-w-6xl px-6 py-10">
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
              onClick={seeRecommendations}
              disabled={history.length === 0}
              className="shadow-red-glow"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              See your recommendations
            </Button>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">
              Or import your watchlist
            </h2>
            <ImportDropzone onImported={onImported} />
          </div>
        </section>
      </main>
    </div>
  );
}
