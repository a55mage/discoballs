import { create } from "zustand";
import { buildUniquePlaylistName, normalizePlaylistName, type Playlist, type PlaylistEntry } from "../domain/playlist";
import { readJson, readString, removeKey, writeJson, writeString } from "./storage";

const PLAYLISTS_KEY = "musicmanager-playlists";
const ACTIVE_PLAYLIST_ID_KEY = "musicmanager-active-playlist-id";

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type CoreState = {
  playlists: Playlist[];
  activePlaylistId: string;
  playlistNameDraft: string;
  isPlaylistRenaming: boolean;
};

export type PlaylistState = CoreState & {
  setPlaylistNameDraft: (value: string) => void;
  setActivePlaylist: (playlistId: string) => void;
  createPlaylist: () => void;
  renameActivePlaylist: () => void;
  renameButtonClick: () => void;
  confirmRename: () => void;
  deleteActivePlaylist: () => void;
  insertTrack: (trackId: string, beforeEntryId?: string | null) => void;
  appendTracks: (trackIds: string[]) => void;
  moveEntry: (draggedEntryId: string, targetEntryId?: string | null) => void;
  removeEntry: (entryId: string) => void;
};

/** Keeps the active playlist valid, mirroring what the UI expects after any change. */
export function normalizePlaylistState(state: CoreState): CoreState {
  if (!state.playlists.length) {
    if (!state.activePlaylistId && !state.playlistNameDraft && !state.isPlaylistRenaming) {
      return state;
    }
    return { ...state, activePlaylistId: "", playlistNameDraft: "", isPlaylistRenaming: false };
  }
  if (!state.playlists.some((playlist) => playlist.id === state.activePlaylistId)) {
    return { ...state, activePlaylistId: state.playlists[0].id, playlistNameDraft: state.playlists[0].name };
  }
  return state;
}

function loadInitialState(): CoreState {
  const empty: CoreState = { playlists: [], activePlaylistId: "", playlistNameDraft: "", isPlaylistRenaming: false };
  const parsed = readJson(PLAYLISTS_KEY);
  if (!Array.isArray(parsed) || !parsed.length) {
    return empty;
  }
  const playlists = parsed as Playlist[];
  const savedActiveId = readString(ACTIVE_PLAYLIST_ID_KEY) || "";
  const activePlaylistId = playlists.some((playlist) => playlist.id === savedActiveId) ? savedActiveId : playlists[0].id;
  const active = playlists.find((playlist) => playlist.id === activePlaylistId) ?? playlists[0];
  return { playlists, activePlaylistId, playlistNameDraft: active?.name ?? "", isPlaylistRenaming: false };
}

function withNewPlaylist(state: CoreState, entries: PlaylistEntry[]): CoreState {
  const playlist: Playlist = {
    id: newId("playlist"),
    name: buildUniquePlaylistName(state.playlists, "New Playlist"),
    entries,
  };
  return {
    ...state,
    playlists: [...state.playlists, playlist],
    activePlaylistId: playlist.id,
    playlistNameDraft: playlist.name,
  };
}

