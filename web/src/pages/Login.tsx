import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
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
          Welcome back
        </h1>
        <div className="space-y-3">
          <Input
            placeholder="Username"
            value={username}
            autoCapitalize="none"
            onChange={(e) => setUsername(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          type="submit"
          className="w-full shadow-red-glow"
          disabled={busy || !username || !password}
        >
          {busy ? "Signing in..." : "Log in"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link to="/register" className="text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
}
