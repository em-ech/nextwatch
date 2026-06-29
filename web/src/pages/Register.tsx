import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(username, password, displayName || undefined);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="absolute inset-0 bg-gradient-radial" />
      <form
        onSubmit={submit}
        className="relative z-10 w-full max-w-sm space-y-5 rounded-xl border border-border bg-card p-8 shadow-cinematic"
      >
        <BrandLogo className="justify-center" />
        <h1 className="text-center text-xl font-bold text-foreground">
          Create your profile
        </h1>
        <div className="space-y-3">
          <Input
            placeholder="Username (letters, numbers, _)"
            value={username}
            autoCapitalize="none"
            onChange={(e) => setUsername(e.target.value)}
          />
          <Input
            placeholder="Display name (optional)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          className="w-full shadow-red-glow"
          disabled={busy || username.length < 3 || password.length < 6}
        >
          {busy ? "Creating..." : "Sign up"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
