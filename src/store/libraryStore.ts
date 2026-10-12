import { create } from "zustand";
import type { Track } from "../types";
import { fieldSetter, type Setter } from "./util";

export type LibraryState = {
  tracks: Track[];
  folderPath: string;
  selectedTrackId: string;
  isLoadingScan: boolean;
  setTracks: Setter<Track[]>;
  setFolderPath: Setter<string>;
  setSelectedTrackId: Setter<string>;
  setIsLoadingScan: Setter<boolean>;
};

export const useLibraryStore = create<LibraryState>()((set) => ({
  tracks: [],
  folderPath: "",
  selectedTrackId: "",
  isLoadingScan: false,
  setTracks: fieldSetter(set, "tracks"),
  setFolderPath: fieldSetter(set, "folderPath"),
  setSelectedTrackId: fieldSetter(set, "selectedTrackId"),
  setIsLoadingScan: fieldSetter(set, "isLoadingScan"),
}));
