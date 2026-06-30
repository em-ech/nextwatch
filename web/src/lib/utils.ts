import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Display a MovieLens genre without hyphens (e.g. "Sci-Fi" -> "Sci Fi").
export function genreLabel(g: string): string {
  return g.replace(/-/g, " ");
}
