import { create } from "zustand";
import { readJson, writeJson } from "./storage";

const FAVORITES_KEY = "musicmanager-favorites";
const RATINGS_KEY = "musicmanager-ratings";

export const MAX_RATING = 5;

export type FavoritesState = {
  /** Track ids (file paths). */
  favorites: string[];
  /** Track id → 1…5 stars. Tracks without a rating are absent. */
  ratings: Record<string, number>;
  toggleFavorite: (trackId: string) => void;
  setFavorite: (trackId: string, value: boolean) => void;
  /** Same star again clears the rating. */
  setRating: (trackId: string, rating: number) => void;
  /** A track file was renamed: favorite and rating follow it. */
  retarget: (oldTrackId: string, newTrackId: string) => void;
};

function loadFavorites(): string[] {
  const saved = readJson(FAVORITES_KEY);
  return Array.isArray(saved) ? saved.filter((item): item is string => typeof item === "string") : [];
}

function loadRatings(): Record<string, number> {
  const saved = readJson(RATINGS_KEY);
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(saved as Record<string, unknown>)
      .filter(([, value]) => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_RATING)
      .map(([key, value]) => [key, value as number])
  );
}

export const useFavoritesStore = create<FavoritesState>()((set) => ({
  favorites: loadFavorites(),
  ratings: loadRatings(),

  toggleFavorite: (trackId) =>
    set((state) => ({
      favorites: state.favorites.includes(trackId) ? state.favorites.filter((id) => id !== trackId) : [...state.favorites, trackId],
    })),
  setFavorite: (trackId, value) =>
    set((state) => {
      const has = state.favorites.includes(trackId);
      if (has === value) {
        return state;
      }
      return { favorites: value ? [...state.favorites, trackId] : state.favorites.filter((id) => id !== trackId) };
    }),
  setRating: (trackId, rating) =>
    set((state) => {
      const next = { ...state.ratings };
      const value = Math.max(0, Math.min(MAX_RATING, Math.round(rating)));
      if (value === 0 || state.ratings[trackId] === value) {
        delete next[trackId];
      } else {
        next[trackId] = value;
      }
      return { ratings: next };
    }),
  retarget: (oldTrackId, newTrackId) =>
    set((state) => {
      const favorites = state.favorites.includes(oldTrackId) ? state.favorites.map((id) => (id === oldTrackId ? newTrackId : id)) : state.favorites;
      let ratings = state.ratings;
      if (oldTrackId in ratings) {
        const { [oldTrackId]: rating, ...rest } = ratings;
        ratings = { ...rest, [newTrackId]: rating };
      }
      return favorites === state.favorites && ratings === state.ratings ? state : { favorites, ratings };
    }),
}));

useFavoritesStore.subscribe((state, previous) => {
  if (state.favorites !== previous.favorites) writeJson(FAVORITES_KEY, state.favorites);
  if (state.ratings !== previous.ratings) writeJson(RATINGS_KEY, state.ratings);
});
