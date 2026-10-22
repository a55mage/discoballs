import { IconFolder, IconHeart, IconPlus, IconSidebar } from "../components/icons";
import { useFavoritesStore } from "../store/favoritesStore";
import { useLibraryViewStore } from "../store/libraryViewStore";
import { usePlaylistStore } from "../store/playlistStore";
import { useLibraryStore } from "../store/libraryStore";
import { useSettingsStore } from "../store/settingsStore";
import { useUiStore } from "../store/uiStore";
import { Cover, IconButton, cx } from "../ui";
import { SCREENS } from "./screens";

type SidebarProps = {
  /** Icons only: chosen in the settings, or forced by a narrow window. */
  collapsed: boolean;
  /** False when the window is too narrow for the full sidebar, so the toggle would do nothing. */
  canExpand: boolean;
};

export function Sidebar({ collapsed, canExpand }: SidebarProps) {
  const { activeScreen, setActiveScreen } = useUiStore();
  const { playlists, activePlaylistId, setActivePlaylist, createPlaylist } = usePlaylistStore();
  const tracks = useLibraryStore((state) => state.tracks);
  const folderPath = useLibraryStore((state) => state.folderPath);
  const favoritesCount = useFavoritesStore((state) => state.favorites.length);
  const { filter, setFilter, setScope, setTab } = useLibraryViewStore();
  const { sidebarCollapsed, setSidebarCollapsed } = useSettingsStore();

  const coverOf = (trackId: string) => tracks.find((track) => track.id === trackId)?.coverUrl;
  const mainScreens = SCREENS.filter((screen) => screen.id !== "settings");
  const settings = SCREENS.find((screen) => screen.id === "settings");
  const favoritesLabel = `Favorites, ${favoritesCount} ${favoritesCount === 1 ? "track" : "tracks"}`;

  return (
    <aside className={cx("shell__sidebar", collapsed && "is-collapsed")} aria-label="Main navigation">
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

      <div className="shell__section-head">
        <span className="shell__navlabel">Playlists</span>
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
      <ul className="shell__playlists">
        <li>
          <button
            type="button"
            className={cx("shell__playlist-btn", activeScreen === "library" && filter === "favorites" && "is-active")}
            aria-label={collapsed ? favoritesLabel : undefined}
            title={collapsed ? favoritesLabel : undefined}
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
        {playlists.length === 0 ? <li className="shell__empty shell__navlabel">No playlists yet</li> : null}
        {playlists.map((playlist) => (
          <li key={playlist.id}>
            <button
              type="button"
              className={cx("shell__playlist-btn", playlist.id === activePlaylistId && activeScreen === "dashboard" && "is-active")}
              aria-label={collapsed ? `${playlist.name}, ${playlist.entries.length} tracks` : undefined}
              title={collapsed ? playlist.name : undefined}
              onClick={() => {
                setActivePlaylist(playlist.id);
                setActiveScreen("dashboard");
              }}
            >
              <Cover size={28} radius={7} src={playlist.entries[0] ? coverOf(playlist.entries[0].trackId) : undefined} />
              <span className="shell__playlist-text">
                <span className="shell__playlist-name">{playlist.name}</span>
                <span className="shell__playlist-meta">{playlist.entries.length} tracks</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {folderPath && !collapsed ? (
        <div className="shell__source" title={folderPath} aria-label="Library folder">
          <IconFolder aria-hidden="true" />
          <span>{folderPath}</span>
        </div>
      ) : null}

      <div className="shell__side-foot">
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
        {canExpand ? (
          <IconButton
            className="shell__side-toggle"
            label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!sidebarCollapsed}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <IconSidebar />
          </IconButton>
        ) : null}
      </div>
    </aside>
  );
}
