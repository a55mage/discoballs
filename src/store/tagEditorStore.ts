import { create } from "zustand";
import type { OnlineMatch, Track } from "../types";
import { fieldSetter, type Setter } from "./util";

export type TagEditorState = {
  trackDraft: Track | null;
  onlineResults: OnlineMatch[];
  selectedResultId: string;
  isLoadingSearch: boolean;
  searchStatus: string;
  searchTitle: string;
  searchArtist: string;
  searchAlbum: string;
  setTrackDraft: Setter<Track | null>;
  setOnlineResults: Setter<OnlineMatch[]>;
  setSelectedResultId: Setter<string>;
  setIsLoadingSearch: Setter<boolean>;
  setSearchStatus: Setter<string>;
  setSearchTitle: Setter<string>;
  setSearchArtist: Setter<string>;
  setSearchAlbum: Setter<string>;
};

export const useTagEditorStore = create<TagEditorState>()((set) => ({
  trackDraft: null,
  onlineResults: [],
  selectedResultId: "",
  isLoadingSearch: false,
  searchStatus: "Ready",
  searchTitle: "",
  searchArtist: "",
  searchAlbum: "",
  setTrackDraft: fieldSetter(set, "trackDraft"),
  setOnlineResults: fieldSetter(set, "onlineResults"),
  setSelectedResultId: fieldSetter(set, "selectedResultId"),
  setIsLoadingSearch: fieldSetter(set, "isLoadingSearch"),
  setSearchStatus: fieldSetter(set, "searchStatus"),
  setSearchTitle: fieldSetter(set, "searchTitle"),
  setSearchArtist: fieldSetter(set, "searchArtist"),
  setSearchAlbum: fieldSetter(set, "searchAlbum"),
}));
