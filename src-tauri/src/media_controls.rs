//! System media controls on macOS: the keyboard's play/pause, next and previous keys, AirPods, the Touch Bar and
//! Control Center reach the app through `MPRemoteCommandCenter`, and the current track shows in Now Playing.
//!
//! The webview cannot do this on its own: our audio runs through the Web Audio graph (EQ, normalisation), and
//! WebKit then does not treat the page as the one playing. No permission is needed for this API.
//! Commands are forwarded to the frontend as `media-control` events; the frontend keeps Now Playing up to date
//! with `update_now_playing`.

use serde::{Deserialize, Serialize};

/// What the system asked for, sent to the frontend.
#[derive(Clone, Serialize)]
pub struct MediaControlEvent {
    pub action: &'static str,
    /// Seconds, for `seek`.
    pub position: Option<f64>,
}

/// The current track as the frontend sees it.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NowPlaying {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration: f64,
    pub position: f64,
    pub playing: bool,
}

#[cfg(target_os = "macos")]
mod platform {
    use super::{MediaControlEvent, NowPlaying};
    use block2::RcBlock;
    use objc2::rc::Retained;
    use objc2::runtime::AnyObject;
    use objc2_foundation::{NSDictionary, NSNumber, NSString};
    use objc2_media_player::{
        MPChangePlaybackPositionCommandEvent, MPMediaItemPropertyAlbumTitle, MPMediaItemPropertyArtist,
        MPMediaItemPropertyPlaybackDuration, MPMediaItemPropertyTitle, MPNowPlayingInfoCenter,
        MPNowPlayingInfoPropertyElapsedPlaybackTime, MPNowPlayingInfoPropertyPlaybackRate, MPNowPlayingPlaybackState,
        MPRemoteCommand, MPRemoteCommandCenter, MPRemoteCommandEvent, MPRemoteCommandHandlerStatus,
    };
    use std::ptr::NonNull;
    use tauri::{AppHandle, Emitter};

    fn bind(app: &AppHandle, command: &MPRemoteCommand, action: &'static str) {
        let app = app.clone();
        let handler = RcBlock::new(move |event: NonNull<MPRemoteCommandEvent>| {
            let position = if action == "seek" {
                // The position command sends its own event subclass with the target time.
                let event = event.cast::<MPChangePlaybackPositionCommandEvent>();
                Some(unsafe { event.as_ref().positionTime() })
            } else {
                None
            };
            let _ = app.emit("media-control", MediaControlEvent { action, position });
            MPRemoteCommandHandlerStatus::Success
        });
        unsafe {
            command.setEnabled(true);
            // The returned target must stay registered for the life of the app.
            std::mem::forget(command.addTargetWithHandler(&handler));
        }
    }

    pub fn install(app: &AppHandle) {
        let center = unsafe { MPRemoteCommandCenter::sharedCommandCenter() };
        unsafe {
            bind(app, &center.playCommand(), "play");
            bind(app, &center.pauseCommand(), "pause");
            bind(app, &center.togglePlayPauseCommand(), "toggle");
            bind(app, &center.stopCommand(), "pause");
            bind(app, &center.nextTrackCommand(), "next");
            bind(app, &center.previousTrackCommand(), "previous");
            bind(app, &center.changePlaybackPositionCommand(), "seek");
        }
    }

    fn object<T: objc2::Message>(value: Retained<T>) -> Retained<AnyObject> {
        // Every Objective-C object is an AnyObject; the dictionary only needs that.
        unsafe { Retained::cast_unchecked(value) }
    }

    pub fn update(info: &NowPlaying) {
        let center = unsafe { MPNowPlayingInfoCenter::defaultCenter() };
        let keys: [&NSString; 6] = unsafe {
            [
                MPMediaItemPropertyTitle,
                MPMediaItemPropertyArtist,
                MPMediaItemPropertyAlbumTitle,
                MPMediaItemPropertyPlaybackDuration,
                MPNowPlayingInfoPropertyElapsedPlaybackTime,
                MPNowPlayingInfoPropertyPlaybackRate,
            ]
        };
        let values = [
            object(NSString::from_str(&info.title)),
            object(NSString::from_str(&info.artist)),
            object(NSString::from_str(&info.album)),
            object(NSNumber::new_f64(info.duration.max(0.0))),
            object(NSNumber::new_f64(info.position.max(0.0))),
            object(NSNumber::new_f64(if info.playing { 1.0 } else { 0.0 })),
        ];
        let dictionary = NSDictionary::<NSString, AnyObject>::from_retained_objects(&keys, &values);
        unsafe {
            center.setNowPlayingInfo(Some(&dictionary));
            center.setPlaybackState(if info.playing { MPNowPlayingPlaybackState::Playing } else { MPNowPlayingPlaybackState::Paused });
        }
    }

    pub fn clear() {
        let center = unsafe { MPNowPlayingInfoCenter::defaultCenter() };
        unsafe {
            center.setNowPlayingInfo(None);
            center.setPlaybackState(MPNowPlayingPlaybackState::Stopped);
        }
    }
}

/// Registers the system media commands (macOS; elsewhere the webview's Media Session does it).
pub fn install(_app: &tauri::AppHandle) {
    #[cfg(target_os = "macos")]
    platform::install(_app);
}

/// Shows the current track in the system's Now Playing (macOS); `None` clears it.
#[tauri::command]
pub fn update_now_playing(app: tauri::AppHandle, info: Option<NowPlaying>) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        // AppKit-side APIs: run them on the main thread.
        app.run_on_main_thread(move || match info {
            Some(info) => platform::update(&info),
            None => platform::clear(),
        })
        .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, info);
    }
    Ok(())
}
