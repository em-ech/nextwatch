import { createContext, useContext, useState, ReactNode } from "react";

export type Region = "US" | "ES";
const REGION_KEY = "reverie_region";

interface RegionState {
  region: Region;
  setRegion: (r: Region) => void;
}

const RegionContext = createContext<RegionState | null>(null);

export function RegionProvider({ children }: { children: ReactNode }) {
  const [region, setRegionState] = useState<Region>(
    (localStorage.getItem(REGION_KEY) as Region) || "US",
  );
  const setRegion = (r: Region) => {
    localStorage.setItem(REGION_KEY, r);
    setRegionState(r);
  };
  return (
    <RegionContext.Provider value={{ region, setRegion }}>
      {children}
    </RegionContext.Provider>
  );
}

export function useRegion(): RegionState {
  const ctx = useContext(RegionContext);
  if (!ctx) throw new Error("useRegion must be used within RegionProvider");
  return ctx;
}
