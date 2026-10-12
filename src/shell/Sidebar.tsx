import { IconHeart, IconPlus } from "../components/icons";
import { useFavoritesStore } from "../store/favoritesStore";
import { useLibraryViewStore } from "../store/libraryViewStore";
import appIcon from "../assets/discoballs-icon.png";
import { usePlaylistStore } from "../store/playlistStore";
import { useLibraryStore } from "../store/libraryStore";
import { useNavidromeStore } from "../store/navidromeStore";
import { useUiStore } from "../store/uiStore";
import { Cover, IconButton, cx } from "../ui";
import { SCREENS } from "./screens";

type SidebarProps = {
  /** The accent rotates when the brand is clicked (kept from earlier versions). */
  onBrandClick: () => void;
};

export function Sidebar({ onBrandClick }: SidebarProps) {
  const { activeScreen, setActiveScreen } = useUiStore();
  const { playlists, activePlaylistId, setActivePlaylist, createPlaylist } = usePlaylistStore();
  const tracks = useLibraryStore((state) => state.tracks);
  const folderPath = useLibraryStore((state) => state.folderPath);
  const connectedBookmarkId = useNavidromeStore((state) => state.connectedNavidromeBookmarkId);
  const bookmarks = useNavidromeStore((state) => state.navidromeBookmarks);
  const setNavidromePanelOpen = useNavidromeStore((state) => state.setIsNavidromePanelOpen);
  const favoritesCount = useFavoritesStore((state) => state.favorites.length);
  const { filter, setFilter, setScope, setTab } = useLibraryViewStore();
  const connected = bookmarks.find((bookmark) => bookmark.id === connectedBookmarkId);

  const coverOf = (trackId: string) => tracks.find((track) => track.id === trackId)?.coverUrl;
  const mainScreens = SCREENS.filter((screen) => screen.id !== "settings");
  const settings = SCREENS.find((screen) => screen.id === "settings");

  return (
    <aside className="shell__sidebar" aria-label="Main navigation">
      <button type="button" className="shell__brand" onClick={onBrandClick} title="Change accent color" aria-label="DiscoBalls, change accent color">
        <img src={appIcon} alt="" className="shell__brand-icon" />
        <span className="shell__navlabel db-text-display">DiscoBalls</span>
      </button>

      <nav className="shell__nav">
        {mainScreens.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={cx("shell__nav-btn", activeScreen === id && "is-active")}
            aria-current={activeScreen === id ? "page" : undefined}
            aria-label={label}
            title={label}
            onClick={() => setActiveScreen(id)}
          >
            <Icon className="shell__nav-icon" aria-hidden="true" />
            <span className="shell__navlabel">{label}</span>
          </button>
        ))}
      </nav>

      <div className="shell__section-head shell__navlabel">
        <span>Playlists</span>
        <IconButton
          label="New playlist"
          size="sm"
          onClick={() => {
            createPlaylist();
            setActiveScreen("dashboard");
          }}
        >
          <IconPlus />
        </IconButton>
      </div>
      <ul className="shell__playlists shell__navlabel">
        <li>
          <button
            type="button"
            className={cx("shell__playlist-btn", activeScreen === "library" && filter === "favorites" && "is-active")}
            onClick={() => {
              setScope(null);
              setTab("tracks");
              setFilter("favorites");
              setActiveScreen("library");
            }}
          >
            <span className="shell__fav-icon"><IconHeart aria-hidden="true" /></span>
            <span className="shell__playlist-text">
              <span className="shell__playlist-name">Favorites</span>
              <span className="shell__playlist-meta">{favoritesCount} {favoritesCount === 1 ? "track" : "tracks"}</span>
            </span>
          </button>
        </li>
        {playlists.length === 0 ? <li className="shell__empty">No playlists yet</li> : null}
        {playlists.map((playlist) => (
          <li key={playlist.id}>
            <button
              type="button"
              className={cx("shell__playlist-btn", playlist.id === activePlaylistId && activeScreen === "dashboard" && "is-active")}
              onClick={() => {
                setActivePlaylist(playlist.id);
                setActiveScreen("dashboard");
              }}
            >
              <Cover size={34} radius={8} src={playlist.entries[0] ? coverOf(playlist.entries[0].trackId) : undefined} />
              <span className="shell__playlist-text">
                <span className="shell__playlist-name">{playlist.name}</span>
                <span className="shell__playlist-meta">{playlist.entries.length} tracks</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="shell__source shell__navlabel" aria-label="Library source">
        <div className="shell__source-line" title={folderPath || "No folder open"}>
          <span>{folderPath || "No folder open"}</span>
        </div>
        <button type="button" className="shell__source-line shell__source-line--muted shell__source-btn" onClick={() => setNavidromePanelOpen(true)}>
          <span className={cx("shell__dot", connected && "is-on")} aria-hidden="true" />
          <span>{connected ? `Navidrome · ${connected.name}` : "Connect Navidrome…"}</span>
        </button>
      </div>

      {settings ? (
        <button
          type="button"
          className={cx("shell__nav-btn", activeScreen === "settings" && "is-active")}
          aria-current={activeScreen === "settings" ? "page" : undefined}
          aria-label={settings.label}
          title={settings.label}
          onClick={() => setActiveScreen("settings")}
        >
          <settings.Icon className="shell__nav-icon" aria-hidden="true" />
          <span className="shell__navlabel">{settings.label}</span>
        </button>
      ) : null}
    </aside>
  );
}
