import { type ComponentType, type SVGProps } from "react";
import { Card } from "../components/Card";
import type { OnlineMatch } from "../types";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type OnlineSearchSectionProps = {
  searchStatus: string;
  searchTitle: string;
  onSearchTitleChange: (value: string) => void;
  searchArtist: string;
  onSearchArtistChange: (value: string) => void;
  searchAlbum: string;
  onSearchAlbumChange: (value: string) => void;
  onSearchButtonClick: () => void;
  canSearch: boolean;
  isLoadingSearch: boolean;
  sortedOnlineResults: OnlineMatch[];
  selectedResultId: string;
  onSelectResult: (id: string) => void;
  bestMatchResultId: string;
  formatResultDate: (date: string) => string;
  onApplyOnlineResult: (result: OnlineMatch) => void;
  onApplyOnlineCoverOnly: (result: OnlineMatch) => void;
  onApplyAndSaveOnlineResult: (result: OnlineMatch) => void;
  IconSearch: IconComponent;
  IconClose: IconComponent;
  IconCheck: IconComponent;
  IconCover: IconComponent;
  IconSave: IconComponent;
};

export function OnlineSearchSection({
  searchStatus,
  searchTitle,
  onSearchTitleChange,
  searchArtist,
  onSearchArtistChange,
  searchAlbum,
  onSearchAlbumChange,
  onSearchButtonClick,
  canSearch,
  isLoadingSearch,
  sortedOnlineResults,
  selectedResultId,
  onSelectResult,
  bestMatchResultId,
  formatResultDate,
  onApplyOnlineResult,
  onApplyOnlineCoverOnly,
  onApplyAndSaveOnlineResult,
  IconSearch,
  IconClose,
  IconCheck,
  IconCover,
  IconSave,
}: OnlineSearchSectionProps) {
  return (
    <Card title="Online search" className="search-card" headerRight={<span className="search-status">{searchStatus}</span>}>
      <div className="form-grid">
        <label className="floating-field">
          <input className="input" placeholder=" " value={searchTitle} onChange={(event) => onSearchTitleChange(event.target.value)} />
          <span className="floating-label">Title query</span>
        </label>
        <label className="floating-field">
          <input className="input" placeholder=" " value={searchArtist} onChange={(event) => onSearchArtistChange(event.target.value)} />
          <span className="floating-label">Artist query</span>
        </label>
        <div className="query-field">
          <div className="query-with-action">
            <label className="floating-field">
              <input className="input" placeholder=" " value={searchAlbum} onChange={(event) => onSearchAlbumChange(event.target.value)} />
              <span className="floating-label">Album query</span>
            </label>
            <div className="search-action-wrap">
              <button
                onClick={onSearchButtonClick}
                disabled={!canSearch && !isLoadingSearch}
                title={isLoadingSearch ? "Cancel search" : "Search online"}
                aria-label={isLoadingSearch ? "Cancel search" : "Search online"}
              >
                <span className="btn-content">
                  {isLoadingSearch ? <IconClose className="btn-icon" /> : <IconSearch className="btn-icon" />}
                </span>
              </button>
              {isLoadingSearch && <span className="search-spinner" aria-hidden="true" />}
            </div>
          </div>
        </div>
      </div>

      <div className="results-grid">
        {sortedOnlineResults.map((result) => (
          <article
            key={result.id}
            className={result.id === selectedResultId ? "result-card selected" : "result-card"}
            onClick={() => onSelectResult(result.id)}
          >
            <div className="result-row">
              {result.coverUrl ? (
                <img src={result.coverUrl} alt={`Cover ${result.album}`} className="result-cover" />
              ) : (
                <div className="result-cover-placeholder">No cover</div>
              )}
              <div className="result-content">
                <div className="result-main">
                  <div className="result-title-row">
                    <h3>{result.artist} - {result.title}</h3>
                  </div>
                  <p>Album: {result.album}</p>
                  <p>Date: {formatResultDate(result.date)}</p>
                  <p className="muted">Source: {result.source ?? "N/A"}</p>
                </div>
                <div className="result-actions">
                  <div className="result-actions-top">
                    {result.id === bestMatchResultId && <span className="best-match-badge">best match</span>}
                  </div>
                  <div className="result-actions-row">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectResult(result.id);
                        onApplyOnlineResult(result);
                      }}
                      disabled={!canSearch}
                      title="Apply"
                      aria-label="Apply"
                    >
                      <span className="btn-content"><IconCheck className="btn-icon" /></span>
                    </button>
                    <button
                      className="ghost-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectResult(result.id);
                        onApplyOnlineCoverOnly(result);
                      }}
                      disabled={!canSearch || !result.coverUrl}
                      title="Apply cover only"
                      aria-label="Apply cover only"
                    >
                      <span className="btn-content"><IconCover className="btn-icon" /></span>
                    </button>
                    <button
                      className="ghost-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectResult(result.id);
                        onApplyAndSaveOnlineResult(result);
                      }}
                      disabled={!canSearch}
                      title="Apply & save"
                      aria-label="Apply & save"
                    >
                      <span className="btn-content"><IconSave className="btn-icon" /></span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </article>
        ))}
        {!sortedOnlineResults.length && <p className="muted">No results. Start an online search.</p>}
      </div>
    </Card>
  );
}
