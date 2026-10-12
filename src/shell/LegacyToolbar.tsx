import { IconGlobe, IconHeart, IconListCompact, IconMic, IconFolder, IconPlay, IconPlus, IconRename, IconTrash, IconUser, IconVisualizerBars } from "../components/icons";
import { VISUALIZER_PRESETS, type VisualizerPresetId } from "../sections/MusicVisualizerSection";
import { usePlaylistStore } from "../store/playlistStore";
import { useSettingsStore } from "../store/settingsStore";
import { useUiStore } from "../store/uiStore";
import { IconButton, Segmented, TextInput } from "../ui";
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
  const settings = useSettingsStore();
  const playlists = usePlaylistStore();
  const activePlaylist = playlists.playlists.find((playlist) => playlist.id === playlists.activePlaylistId);

  if (activeScreen === "player") {
    const { playerColumnVisibility: cols, showPlayerLyricsSection } = settings;
    return (
      <div className="shell__toolbar" role="toolbar" aria-label="Player layout">
        <IconButton label={cols.library ? "Hide library" : "Show library"} active={cols.library} onClick={() => settings.togglePlayerColumn("library")}><IconFolder /></IconButton>
        <IconButton label={showPlayerLyricsSection ? "Hide lyrics" : "Show lyrics"} active={showPlayerLyricsSection} onClick={settings.toggleShowPlayerLyrics}><IconMic /></IconButton>
        <IconButton label={cols.visualizer ? "Hide visualizer" : "Show visualizer"} active={cols.visualizer} onClick={() => settings.togglePlayerColumn("visualizer")}><IconVisualizerBars /></IconButton>
        <IconButton label={cols.queue ? "Hide queue" : "Show queue"} active={cols.queue} onClick={() => settings.togglePlayerColumn("queue")}><IconListCompact /></IconButton>
        <Segmented
          label="Visualizer type"
          value={settings.playerVisualizerPresetId}
          onChange={(value) => settings.setPlayerVisualizerPresetId(value as VisualizerPresetId)}
          options={VISUALIZER_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))}
        />
      </div>
    );
  }

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
