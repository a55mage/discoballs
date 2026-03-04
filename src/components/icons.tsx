import type { SVGProps } from "react";

function IconBase(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props} />
  );
}

export const IconInfo = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="10" x2="12" y2="16" />
    <circle cx="12" cy="7" r="1" fill="currentColor" stroke="none" />
  </IconBase>
);

export const IconFolder = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <path d="M3 7h6l2 2h10v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </IconBase>
);

export const IconMusicNote = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <path d="M9 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
    <path d="M16 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
    <path d="M11 17V7l7-2v8" />
  </IconBase>
);

export const IconSortTitle = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <line x1="5" y1="7" x2="19" y2="7" />
    <line x1="5" y1="12" x2="16" y2="12" />
    <line x1="5" y1="17" x2="13" y2="17" />
  </IconBase>
);

export const IconSortArtist = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <circle cx="12" cy="8" r="3" />
    <path d="M6 19a6 6 0 0 1 12 0" />
  </IconBase>
);

export const IconSortAdded = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="8" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="12" x2="15" y2="14" />
  </IconBase>
);

export const IconSortRelease = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <rect x="4" y="6" width="16" height="14" rx="2" />
    <line x1="8" y1="4" x2="8" y2="8" />
    <line x1="16" y1="4" x2="16" y2="8" />
    <line x1="4" y1="10" x2="20" y2="10" />
  </IconBase>
);

export const IconSave = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <path d="M5 4h11l3 3v13H5z" />
    <path d="M8 4v5h8V4" />
    <rect x="8" y="13" width="8" height="6" />
  </IconBase>
);

export const IconSaveRename = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <path d="M4 4h10l3 3v4" />
    <path d="M7 4v5h6V4" />
    <rect x="7" y="13" width="5" height="4" />
    <line x1="15" y1="11" x2="21" y2="17" />
    <path d="M14 20h3l6-6-3-3-6 6z" />
    <line x1="12" y1="15" x2="18" y2="15" />
    <line x1="15" y1="12" x2="15" y2="18" />
  </IconBase>
);

export const IconRename = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <path d="M4 20h4l10-10-4-4L4 16z" />
    <path d="M13 7l4 4" />
  </IconBase>
);

export const IconSettings = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
    <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
    <circle cx="11" cy="18" r="2" fill="currentColor" stroke="none" />
  </IconBase>
);

export const IconSearch = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <circle cx="11" cy="11" r="6" />
    <line x1="16" y1="16" x2="21" y2="21" />
  </IconBase>
);

export const IconCover = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <rect x="3.5" y="5" width="17" height="14" rx="2" />
    <circle cx="9" cy="10" r="1.5" fill="currentColor" stroke="none" />
    <polyline points="6 16 11 12 14 14 18 10 20.5 12.5" />
  </IconBase>
);

export const IconCheck = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <polyline points="5 12 10 17 19 8" />
  </IconBase>
);

export const IconClose = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </IconBase>
);

export const IconPlus = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </IconBase>
);

export const IconTrash = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M8 6v-1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1" />
    <path d="M19 6l-1 14H6L5 6" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </IconBase>
);

export const IconArrowUp = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <polyline points="6 14 12 8 18 14" />
  </IconBase>
);

export const IconArrowDown = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <polyline points="6 10 12 16 18 10" />
  </IconBase>
);

export const IconPlay = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <polygon points="8 6 18 12 8 18" fill="currentColor" stroke="none" />
  </IconBase>
);

export const IconPause = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <rect x="7" y="6" width="4" height="12" fill="currentColor" stroke="none" />
    <rect x="13" y="6" width="4" height="12" fill="currentColor" stroke="none" />
  </IconBase>
);

export const IconPrev = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <line x1="7" y1="6" x2="7" y2="18" />
    <polygon points="17 6 9 12 17 18" fill="currentColor" stroke="none" />
  </IconBase>
);

export const IconNext = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <line x1="17" y1="6" x2="17" y2="18" />
    <polygon points="7 6 15 12 7 18" fill="currentColor" stroke="none" />
  </IconBase>
);

export const IconVolume = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <polygon points="4 10 8 10 12 6 12 18 8 14 4 14" />
    <path d="M15 9a4 4 0 0 1 0 6" />
    <path d="M17.5 7a7 7 0 0 1 0 10" />
  </IconBase>
);

export const IconMute = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <polygon points="4 10 8 10 12 6 12 18 8 14 4 14" />
    <line x1="16" y1="9" x2="21" y2="15" />
    <line x1="21" y1="9" x2="16" y2="15" />
  </IconBase>
);

export const IconGrid = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <rect x="4" y="4" width="6" height="6" />
    <rect x="14" y="4" width="6" height="6" />
    <rect x="4" y="14" width="6" height="6" />
    <rect x="14" y="14" width="6" height="6" />
  </IconBase>
);

export const IconListCompact = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <line x1="6" y1="7" x2="20" y2="7" />
    <line x1="6" y1="12" x2="20" y2="12" />
    <line x1="6" y1="17" x2="20" y2="17" />
    <circle cx="3" cy="7" r="1" fill="currentColor" stroke="none" />
    <circle cx="3" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="3" cy="17" r="1" fill="currentColor" stroke="none" />
  </IconBase>
);

export const IconSun = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2" x2="12" y2="5" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="2" y1="12" x2="5" y2="12" />
    <line x1="19" y1="12" x2="22" y2="12" />
    <line x1="4.9" y1="4.9" x2="7" y2="7" />
    <line x1="17" y1="17" x2="19.1" y2="19.1" />
    <line x1="17" y1="7" x2="19.1" y2="4.9" />
    <line x1="4.9" y1="19.1" x2="7" y2="17" />
  </IconBase>
);

export const IconMoon = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <path d="M21 12.4A8.5 8.5 0 1 1 11.6 3a7 7 0 0 0 9.4 9.4z" />
  </IconBase>
);

export const IconGlobe = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a14 14 0 0 1 0 18" />
    <path d="M12 3a14 14 0 0 0 0 18" />
  </IconBase>
);

export const IconUser = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </IconBase>
);

export const IconHeart = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <path d="M12 20s-7-4.6-9.2-9A5.3 5.3 0 0 1 12 5.6 5.3 5.3 0 0 1 21.2 11C19 15.4 12 20 12 20z" />
  </IconBase>
);

export const IconExternalLink = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <path d="M14 4h6v6" />
    <path d="M10 14 20 4" />
    <path d="M20 13v6H4V3h6" />
  </IconBase>
);

export const IconShuffle = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <path d="M4 7h4l9 10h3" />
    <path d="M4 17h4l3-3" />
    <path d="M17 7h3" />
    <polyline points="18 5 20 7 18 9" />
    <polyline points="18 15 20 17 18 19" />
  </IconBase>
);

export const IconRepeatOne = (props: SVGProps<SVGSVGElement>) => (
  <IconBase {...props}>
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    <line x1="12" y1="10" x2="12" y2="16" />
  </IconBase>
);