export const usePlaylistStore = create<PlaylistState>()((set, get) => {
  const update = (fn: (state: PlaylistState) => CoreState | PlaylistState) =>
    set((state) => normalizePlaylistState(fn(state)) as PlaylistState);

  const updateActive = (fn: (playlist: Playlist) => Playlist) =>
    update((state) => ({
      ...state,
      playlists: state.playlists.map((playlist) => (playlist.id === state.activePlaylistId ? fn(playlist) : playlist)),
    }));

  return {
    ...loadInitialState(),

    setPlaylistNameDraft: (playlistNameDraft) => set({ playlistNameDraft }),

    setActivePlaylist: (playlistId) =>
      update((state) => ({
        ...state,
        isPlaylistRenaming: false,
        activePlaylistId: playlistId,
        playlistNameDraft: state.playlists.find((playlist) => playlist.id === playlistId)?.name ?? "",
      })),

    createPlaylist: () =>
      update((state) => {
        const trimmedName = state.playlistNameDraft.trim();
        const hasNameConflict = trimmedName
          ? state.playlists.some((playlist) => normalizePlaylistName(playlist.name) === normalizePlaylistName(trimmedName))
          : false;
        const baseName = !trimmedName || hasNameConflict ? "New Playlist" : trimmedName;
        const playlist: Playlist = {
          id: newId("playlist"),
          name: buildUniquePlaylistName(state.playlists, baseName),
          entries: [],
        };
        return {
          ...state,
          playlists: [...state.playlists, playlist],
          activePlaylistId: playlist.id,
          playlistNameDraft: playlist.name,
          isPlaylistRenaming: false,
        };
      }),

    renameActivePlaylist: () =>
      update((state) => {
        const active = state.playlists.find((playlist) => playlist.id === state.activePlaylistId);
        const nextName = state.playlistNameDraft.trim();
        if (!active || !nextName) {
          return state;
        }
        const uniqueName = buildUniquePlaylistName(state.playlists, nextName, active.id);
        return {
          ...state,
          playlists: state.playlists.map((playlist) => (playlist.id === active.id ? { ...playlist, name: uniqueName } : playlist)),
          playlistNameDraft: uniqueName,
        };
      }),

    renameButtonClick: () => {
      const state = get();
      const active = state.playlists.find((playlist) => playlist.id === state.activePlaylistId);
      if (!active) {
        return;
      }
      if (!state.isPlaylistRenaming) {
        set({ playlistNameDraft: active.name, isPlaylistRenaming: true });
        return;
      }
      get().confirmRename();
    },

    confirmRename: () => {
      get().renameActivePlaylist();
      set({ isPlaylistRenaming: false });
    },

    deleteActivePlaylist: () =>
      update((state) => {
        const active = state.playlists.find((playlist) => playlist.id === state.activePlaylistId);
        if (!active) {
          return state;
        }
        const playlists = state.playlists.filter((playlist) => playlist.id !== active.id);
        return {
          ...state,
          playlists,
          activePlaylistId: playlists[0]?.id ?? "",
          playlistNameDraft: playlists[0]?.name ?? "",
          isPlaylistRenaming: false,
        };
      }),

    insertTrack: (trackId, beforeEntryId) =>
      update((state) => {
        const entry: PlaylistEntry = { id: newId("entry"), trackId };
        if (!state.playlists.some((playlist) => playlist.id === state.activePlaylistId)) {
          return withNewPlaylist(state, [entry]);
        }
        return {
          ...state,
          playlists: state.playlists.map((playlist) => {
            if (playlist.id !== state.activePlaylistId) {
              return playlist;
            }
            const atIndex = beforeEntryId ? playlist.entries.findIndex((item) => item.id === beforeEntryId) : -1;
            if (atIndex < 0) {
              return { ...playlist, entries: [...playlist.entries, entry] };
            }
            const entries = [...playlist.entries];
            entries.splice(atIndex, 0, entry);
            return { ...playlist, entries };
          }),
        };
      }),

    appendTracks: (trackIds) => {
      const ids = trackIds.filter(Boolean);
      if (!ids.length) {
        return;
      }
      update((state) => {
        const entries: PlaylistEntry[] = ids.map((trackId) => ({ id: newId("entry"), trackId }));
        if (!state.playlists.some((playlist) => playlist.id === state.activePlaylistId)) {
          return withNewPlaylist(state, entries);
        }
        return {
          ...state,
          playlists: state.playlists.map((playlist) =>
            playlist.id === state.activePlaylistId ? { ...playlist, entries: [...playlist.entries, ...entries] } : playlist
          ),
        };
      });
    },

    moveEntry: (draggedEntryId, targetEntryId) =>
      updateActive((playlist) => {
        const fromIndex = playlist.entries.findIndex((entry) => entry.id === draggedEntryId);
        if (fromIndex < 0) {
          return playlist;
        }
        let toIndex = targetEntryId
          ? playlist.entries.findIndex((entry) => entry.id === targetEntryId)
          : playlist.entries.length - 1;
        if (toIndex < 0) {
          toIndex = playlist.entries.length - 1;
        }
        if (fromIndex === toIndex) {
          return playlist;
        }
        const entries = [...playlist.entries];
        const [moved] = entries.splice(fromIndex, 1);
        entries.splice(toIndex, 0, moved);
        return { ...playlist, entries };
      }),

    removeEntry: (entryId) =>
      updateActive((playlist) => ({ ...playlist, entries: playlist.entries.filter((entry) => entry.id !== entryId) })),
  };
});

writeJson(PLAYLISTS_KEY, usePlaylistStore.getState().playlists);
usePlaylistStore.subscribe((state, previous) => {
  if (state.playlists !== previous.playlists) {
    writeJson(PLAYLISTS_KEY, state.playlists);
  }
  if (state.activePlaylistId !== previous.activePlaylistId) {
    if (state.activePlaylistId) {
      writeString(ACTIVE_PLAYLIST_ID_KEY, state.activePlaylistId);
    } else {
      removeKey(ACTIVE_PLAYLIST_ID_KEY);
    }
  }
});
