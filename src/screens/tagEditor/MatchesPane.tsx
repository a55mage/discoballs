import { type KeyboardEvent, useMemo } from "react";
import { IconCover, IconSave, IconSearch } from "../../components/icons";
import { applyAndSaveOnlineResult, applyOnlineCoverOnly, applyOnlineResult } from "../../actions/tagEditor";
import { cancelOnlineSearch, searchOnlineForCurrentQuery } from "../../actions/onlineSearch";
import { diffMatch } from "../../domain/matches";
import { orderOnlineResults } from "../../domain/onlineResults";
import { useTagEditorStore } from "../../store/tagEditorStore";
import type { OnlineMatch, Track } from "../../types";
import { formatOnlineMatchDate } from "../../utils/appHelpers";
import { getUserLocale } from "../../utils/common";
import { Badge, Button, Cover, Field, IconButton, TextInput, cx } from "../../ui";

type MatchesPaneProps = {
  draft: Track | null;
  readOnly: boolean;
};

export function MatchesPane({ draft, readOnly }: MatchesPaneProps) {
  const editor = useTagEditorStore();
  const locale = useMemo(() => getUserLocale(), []);
  const { sorted, bestMatchId } = useMemo(
    () => orderOnlineResults(editor.onlineResults, { title: editor.searchTitle, artist: editor.searchArtist, album: editor.searchAlbum }),
    [editor.onlineResults, editor.searchTitle, editor.searchArtist, editor.searchAlbum]
  );

  function onSearchKey(event: KeyboardEvent) {
    if (event.key === "Enter" && !editor.isLoadingSearch) {
      event.preventDefault();
      void searchOnlineForCurrentQuery();
    }
  }

  return (
    <section className="tag-matches db-glass db-pane--divider-left" aria-label="Online matches">
      <header className="tag-matches__head">
        <div>
          <h2>Online matches</h2>
          <p>MusicBrainz · iTunes</p>
        </div>
      </header>

      <div className="tag-matches__query" onKeyDown={onSearchKey}>
        <Field label="Search title">
          <TextInput value={editor.searchTitle} onChange={(event) => editor.setSearchTitle(event.target.value)} disabled={!draft} />
        </Field>
        <Field label="Search artist">
          <TextInput value={editor.searchArtist} onChange={(event) => editor.setSearchArtist(event.target.value)} disabled={!draft} />
        </Field>
        <Field label="Search album">
          <TextInput value={editor.searchAlbum} onChange={(event) => editor.setSearchAlbum(event.target.value)} disabled={!draft} />
        </Field>
        <Button
          variant={editor.isLoadingSearch ? "secondary" : "primary"}
          icon={<IconSearch />}
          disabled={!draft}
          onClick={() => (editor.isLoadingSearch ? cancelOnlineSearch() : void searchOnlineForCurrentQuery())}
        >
          {editor.isLoadingSearch ? "Cancel" : "Search"}
        </Button>
      </div>
      <p className="tag-matches__status" role="status">{editor.searchStatus}</p>

      <ul className="tag-matches__list" aria-label="Results">
        {draft
          ? sorted.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                draft={draft}
                best={match.id === bestMatchId}
                selected={match.id === editor.selectedResultId}
                dateLabel={formatOnlineMatchDate(match.date, locale)}
                readOnly={readOnly}
                onSelect={() => editor.setSelectedResultId(match.id)}
              />
            ))
          : null}
        {draft && sorted.length === 0 && !editor.isLoadingSearch ? (
          <li className="tag-matches__empty">No results yet. Search to find tags and artwork online.</li>
        ) : null}
        {!draft ? <li className="tag-matches__empty">Select a track to search for it online.</li> : null}
      </ul>
    </section>
  );
}

type MatchCardProps = {
  match: OnlineMatch;
  draft: Track;
  best: boolean;
  selected: boolean;
  dateLabel: string;
  readOnly: boolean;
  onSelect: () => void;
};

function MatchCard({ match, draft, best, selected, dateLabel, readOnly, onSelect }: MatchCardProps) {
  const diffs = diffMatch(draft, match);
  const applied = diffs.length === 0;
  return (
    <li className={cx("tag-match", best && "is-best", applied && "is-applied", selected && "is-selected")} onClick={onSelect}>
      <div className="tag-match__top">
        <Cover src={match.coverUrl} size={56} radius={10} />
        <div className="tag-match__text">
          <div className="tag-match__badges">
            {best ? <Badge>Best match</Badge> : null}
            {match.source ? <Badge tone="neutral">{match.source}</Badge> : null}
          </div>
          <strong title={match.title}>{match.title}</strong>
          <span title={`${match.artist} · ${match.album}`}>{match.artist} · {match.album}</span>
          {dateLabel ? <span>{dateLabel}</span> : null}
        </div>
      </div>

      {applied ? (
        <p className="tag-match__same">Already identical to this result.</p>
      ) : (
        <ul className="tag-match__diffs" aria-label="Changes">
          {diffs.map((diff) => (
            <li key={diff.field}>
              <span className="tag-diff__label">{diff.label}</span>
              <span className="tag-diff__from">{diff.from || "—"}</span>
              <span aria-hidden="true">→</span>
              <strong className="tag-diff__to">{diff.to || "—"}</strong>
            </li>
          ))}
        </ul>
      )}

      <div className="tag-match__actions">
        <Button variant="primary" size="sm" disabled={readOnly || applied} onClick={() => applyOnlineResult(match)}>Apply</Button>
        <IconButton label="Apply cover only" disabled={readOnly || !match.coverUrl} onClick={() => applyOnlineCoverOnly(match)}><IconCover /></IconButton>
        <IconButton label="Apply and save" disabled={readOnly || applied} onClick={() => void applyAndSaveOnlineResult(match)}><IconSave /></IconButton>
      </div>
    </li>
  );
}
