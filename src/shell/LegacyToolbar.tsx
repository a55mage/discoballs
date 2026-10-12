import { IconGlobe, IconHeart, IconPlay, IconPlus, IconRename, IconTrash, IconUser } from "../components/icons";
import { usePlaylistStore } from "../store/playlistStore";
import { useUiStore } from "../store/uiStore";
import { IconButton, TextInput } from "../ui";
import { openExternalLink } from "../utils/external";
import { APP_VERSION } from "../version";

type LegacyToolbarProps = {
  onPlayActivePlaylist: () => void;
};

/**
 * Controls that used to live in the old sidebar and still belong to the legacy screens
 * (player layout, playlist editing, app links). Removed as each screen is redesigned.
 */
export function LegacyToolbar({ onPlayActivePlaylist }: LegacyToolbarProps) {
  const activeScreen = useUiStore((state) => state.activeScreen);
  const playlists = usePlaylistStore();
  const activePlaylist = playlists.playlists.find((playlist) => playlist.id === playlists.activePlaylistId);

  if (activeScreen === "dashboard") {
    return (
      <div className="shell__toolbar" role="toolbar" aria-label="Playlist actions">
        <IconButton label="Create playlist" onClick={playlists.createPlaylist}><IconPlus /></IconButton>
        <IconButton label={playlists.isPlaylistRenaming ? "Confirm rename" : "Rename playlist"} disabled={!activePlaylist} onClick={playlists.renameButtonClick}><IconRename /></IconButton>
        <IconButton label="Delete playlist" disabled={!activePlaylist} onClick={playlists.deleteActivePlaylist}><IconTrash /></IconButton>
        <IconButton label="Play playlist" disabled={!activePlaylist?.entries.length} onClick={onPlayActivePlaylist}><IconPlay /></IconButton>
        {playlists.isPlaylistRenaming ? (
          <TextInput
            className="shell__toolbar-input"
            aria-label="Playlist name"
            placeholder="Playlist name"
            autoFocus
            value={playlists.playlistNameDraft}
            onChange={(event) => playlists.setPlaylistNameDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                playlists.confirmRename();
              }
            }}
          />
        ) : null}
      </div>
    );
  }

  if (activeScreen === "settings") {
    return (
      <div className="shell__toolbar" role="toolbar" aria-label="About">
        <strong>DiscoBalls v{APP_VERSION}</strong>
        <IconButton label="Website" onClick={() => void openExternalLink("https://a55mage.github.io/discoballs/")}><IconGlobe /></IconButton>
        <IconButton label="Developer" onClick={() => void openExternalLink("https://a55mage.github.io/")}><IconUser /></IconButton>
        <IconButton label="Donate" onClick={() => void openExternalLink("https://www.paypal.com/donate/?business=r.macis%40live.it")}><IconHeart /></IconButton>
      </div>
    );
  }

  return null;
}
