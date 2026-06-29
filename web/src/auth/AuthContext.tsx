import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  User,
  getMe,
  getToken,
  setToken,
  login as apiLogin,
  register as apiRegister,
} from "@/lib/api";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (
    username: string,
    password: string,
    displayName?: string,
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Rehydrate the session from a stored token on first mount.
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    getMe()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const res = await apiLogin(username, password);
    setToken(res.token);
    setUser(res.user);
  };

  const register = async (
    username: string,
    password: string,
    displayName?: string,
  ) => {
    const res = await apiRegister(username, password, displayName);
    setToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
