/**
 * The single <audio> element of the app. It is created once by the player UI and read by playback
 * actions and effects, so it lives outside React state.
 */
export const audioRef: { current: HTMLAudioElement | null } = { current: null };
