use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use lofty::config::WriteOptions;
use lofty::file::{AudioFile, FileType, TaggedFileExt};
use lofty::picture::{MimeType, Picture, PictureType};
use lofty::prelude::Accessor;
use lofty::probe::Probe;
use lofty::tag::{ItemKey, Tag, TagExt, TagType};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;
use tauri::Manager;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Track {
    id: String,
    path: String,
    title: String,
    artist: String,
    album: String,
    tracknumber: String,
    year: String,
    genre: String,
    has_cover: bool,
    cover_data_url: Option<String>,
    navidrome_source: Option<NavidromeTrackSource>,
    /// When the track entered the library, in milliseconds since the Unix epoch.
    added_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct NavidromeTrackSource {
    base_url: String,
    username: String,
    password: String,
    song_id: String,
    cover_art_id: Option<String>,
    suffix: Option<String>,
    content_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ScanResult {
    folder_path: String,
    tracks: Vec<Track>,
}

#[derive(Debug, Serialize, Deserialize)]
struct OnlineQuery {
    title: String,
    artist: String,
    album: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct OnlineMatch {
    id: String,
    title: String,
    artist: String,
    album: String,
    date: String,
    source: String,
    tracknumber: Option<String>,
    cover_data_url: Option<String>,
    release_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct AlbumQuery {
    artist: String,
    album: String,
}

/// A release found on MusicBrainz, without its track list.
#[derive(Debug, Serialize, Deserialize, PartialEq)]
struct AlbumSummary {
    id: String,
    title: String,
    artist: String,
    date: String,
    country: Option<String>,
    label: Option<String>,
    disambiguation: Option<String>,
    track_count: u32,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
struct AlbumTrackInfo {
    title: String,
    artist: String,
    /// Position inside its disc, as text ("1", "A1"…).
    number: String,
    disc: u32,
    length_ms: Option<u64>,
}

/// A release with its full track list and front cover.
#[derive(Debug, Serialize, Deserialize)]
struct AlbumRelease {
    id: String,
    title: String,
    artist: String,
    date: String,
    tracks: Vec<AlbumTrackInfo>,
    cover_data_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SaveTrackInput {
    path: String,
    title: String,
    artist: String,
    album: String,
    tracknumber: String,
    year: String,
    genre: String,
    cover_data_url: Option<String>,
    #[serde(default)]
    remove_cover: bool,
    rename_fields: Option<Vec<String>>,
    rename_separator: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SaveTrackOutput {
    path: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct TrackTechnicalInfo {
    format: String,
    bitrate_kbps: Option<u32>,
    duration_seconds: Option<f64>,
    sample_rate_hz: Option<u32>,
    file_size_bytes: Option<u64>,
    channels: Option<u8>,
    bit_depth: Option<u8>,
    /// ReplayGain track gain in dB, when the file carries the tag.
    replaygain_track_db: Option<f64>,
    /// ReplayGain album gain in dB, when the file carries the tag.
    replaygain_album_db: Option<f64>,
}

/// Reads a ReplayGain value such as "-6.50 dB", "+3.2dB" or "-4,1 dB". Anything else gives None.
fn parse_replaygain(value: &str) -> Option<f64> {
    let cleaned = value
        .trim()
        .trim_end_matches(|c: char| c.is_alphabetic() || c.is_whitespace())
        .replace(',', ".");
    let parsed = cleaned.trim().parse::<f64>().ok()?;
    if parsed.is_finite() && parsed.abs() <= 60.0 {
        Some(parsed)
    } else {
        None
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct NavidromeConnectInput {
    base_url: String,
    username: String,
    password: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct NavidromeConnectResult {
    ok: bool,
    server_version: Option<String>,
    api_version: Option<String>,
    message: Option<String>,
}

#[tauri::command]
fn pick_music_folder() -> Option<String> {
    rfd::FileDialog::new()
        .set_title("Select music folder")
        .pick_folder()
        .map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
fn scan_folder(path: String) -> Result<ScanResult, String> {
    let root = PathBuf::from(&path);
    if !root.exists() {
        return Err(format!("Folder not found: {path}"));
    }

    let mut tracks = Vec::new();
    for entry in WalkDir::new(&root).into_iter().filter_map(Result::ok) {
        if !entry.file_type().is_file() {
            continue;
        }

        let p = entry.path();
        if !is_supported_audio_path(p) {
            continue;
        }

        tracks.push(read_track(p));
    }

    tracks.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(ScanResult {
        folder_path: path,
        tracks,
    })
}

#[tauri::command]
async fn search_online(query: OnlineQuery) -> Result<Vec<OnlineMatch>, String> {
    if query.title.trim().is_empty() && query.artist.trim().is_empty() && query.album.trim().is_empty() {
        return Ok(Vec::new());
    }

    let client = Client::builder()
        .user_agent("discoballs/1.5.0 (desktop app)")
        .build()
        .map_err(|e| e.to_string())?;

    let mb_task = search_musicbrainz(&client, &query);
    let itunes_task = search_itunes(&client, &query);
    let (mb_results, itunes_results) = tokio::join!(mb_task, itunes_task);

    let mut merged = Vec::new();
    if let Ok(mut m) = mb_results {
        merged.append(&mut m);
    }
    if let Ok(mut i) = itunes_results {
        merged.append(&mut i);
    }

    let mut dedup = Vec::new();
    let mut seen = HashSet::new();
    for result in merged {
        let key = format!(
            "{}|{}|{}|{}",
            result.title.to_lowercase(),
            result.artist.to_lowercase(),
            result.album.to_lowercase(),
            result.date
        );
        if seen.insert(key) {
            dedup.push(result);
        }
    }

    Ok(dedup)
}

#[tauri::command]
async fn navidrome_ping(input: NavidromeConnectInput) -> Result<NavidromeConnectResult, String> {
    let base_url = normalize_navidrome_base_url(&input.base_url)?;
    let username = input.username.trim();
    if username.is_empty() {
        return Err("Navidrome username is required".to_string());
    }
    if input.password.is_empty() {
        return Err("Navidrome password is required".to_string());
    }

    let client = Client::builder()
        .user_agent("discoballs/1.5.0 (desktop app)")
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|e| e.to_string())?;
    let request = client.get(format!("{base_url}/rest/ping.view")).query(&[
        ("u", username.to_string()),
        ("p", format!("enc:{}", hex_encode(&input.password))),
        ("v", "1.16.1".to_string()),
        ("c", "DiscoBalls".to_string()),
        ("f", "json".to_string()),
    ]);
    let response = send_with_connect_retry(request)
        .await
        .map_err(|e| format!("Navidrome connection failed: {}", describe_request_error(&e)))?;

    if !response.status().is_success() {
        return Err(format!("Navidrome returned HTTP {}", response.status()));
    }

    let payload = response
        .json::<Value>()
        .await
        .map_err(|e| format!("Invalid Navidrome response: {e}"))?;
    let subsonic_response = payload
        .get("subsonic-response")
        .and_then(Value::as_object)
        .ok_or_else(|| "Invalid Navidrome response: missing subsonic-response".to_string())?;
    let status = subsonic_response
        .get("status")
        .and_then(Value::as_str)
        .unwrap_or("");
    let api_version = subsonic_response
        .get("version")
        .and_then(Value::as_str)
        .map(str::to_string);
    let server_version = subsonic_response
        .get("serverVersion")
        .and_then(Value::as_str)
        .map(str::to_string);

    if status == "ok" {
        return Ok(NavidromeConnectResult {
            ok: true,
            server_version,
            api_version,
            message: Some("Connected to Navidrome".to_string()),
        });
    }

    let message = subsonic_response
        .get("error")
        .and_then(|error| error.get("message"))
        .and_then(Value::as_str)
        .unwrap_or("Navidrome rejected the connection")
        .to_string();

    Ok(NavidromeConnectResult {
        ok: false,
        server_version,
        api_version,
        message: Some(message),
    })
}

#[tauri::command]
async fn navidrome_scan_library(input: NavidromeConnectInput) -> Result<ScanResult, String> {
    let base_url = normalize_navidrome_base_url(&input.base_url)?;
    let username = input.username.trim();
    if username.is_empty() {
        return Err("Navidrome username is required".to_string());
    }
    if input.password.is_empty() {
        return Err("Navidrome password is required".to_string());
    }

    let client = Client::builder()
        .user_agent("discoballs/1.5.0 (desktop app)")
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let mut album_ids = Vec::new();
    let mut offset = 0usize;
    let page_size = 500usize;
    loop {
        let response = navidrome_get(
            &client,
            &base_url,
            username,
            &input.password,
            "getAlbumList2",
            vec![
                ("type".to_string(), "alphabeticalByArtist".to_string()),
                ("size".to_string(), page_size.to_string()),
                ("offset".to_string(), offset.to_string()),
            ],
        )
        .await?;
        let albums = response
            .get("albumList2")
            .and_then(|album_list| album_list.get("album"))
            .map(json_items)
            .unwrap_or_default();
        let count = albums.len();
        for album in albums {
            if let Some(id) = json_text(album, "id") {
                album_ids.push(id);
            }
        }
        if count < page_size {
            break;
        }
        offset += count;
    }

    let mut tracks = Vec::new();
    let mut seen = HashSet::new();
    let server_label = sanitize_virtual_path_part(&base_url, "Server");
    for album_chunk in album_ids.chunks(16) {
        let mut tasks = Vec::new();
        for album_id in album_chunk {
            let client = client.clone();
            let base_url = base_url.clone();
            let username = username.to_string();
            let password = input.password.clone();
            let server_label = server_label.clone();
            let album_id = album_id.clone();
            tasks.push(tokio::spawn(async move {
                let response = navidrome_get(
                    &client,
                    &base_url,
                    &username,
                    &password,
                    "getAlbum",
                    vec![("id".to_string(), album_id)],
                )
                .await?;
                let mut album_tracks = Vec::new();
                let Some(album) = response.get("album") else {
                    return Ok::<Vec<Track>, String>(album_tracks);
                };
                for song in album.get("song").map(json_items).unwrap_or_default() {
                    if let Some(track) = navidrome_song_to_track(song, &base_url, &username, &password, &server_label) {
                        album_tracks.push(track);
                    }
                }
                Ok::<Vec<Track>, String>(album_tracks)
            }));
        }

        for task in tasks {
            let album_tracks = task.await.map_err(|e| format!("Navidrome album task failed: {e}"))??;
            for track in album_tracks {
                if seen.insert(track.id.clone()) {
                    tracks.push(track);
                }
            }
        }
    }

    tracks.sort_by(|a, b| {
        a.artist
            .to_lowercase()
            .cmp(&b.artist.to_lowercase())
            .then_with(|| a.album.to_lowercase().cmp(&b.album.to_lowercase()))
            .then_with(|| a.tracknumber.cmp(&b.tracknumber))
            .then_with(|| a.title.to_lowercase().cmp(&b.title.to_lowercase()))
    });

    Ok(ScanResult {
        folder_path: format!("Navidrome/{server_label}"),
        tracks,
    })
}

#[tauri::command]
fn save_track(input: SaveTrackInput) -> Result<SaveTrackOutput, String> {
    let original_path = PathBuf::from(&input.path);
    if !original_path.exists() {
        return Err(format!("File not found: {}", input.path));
    }

    write_metadata_and_cover(&original_path, &input)?;

    let renamed_path = maybe_rename_path(&original_path, &input)?;
    Ok(SaveTrackOutput {
        path: renamed_path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
fn rename_track(input: SaveTrackInput) -> Result<SaveTrackOutput, String> {
    let original_path = PathBuf::from(&input.path);
    if !original_path.exists() {
        return Err(format!("File not found: {}", input.path));
    }

    let renamed_path = maybe_rename_path(&original_path, &input)?;
    Ok(SaveTrackOutput {
        path: renamed_path.to_string_lossy().to_string(),
    })
}

/// A file name must stay inside the folder of the file it renames.
fn validate_file_name(name: &str) -> Result<(), String> {
    let trimmed = name.trim();
    if trimmed.is_empty() || trimmed == "." || trimmed == ".." {
        return Err("The file name is empty".to_string());
    }
    if trimmed.len() > 255 || trimmed.contains(['/', '\\', '\0']) {
        return Err("The file name is not valid".to_string());
    }
    Ok(())
}

/// Renames a file inside its own folder (used to restore a name after an undo).
#[tauri::command]
fn rename_file(path: String, file_name: String) -> Result<SaveTrackOutput, String> {
    let original = PathBuf::from(&path);
    if !original.exists() {
        return Err(format!("File not found: {path}"));
    }
    validate_file_name(&file_name)?;
    let target = original.with_file_name(file_name.trim());
    if target == original {
        return Ok(SaveTrackOutput { path });
    }
    if target.exists() {
        return Err(format!("A file named {} already exists", file_name.trim()));
    }
    fs::rename(&original, &target).map_err(|e| format!("File rename error: {e}"))?;
    Ok(SaveTrackOutput {
        path: target.to_string_lossy().to_string(),
    })
}

#[tauri::command]
fn get_audio_data_url(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| format!("Audio read error: {e}"))?;
    let mime = mime_from_audio_path(&path);
    Ok(format!("data:{};base64,{}", mime, BASE64.encode(bytes)))
}

#[tauri::command]
async fn navidrome_get_audio_data_url(source: NavidromeTrackSource) -> Result<String, String> {
    let base_url = normalize_navidrome_base_url(&source.base_url)?;
    let client = Client::builder()
        .user_agent("discoballs/1.5.0 (desktop app)")
        .timeout(Duration::from_secs(45))
        .build()
        .map_err(|e| e.to_string())?;
    let (bytes, response_mime) = navidrome_get_bytes(
        &client,
        &base_url,
        &source.username,
        &source.password,
        "stream",
        vec![
            ("id".to_string(), source.song_id.clone()),
            ("format".to_string(), "mp3".to_string()),
            ("maxBitRate".to_string(), "320".to_string()),
        ],
    )
    .await?;
    let mime = response_mime
        .or(source.content_type)
        .unwrap_or_else(|| "audio/mpeg".to_string());
    Ok(format!("data:{};base64,{}", mime, BASE64.encode(bytes)))
}

#[tauri::command]
async fn navidrome_get_cover_data_url(source: NavidromeTrackSource) -> Result<Option<String>, String> {
    let Some(cover_art_id) = source.cover_art_id.clone() else {
        return Ok(None);
    };
    let base_url = normalize_navidrome_base_url(&source.base_url)?;
    let client = Client::builder()
        .user_agent("discoballs/1.5.0 (desktop app)")
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;
    let (bytes, response_mime) = navidrome_get_bytes(
        &client,
        &base_url,
        &source.username,
        &source.password,
        "getCoverArt",
        vec![
            ("id".to_string(), cover_art_id),
            ("size".to_string(), "300".to_string()),
        ],
    )
    .await?;
    let mime = response_mime.unwrap_or_else(|| "image/jpeg".to_string());
    Ok(Some(format!("data:{};base64,{}", mime, BASE64.encode(bytes))))
}

#[tauri::command]
fn get_track_technical_info(path: String) -> Result<TrackTechnicalInfo, String> {
    let audio_path = PathBuf::from(&path);
    if !audio_path.exists() {
        return Err(format!("File not found: {path}"));
    }

    let format = audio_path
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_uppercase())
        .unwrap_or_else(|| "N/A".to_string());

    let file_size_bytes = fs::metadata(&audio_path).ok().map(|m| m.len());

    let mut bitrate_kbps = None;
    let mut duration_seconds = None;
    let mut sample_rate_hz = None;
    let mut channels = None;
    let mut bit_depth = None;
    let mut replaygain_track_db = None;
    let mut replaygain_album_db = None;

    if let Ok(tagged_file) = Probe::open(&audio_path).and_then(|p| p.read()) {
        if let Some(tag) = tagged_file.primary_tag().or_else(|| tagged_file.first_tag()) {
            replaygain_track_db = tag
                .get_string(&ItemKey::ReplayGainTrackGain)
                .and_then(parse_replaygain);
            replaygain_album_db = tag
                .get_string(&ItemKey::ReplayGainAlbumGain)
                .and_then(parse_replaygain);
        }
        let properties = tagged_file.properties();
        bitrate_kbps = properties.audio_bitrate().or(properties.overall_bitrate());
        let seconds = properties.duration().as_secs_f64();
        if seconds > 0.0 {
            duration_seconds = Some(seconds);
        }
        sample_rate_hz = properties.sample_rate();
        channels = properties.channels();
        bit_depth = properties.bit_depth();
    }

    Ok(TrackTechnicalInfo {
        format,
        bitrate_kbps,
        duration_seconds,
        sample_rate_hz,
        file_size_bytes,
        channels,
        bit_depth,
        replaygain_track_db,
        replaygain_album_db,
    })
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    let url = url.trim();
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("Only http/https URLs are allowed".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("Unable to open browser: {e}"))?;
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", url])
            .spawn()
            .map_err(|e| format!("Unable to open browser: {e}"))?;
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("Unable to open browser: {e}"))?;
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("Unsupported platform".to_string())
}

#[tauri::command]
fn open_track_in_file_manager(path: String) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Path is empty".to_string());
    }

    let track_path = PathBuf::from(trimmed);
    let folder_path = if track_path.is_dir() {
        track_path
    } else {
        track_path
            .parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| format!("Cannot resolve parent folder for: {trimmed}"))?
    };

    if !folder_path.exists() {
        return Err(format!(
            "Folder not found: {}",
            folder_path.to_string_lossy()
        ));
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&folder_path)
            .spawn()
            .map_err(|e| format!("Unable to open folder: {e}"))?;
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(folder_path.to_string_lossy().to_string())
            .spawn()
            .map_err(|e| format!("Unable to open folder: {e}"))?;
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&folder_path)
            .spawn()
            .map_err(|e| format!("Unable to open folder: {e}"))?;
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("Unsupported platform".to_string())
}

fn is_supported_audio_path(path: &Path) -> bool {
    let file_name = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or_default()
        .to_lowercase();
    if file_name.ends_with(".cover") || file_name.contains(".cover.") {
        return false;
    }

    let lower = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or_default()
        .to_lowercase();
    matches!(lower.as_str(), "mp3" | "flac" | "m4a" | "ogg" | "wav")
}

fn read_track(path: &Path) -> Track {
    let default_title = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or_default()
        .to_string();

    let mut title = default_title;
    let mut artist = String::new();
    let mut album = String::new();
    let mut tracknumber = String::new();
    let mut year = String::new();
    let mut genre = String::new();
    let mut cover_data_url = None;

    if let Ok(tagged_file) = Probe::open(path).and_then(|p| p.read()) {
        if let Some(tag) = tagged_file.primary_tag().or_else(|| tagged_file.first_tag()) {
            if let Some(v) = tag.title() {
                if !v.trim().is_empty() {
                    title = v.to_string();
                }
            }
            if let Some(v) = tag.artist() {
                artist = v.to_string();
            }
            if let Some(v) = tag.album() {
                album = v.to_string();
            }
            if let Some(v) = tag.track() {
                tracknumber = v.to_string();
            }
            if let Some(v) = tag.year() {
                year = v.to_string();
            }
            if let Some(v) = tag.genre() {
                genre = v.to_string();
            }

            if let Some(pic) = tag.pictures().first() {
                let mime = mime_type_to_str(pic.mime_type());
                cover_data_url = encode_data_url(pic.data(), mime);
            }
        }
    }

    Track {
        id: path.to_string_lossy().to_string(),
        path: path.to_string_lossy().to_string(),
        title,
        artist,
        album,
        tracknumber,
        year: year.chars().take(4).collect(),
        genre,
        has_cover: cover_data_url.is_some(),
        cover_data_url,
        navidrome_source: None,
        added_at: file_added_at(path),
    }
}

/// The file's creation time, or its last modification where the file system has no creation time.
fn file_added_at(path: &Path) -> Option<i64> {
    let metadata = fs::metadata(path).ok()?;
    let time = metadata.created().or_else(|_| metadata.modified()).ok()?;
    let millis = time.duration_since(std::time::UNIX_EPOCH).ok()?.as_millis();
    i64::try_from(millis).ok()
}

/// Reads the ISO 8601 timestamps of the Subsonic API ("2023-04-01T10:20:30.123Z", offsets allowed).
fn parse_iso_timestamp_millis(value: &str) -> Option<i64> {
    let value = value.trim();
    let number = |range: std::ops::Range<usize>| value.get(range)?.parse::<i64>().ok();
    let (year, month, day) = (number(0..4)?, number(5..7)?, number(8..10)?);
    if value.get(4..5)? != "-" || value.get(7..8)? != "-" || !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        return None;
    }
    let (mut hour, mut minute, mut second, mut millis) = (0, 0, 0, 0);
    let mut rest = value.get(10..).unwrap_or_default();
    if rest.starts_with('T') || rest.starts_with(' ') {
        hour = rest.get(1..3)?.parse::<i64>().ok()?;
        minute = rest.get(4..6)?.parse::<i64>().ok()?;
        second = rest.get(7..9)?.parse::<i64>().ok()?;
        rest = rest.get(9..).unwrap_or_default();
        if let Some(fraction) = rest.strip_prefix('.') {
            let digits: String = fraction.chars().take_while(char::is_ascii_digit).collect();
            millis = format!("{digits:0<3}").get(0..3)?.parse::<i64>().ok()?;
            rest = &fraction[digits.len()..];
        }
    }
    let offset_minutes = match rest {
        "" | "Z" => 0,
        _ => {
            let sign = match rest.get(0..1)? {
                "+" => 1,
                "-" => -1,
                _ => return None,
            };
            let digits = rest[1..].replace(':', "");
            sign * (digits.get(0..2)?.parse::<i64>().ok()? * 60 + digits.get(2..4).unwrap_or("0").parse::<i64>().ok()?)
        }
    };
    // Days from 1970-01-01 to the civil date (Howard Hinnant's algorithm).
    let shifted_year = if month <= 2 { year - 1 } else { year };
    let era = shifted_year.div_euclid(400);
    let year_of_era = shifted_year - era * 400;
    let day_of_year = (153 * ((month + 9) % 12) + 2) / 5 + day - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    let days = era * 146_097 + day_of_era - 719_468;
    let seconds = days * 86_400 + hour * 3_600 + minute * 60 + second - offset_minutes * 60;
    Some(seconds * 1_000 + millis)
}

fn write_metadata_and_cover(path: &Path, input: &SaveTrackInput) -> Result<(), String> {
    let tag_type = primary_tag_type_for_path(path)?;

    let mut tag = match Probe::open(path).and_then(|p| p.read()) {
        Ok(tagged_file) => tagged_file
            .primary_tag()
            .cloned()
            .unwrap_or_else(|| Tag::new(tag_type)),
        Err(_) => {
            // Some files contain malformed/truncated metadata blocks (e.g. broken ID3v2 frames).
            // In that case, start from a clean tag so users can still save updated fields.
            Tag::new(tag_type)
        }
    };

    tag.set_title(input.title.clone());
    tag.set_artist(input.artist.clone());
    tag.set_album(input.album.clone());
    tag.set_genre(input.genre.clone());

    if let Some(track_no) = parse_u32_prefix(&input.tracknumber) {
        tag.set_track(track_no);
    }
    if let Some(year) = parse_u32_year(&input.year) {
        tag.set_year(year);
    }

    if let Some(cover_data_url) = input.cover_data_url.as_ref().filter(|v| !v.trim().is_empty()) {
        let (bytes, mime) = parse_data_url(cover_data_url)?;
        let picture = Picture::new_unchecked(PictureType::CoverFront, Some(mime), None, bytes);
        tag.remove_picture_type(PictureType::CoverFront);
        tag.push_picture(picture);
    } else if input.remove_cover {
        tag.remove_picture_type(PictureType::CoverFront);
    }

    tag.save_to_path(path, WriteOptions::default())
        .map_err(|e| format!("Metadata save error: {e}"))
}

fn maybe_rename_path(path: &Path, input: &SaveTrackInput) -> Result<PathBuf, String> {
    let rename_fields = input.rename_fields.clone().unwrap_or_default();
    if rename_fields.is_empty() {
        return Ok(path.to_path_buf());
    }

    let separator = input
        .rename_separator
        .clone()
        .unwrap_or_else(|| " - ".to_string());
    let separator = if separator.is_empty() {
        " - ".to_string()
    } else {
        separator
    };

    let parts = rename_fields
        .iter()
        .map(|field| rename_field_value(field, input))
        .map(sanitize_filename_part)
        .filter(|v| !v.is_empty())
        .collect::<Vec<_>>();

    if parts.is_empty() {
        return Ok(path.to_path_buf());
    }

    let filename = format!("{}{}", parts.join(&separator), path.extension().map_or(String::new(), |e| format!(".{}", e.to_string_lossy())));
    let target = path.with_file_name(filename);
    let unique_target = unique_path(target);
    if unique_target == path {
        return Ok(path.to_path_buf());
    }

    fs::rename(path, &unique_target).map_err(|e| format!("File rename error: {e}"))?;
    Ok(unique_target)
}

fn rename_field_value(field: &str, input: &SaveTrackInput) -> String {
    match field {
        "tracknumber" => input.tracknumber.clone(),
        "artist" => input.artist.clone(),
        "album" => input.album.clone(),
        "title" => input.title.clone(),
        "year" => input.year.clone(),
        "genre" => input.genre.clone(),
        _ => String::new(),
    }
}

fn unique_path(path: PathBuf) -> PathBuf {
    if !path.exists() {
        return path;
    }

    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("file")
        .to_string();
    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| format!(".{s}"))
        .unwrap_or_default();
    let parent = path.parent().unwrap_or_else(|| Path::new(".")).to_path_buf();

    for index in 1..10000 {
        let candidate = parent.join(format!("{} ({}){}", stem, index, ext));
        if !candidate.exists() {
            return candidate;
        }
    }

    path
}

fn sanitize_filename_part(value: String) -> String {
    let mut out = String::with_capacity(value.len());
    for c in value.chars() {
        if "<>:\"/\\|?*".contains(c) {
            out.push('_');
        } else if c == '\n' || c == '\r' {
            out.push(' ');
        } else {
            out.push(c);
        }
    }

    let collapsed = out.split_whitespace().collect::<Vec<_>>().join(" ");
    collapsed.trim().trim_end_matches('.').to_string()
}

fn parse_data_url(data_url: &str) -> Result<(Vec<u8>, MimeType), String> {
    if !data_url.starts_with("data:") {
        return Err("invalid cover_data_url".to_string());
    }

    let (header, encoded) = data_url
        .split_once(',')
        .ok_or_else(|| "invalid cover_data_url".to_string())?;
    if !header.contains(";base64") {
        return Err("cover_data_url must be base64".to_string());
    }

    let mime_raw = header
        .trim_start_matches("data:")
        .split(';')
        .next()
        .unwrap_or("image/jpeg")
        .trim()
        .to_lowercase();

    let mime = match mime_raw.as_str() {
        "image/png" => MimeType::Png,
        "image/gif" => MimeType::Gif,
        "image/bmp" => MimeType::Bmp,
        "image/tiff" | "image/tif" => MimeType::Tiff,
        _ => MimeType::Jpeg,
    };

    let bytes = BASE64
        .decode(encoded.as_bytes())
        .map_err(|e| format!("Invalid base64 cover: {e}"))?;

    Ok((bytes, mime))
}

fn mime_type_to_str(mime: Option<&MimeType>) -> &'static str {
    match mime {
        Some(MimeType::Png) => "image/png",
        Some(MimeType::Gif) => "image/gif",
        Some(MimeType::Bmp) => "image/bmp",
        Some(MimeType::Tiff) => "image/tiff",
        _ => "image/jpeg",
    }
}

fn parse_u32_prefix(value: &str) -> Option<u32> {
    value
        .split('/')
        .next()
        .unwrap_or(value)
        .trim()
        .parse::<u32>()
        .ok()
}

fn parse_u32_year(value: &str) -> Option<u32> {
    let year = value.trim().chars().take(4).collect::<String>();
    year.parse::<u32>().ok()
}

fn hex_encode(input: &str) -> String {
    input
        .as_bytes()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>()
}

/// Pauses before each new attempt when the server could not be reached at all.
const CONNECT_RETRY_DELAYS_MS: [u64; 2] = [400, 1200];

/// Sends a request, trying again when the connection itself fails (never on HTTP or login errors).
///
/// On recent macOS the first connection of a freshly launched app to a server on the local network can fail
/// while the system checks the Local Network permission, so the first try of every session used to fail.
async fn send_with_connect_retry(request: reqwest::RequestBuilder) -> Result<reqwest::Response, reqwest::Error> {
    let mut attempt = 0;
    loop {
        // GET requests have no streaming body, so they can always be cloned.
        let current = request.try_clone().expect("Navidrome requests are clonable GET requests");
        match current.send().await {
            Err(error) if error.is_connect() && attempt < CONNECT_RETRY_DELAYS_MS.len() => {
                tokio::time::sleep(Duration::from_millis(CONNECT_RETRY_DELAYS_MS[attempt])).await;
                attempt += 1;
            }
            result => return result,
        }
    }
}

/// The request error with its causes ("error sending request" alone does not say why).
fn describe_request_error(error: &reqwest::Error) -> String {
    let mut message = error.to_string();
    let mut source = std::error::Error::source(error);
    while let Some(cause) = source {
        message.push_str(": ");
        message.push_str(&cause.to_string());
        source = cause.source();
    }
    message
}

fn normalize_navidrome_base_url(url: &str) -> Result<String, String> {
    let trimmed = url.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err("Navidrome server URL is required".to_string());
    }
    if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
        return Err("Navidrome server URL must start with http:// or https://".to_string());
    }
    Ok(trimmed.to_string())
}

async fn navidrome_get(
    client: &Client,
    base_url: &str,
    username: &str,
    password: &str,
    endpoint: &str,
    mut params: Vec<(String, String)>,
) -> Result<Value, String> {
    params.extend([
        ("u".to_string(), username.to_string()),
        ("p".to_string(), format!("enc:{}", hex_encode(password))),
        ("v".to_string(), "1.16.1".to_string()),
        ("c".to_string(), "DiscoBalls".to_string()),
        ("f".to_string(), "json".to_string()),
    ]);
    let response = send_with_connect_retry(client.get(format!("{base_url}/rest/{endpoint}.view")).query(&params))
        .await
        .map_err(|e| format!("Navidrome request failed: {}", describe_request_error(&e)))?;

    if !response.status().is_success() {
        return Err(format!("Navidrome returned HTTP {}", response.status()));
    }

    let payload = response
        .json::<Value>()
        .await
        .map_err(|e| format!("Invalid Navidrome response: {e}"))?;
    let subsonic_response = payload
        .get("subsonic-response")
        .ok_or_else(|| "Invalid Navidrome response: missing subsonic-response".to_string())?;
    let status = subsonic_response
        .get("status")
        .and_then(Value::as_str)
        .unwrap_or("");
    if status == "ok" {
        return Ok(subsonic_response.clone());
    }

    let message = subsonic_response
        .get("error")
        .and_then(|error| error.get("message"))
        .and_then(Value::as_str)
        .unwrap_or("Navidrome rejected the request");
    Err(message.to_string())
}

async fn navidrome_get_bytes(
    client: &Client,
    base_url: &str,
    username: &str,
    password: &str,
    endpoint: &str,
    mut params: Vec<(String, String)>,
) -> Result<(Vec<u8>, Option<String>), String> {
    params.extend([
        ("u".to_string(), username.to_string()),
        ("p".to_string(), format!("enc:{}", hex_encode(password))),
        ("v".to_string(), "1.16.1".to_string()),
        ("c".to_string(), "DiscoBalls".to_string()),
    ]);
    let response = send_with_connect_retry(client.get(format!("{base_url}/rest/{endpoint}.view")).query(&params))
        .await
        .map_err(|e| format!("Navidrome media request failed: {}", describe_request_error(&e)))?;

    if !response.status().is_success() {
        return Err(format!("Navidrome returned HTTP {}", response.status()));
    }

    let mime = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(';').next())
        .map(str::trim)
        .filter(|value| !value.is_empty() && !value.contains("json"))
        .map(str::to_string);
    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Navidrome media read error: {e}"))?
        .to_vec();

    if bytes.is_empty() {
        return Err("Navidrome returned empty media data".to_string());
    }

    Ok((bytes, mime))
}

fn json_items(value: &Value) -> Vec<&Value> {
    match value {
        Value::Array(items) => items.iter().collect(),
        Value::Object(_) => vec![value],
        _ => Vec::new(),
    }
}

fn json_text(value: &Value, key: &str) -> Option<String> {
    let field = value.get(key)?;
    if let Some(text) = field.as_str() {
        let trimmed = text.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }
    if let Some(number) = field.as_u64() {
        return Some(number.to_string());
    }
    if let Some(number) = field.as_i64() {
        return Some(number.to_string());
    }
    None
}

fn sanitize_virtual_path_part(value: &str, fallback: &str) -> String {
    let sanitized = value
        .replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_")
        .trim()
        .to_string();
    if sanitized.is_empty() {
        fallback.to_string()
    } else {
        sanitized
    }
}

fn navidrome_song_to_track(
    song: &Value,
    base_url: &str,
    username: &str,
    password: &str,
    server_label: &str,
) -> Option<Track> {
    let song_id = json_text(song, "id")?;
    let title = json_text(song, "title").unwrap_or_else(|| "Untitled".to_string());
    let artist = json_text(song, "artist").unwrap_or_else(|| "Unknown artist".to_string());
    let album = json_text(song, "album").unwrap_or_else(|| "Unknown album".to_string());
    let tracknumber = json_text(song, "track").unwrap_or_default();
    let year = json_text(song, "year").unwrap_or_default();
    let genre = json_text(song, "genre").unwrap_or_default();
    let suffix = json_text(song, "suffix").unwrap_or_else(|| "mp3".to_string());
    let cover_art_id = json_text(song, "coverArt");
    let content_type = json_text(song, "contentType");
    let added_at = json_text(song, "created").and_then(|created| parse_iso_timestamp_millis(&created));
    let filename_prefix = if tracknumber.is_empty() {
        String::new()
    } else {
        format!("{tracknumber} - ")
    };
    let path = format!(
        "Navidrome/{}/{}/{}/{}{}.{}",
        server_label,
        sanitize_virtual_path_part(&artist, "Unknown artist"),
        sanitize_virtual_path_part(&album, "Unknown album"),
        filename_prefix,
        sanitize_virtual_path_part(&title, "Untitled"),
        sanitize_virtual_path_part(&suffix, "audio")
    );

    Some(Track {
        id: format!("navidrome:{base_url}:{song_id}"),
        path,
        title,
        artist,
        album,
        tracknumber,
        year,
        genre,
        has_cover: cover_art_id.is_some(),
        cover_data_url: None,
        navidrome_source: Some(NavidromeTrackSource {
            base_url: base_url.to_string(),
            username: username.to_string(),
            password: password.to_string(),
            song_id,
            cover_art_id,
            suffix: Some(suffix),
            content_type,
        }),
        added_at,
    })
}

fn primary_tag_type_for_path(path: &Path) -> Result<TagType, String> {
    let file_type = FileType::from_path(path).ok_or_else(|| {
        let ext = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or_default();
        if ext.is_empty() {
            "Unsupported format: missing file extension".to_string()
        } else {
            format!("Unsupported format: .{ext}")
        }
    })?;

    Ok(file_type.primary_tag_type())
}

fn mime_from_audio_path(path: &str) -> &'static str {
    let lower = path.to_lowercase();
    if lower.ends_with(".mp3") {
        return "audio/mpeg";
    }
    if lower.ends_with(".flac") {
        return "audio/flac";
    }
    if lower.ends_with(".wav") {
        return "audio/wav";
    }
    if lower.ends_with(".ogg") {
        return "audio/ogg";
    }
    if lower.ends_with(".m4a") {
        return "audio/mp4";
    }
    "application/octet-stream"
}

async fn fetch_cover_data_url(client: &Client, release_id: &str) -> Option<String> {
    let direct_url = format!("https://coverartarchive.org/release/{}/front-250", release_id);

    let response = client.get(direct_url).send().await.ok()?;
    if !response.status().is_success() {
        return None;
    }

    let mime = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/jpeg")
        .to_string();

    let bytes = response.bytes().await.ok()?;
    encode_data_url(bytes.as_ref(), &mime)
}

async fn fetch_cover_data_url_from_url(client: &Client, url: &str) -> Option<String> {
    let response = client.get(url).send().await.ok()?;
    if !response.status().is_success() {
        return None;
    }

    let mime = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/jpeg")
        .to_string();

    let bytes = response.bytes().await.ok()?;
    encode_data_url(bytes.as_ref(), &mime)
}

fn encode_data_url(bytes: &[u8], mime: &str) -> Option<String> {
    let encoded = BASE64.encode(bytes);
    Some(format!("data:{};base64,{}", mime, encoded))
}

fn artist_credit_name(value: &Value) -> String {
    value
        .as_array()
        .map(|credits| {
            credits
                .iter()
                .map(|credit| {
                    let name = credit
                        .get("name")
                        .and_then(|v| v.as_str())
                        .or_else(|| credit.get("artist").and_then(|a| a.get("name")).and_then(|v| v.as_str()))
                        .unwrap_or_default();
                    let join = credit.get("joinphrase").and_then(|v| v.as_str()).unwrap_or_default();
                    format!("{name}{join}")
                })
                .collect::<String>()
        })
        .unwrap_or_default()
}

/// Turns a MusicBrainz release search response into candidates.
fn parse_release_search(response: &Value) -> Vec<AlbumSummary> {
    response
        .get("releases")
        .and_then(|v| v.as_array())
        .map(|releases| {
            releases
                .iter()
                .filter_map(|release| {
                    let id = release.get("id")?.as_str()?.to_string();
                    let title = release.get("title")?.as_str()?.to_string();
                    let track_count = release
                        .get("media")
                        .and_then(|v| v.as_array())
                        .map(|media| {
                            media
                                .iter()
                                .filter_map(|m| m.get("track-count").and_then(|c| c.as_u64()))
                                .sum::<u64>()
                        })
                        .or_else(|| release.get("track-count").and_then(|c| c.as_u64()))
                        .unwrap_or(0) as u32;
                    let label = release
                        .get("label-info")
                        .and_then(|v| v.as_array())
                        .and_then(|infos| infos.iter().find_map(|i| i.get("label").and_then(|l| l.get("name")).and_then(|n| n.as_str())))
                        .map(|s| s.to_string());
                    Some(AlbumSummary {
                        id,
                        title,
                        artist: artist_credit_name(release.get("artist-credit").unwrap_or(&Value::Null)),
                        date: release.get("date").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
                        country: release.get("country").and_then(|v| v.as_str()).map(|s| s.to_string()),
                        label,
                        disambiguation: release
                            .get("disambiguation")
                            .and_then(|v| v.as_str())
                            .filter(|s| !s.is_empty())
                            .map(|s| s.to_string()),
                        track_count,
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}

/// Turns a MusicBrainz release lookup (with recordings) into a track list, discs in order.
fn parse_release_tracks(response: &Value) -> Option<AlbumRelease> {
    let id = response.get("id")?.as_str()?.to_string();
    let title = response.get("title")?.as_str()?.to_string();
    let release_artist = artist_credit_name(response.get("artist-credit").unwrap_or(&Value::Null));
    let mut tracks = Vec::new();
    for (index, medium) in response.get("media").and_then(|v| v.as_array()).cloned().unwrap_or_default().iter().enumerate() {
        let disc = medium.get("position").and_then(|v| v.as_u64()).unwrap_or(index as u64 + 1) as u32;
        for track in medium.get("tracks").and_then(|v| v.as_array()).cloned().unwrap_or_default() {
            let track_title = track
                .get("title")
                .and_then(|v| v.as_str())
                .or_else(|| track.get("recording").and_then(|r| r.get("title")).and_then(|v| v.as_str()))
                .unwrap_or_default()
                .to_string();
            if track_title.is_empty() {
                continue;
            }
            let credited = artist_credit_name(track.get("artist-credit").unwrap_or(&Value::Null));
            tracks.push(AlbumTrackInfo {
                title: track_title,
                artist: if credited.is_empty() { release_artist.clone() } else { credited },
                number: track
                    .get("number")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .or_else(|| track.get("position").and_then(|v| v.as_u64()).map(|n| n.to_string()))
                    .unwrap_or_default(),
                disc,
                length_ms: track.get("length").and_then(|v| v.as_u64()),
            });
        }
    }
    Some(AlbumRelease {
        id,
        title,
        artist: release_artist,
        date: response.get("date").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
        tracks,
        cover_data_url: None,
    })
}

fn musicbrainz_client() -> Result<Client, String> {
    Client::builder()
        .user_agent("discoballs/1.5.0 (desktop app)")
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())
}

/// Looks for releases (albums) by artist and album title.
#[tauri::command]
async fn search_albums(query: AlbumQuery) -> Result<Vec<AlbumSummary>, String> {
    let mut clauses = Vec::new();
    if !query.album.trim().is_empty() {
        clauses.push(format!("release:\"{}\"", query.album.trim().replace('"', "")));
    }
    if !query.artist.trim().is_empty() {
        clauses.push(format!("artist:\"{}\"", query.artist.trim().replace('"', "")));
    }
    if clauses.is_empty() {
        return Ok(Vec::new());
    }
    let client = musicbrainz_client()?;
    let response: Value = client
        .get("https://musicbrainz.org/ws/2/release")
        .query(&[("query", clauses.join(" AND ")), ("fmt", "json".to_string()), ("limit", "10".to_string())])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    Ok(parse_release_search(&response))
}

/// Fetches the track list and the front cover of one release.
#[tauri::command]
async fn get_album_release(release_id: String) -> Result<AlbumRelease, String> {
    if release_id.is_empty() || !release_id.chars().all(|c| c.is_ascii_hexdigit() || c == '-') {
        return Err("Invalid release id".to_string());
    }
    let client = musicbrainz_client()?;
    let response: Value = client
        .get(format!("https://musicbrainz.org/ws/2/release/{release_id}"))
        .query(&[("inc", "recordings+artist-credits"), ("fmt", "json")])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    let mut release = parse_release_tracks(&response).ok_or_else(|| "The release has no track list".to_string())?;
    release.cover_data_url = fetch_cover_data_url(&client, &release.id).await;
    Ok(release)
}

async fn search_musicbrainz(client: &Client, query: &OnlineQuery) -> Result<Vec<OnlineMatch>, String> {
    let mut clauses = Vec::new();
    if !query.title.trim().is_empty() {
        clauses.push(format!("recording:\"{}\"", query.title.trim()));
    }
    if !query.artist.trim().is_empty() {
        clauses.push(format!("artist:\"{}\"", query.artist.trim()));
    }
    if !query.album.trim().is_empty() {
        clauses.push(format!("release:\"{}\"", query.album.trim()));
    }
    if clauses.is_empty() {
        return Ok(Vec::new());
    }

    let musicbrainz_query = clauses.join(" AND ");
    let response: Value = client
        .get("https://musicbrainz.org/ws/2/recording")
        .query(&[
            ("query", musicbrainz_query),
            ("fmt", "json".to_string()),
            ("limit", "8".to_string()),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let mut out: Vec<OnlineMatch> = Vec::new();
    let recordings = response
        .get("recordings")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    for recording in recordings {
        let recording_id = recording
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        if recording_id.is_empty() {
            continue;
        }

        let title = recording
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();

        let artist = recording
            .get("artist-credit")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|a| a.get("name").and_then(|n| n.as_str()))
                    .collect::<Vec<_>>()
                    .join(" & ")
            })
            .unwrap_or_default();

        let releases = recording
            .get("releases")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();
        if releases.is_empty() {
            continue;
        }

        let release = &releases[0];
        let release_id = release
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        if release_id.is_empty() {
            continue;
        }

        let album = release
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        let date = release
            .get("date")
            .and_then(|v| v.as_str())
            .or_else(|| recording.get("first-release-date").and_then(|v| v.as_str()))
            .unwrap_or_default()
            .to_string();

        let cover_data_url = fetch_cover_data_url(client, &release_id).await;
        out.push(OnlineMatch {
            id: recording_id,
            title,
            artist,
            album,
            date,
            source: "MusicBrainz".to_string(),
            tracknumber: None,
            cover_data_url,
            release_id: Some(release_id),
        });
    }

    Ok(out)
}

async fn search_itunes(client: &Client, query: &OnlineQuery) -> Result<Vec<OnlineMatch>, String> {
    let term = format!("{} {} {}", query.artist, query.title, query.album).trim().to_string();
    if term.is_empty() {
        return Ok(Vec::new());
    }

    let payload: Value = client
        .get("https://itunes.apple.com/search")
        .query(&[
            ("term", term),
            ("media", "music".to_string()),
            ("entity", "song".to_string()),
            ("limit", "8".to_string()),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    let results = payload
        .get("results")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    for item in results {
        let id = item
            .get("trackId")
            .and_then(|v| v.as_i64())
            .map(|v| format!("itunes-{v}"))
            .unwrap_or_else(|| format!("itunes-{}", out.len() + 1));

        let title = item
            .get("trackName")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        let artist = item
            .get("artistName")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        let album = item
            .get("collectionName")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();

        if title.is_empty() && artist.is_empty() && album.is_empty() {
            continue;
        }

        let date = item
            .get("releaseDate")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();

        let tracknumber = item
            .get("trackNumber")
            .and_then(|v| v.as_i64())
            .map(|v| v.to_string());

        let artwork_url = item
            .get("artworkUrl100")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .replace("100x100bb", "600x600bb");
        let cover_data_url = if artwork_url.is_empty() {
            None
        } else {
            fetch_cover_data_url_from_url(client, &artwork_url).await
        };

        out.push(OnlineMatch {
            id,
            title,
            artist,
            album,
            date,
            source: "iTunes".to_string(),
            tracknumber,
            cover_data_url,
            release_id: None,
        });
    }

    Ok(out)
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title("DiscoBalls");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pick_music_folder,
            scan_folder,
            search_online,
            navidrome_ping,
            navidrome_scan_library,
            navidrome_get_audio_data_url,
            navidrome_get_cover_data_url,
            save_track,
            rename_track,
            rename_file,
            search_albums,
            get_album_release,
            get_audio_data_url,
            get_track_technical_info,
            open_external_url,
            open_track_in_file_manager
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn release_search_results_are_read() {
        let response: Value = serde_json::from_str(
            r#"{"releases":[
              {"id":"a1","title":"Random Access Memories","date":"2013-05-17","country":"XW",
               "disambiguation":"10th anniversary edition",
               "artist-credit":[{"name":"Daft Punk","joinphrase":""}],
               "label-info":[{"label":{"name":"Columbia"}}],
               "media":[{"track-count":13},{"track-count":2}]},
              {"id":"a2","title":"Bare"},
              {"title":"No id"}
            ]}"#,
        )
        .unwrap();
        let found = parse_release_search(&response);
        assert_eq!(found.len(), 2);
        assert_eq!(found[0].artist, "Daft Punk");
        assert_eq!(found[0].track_count, 15);
        assert_eq!(found[0].label.as_deref(), Some("Columbia"));
        assert_eq!(found[0].country.as_deref(), Some("XW"));
        assert_eq!(found[0].disambiguation.as_deref(), Some("10th anniversary edition"));
        assert_eq!(found[1].track_count, 0);
        assert_eq!(found[1].date, "");
    }

    #[test]
    fn release_tracks_are_read_in_disc_order_with_credited_artists() {
        let response: Value = serde_json::from_str(
            r#"{"id":"r1","title":"Collab","date":"2020",
               "artist-credit":[{"name":"Main","joinphrase":" feat. "},{"name":"Guest","joinphrase":""}],
               "media":[
                 {"position":1,"tracks":[
                   {"number":"1","title":"One","length":180000},
                   {"number":"2","title":"Two","artist-credit":[{"name":"Other","joinphrase":""}]}]},
                 {"position":2,"tracks":[
                   {"position":1,"recording":{"title":"Disc two opener"}},
                   {"number":"2","title":""}]}
               ]}"#,
        )
        .unwrap();
        let release = parse_release_tracks(&response).unwrap();
        assert_eq!(release.artist, "Main feat. Guest");
        let summary: Vec<(u32, &str, &str, &str)> = release
            .tracks
            .iter()
            .map(|t| (t.disc, t.number.as_str(), t.title.as_str(), t.artist.as_str()))
            .collect();
        assert_eq!(
            summary,
            vec![
                (1, "1", "One", "Main feat. Guest"),
                (1, "2", "Two", "Other"),
                (2, "1", "Disc two opener", "Main feat. Guest"),
            ]
        );
        assert_eq!(release.tracks[0].length_ms, Some(180000));
    }

    #[test]
    fn malformed_releases_do_not_panic() {
        assert!(parse_release_tracks(&serde_json::json!({})).is_none());
        assert!(parse_release_search(&serde_json::json!({"releases": "oops"})).is_empty());
    }

    #[test]
    fn replaygain_values_are_parsed_leniently() {
        assert_eq!(parse_replaygain("-6.50 dB"), Some(-6.5));
        assert_eq!(parse_replaygain("+3.2dB"), Some(3.2));
        assert_eq!(parse_replaygain(" -4,1 db "), Some(-4.1));
        assert_eq!(parse_replaygain("0.00"), Some(0.0));
        assert_eq!(parse_replaygain("loud"), None);
        assert_eq!(parse_replaygain("999 dB"), None);
        assert_eq!(parse_replaygain(""), None);
    }

    #[tokio::test]
    async fn requests_retry_when_the_server_is_not_reachable_yet() {
        use std::io::{Read, Write};
        // A free port with nothing listening on it: the first attempt is refused.
        let port = std::net::TcpListener::bind("127.0.0.1:0").unwrap().local_addr().unwrap().port();
        let server = std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(150));
            let listener = std::net::TcpListener::bind(("127.0.0.1", port)).unwrap();
            let (mut stream, _) = listener.accept().unwrap();
            let mut buffer = [0u8; 1024];
            let _ = stream.read(&mut buffer);
            stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok").unwrap();
        });

        let client = Client::new();
        let response = send_with_connect_retry(client.get(format!("http://127.0.0.1:{port}/rest/ping.view"))).await.unwrap();
        assert!(response.status().is_success());
        server.join().unwrap();
    }

    #[test]
    fn subsonic_timestamps_become_epoch_millis() {
        assert_eq!(parse_iso_timestamp_millis("1970-01-01T00:00:00Z"), Some(0));
        assert_eq!(parse_iso_timestamp_millis("2023-04-01T10:20:30.123Z"), Some(1_680_344_430_123));
        assert_eq!(parse_iso_timestamp_millis("2023-04-01T12:20:30.123456+02:00"), Some(1_680_344_430_123));
        assert_eq!(parse_iso_timestamp_millis("2000-02-29"), Some(951_782_400_000));
        assert_eq!(parse_iso_timestamp_millis("yesterday"), None);
        assert_eq!(parse_iso_timestamp_millis("2023-13-01T00:00:00Z"), None);
    }

    #[test]
    fn file_names_cannot_leave_their_folder() {
        assert!(validate_file_name("01 - Song.mp3").is_ok());
        assert!(validate_file_name("  ").is_err());
        assert!(validate_file_name("..").is_err());
        assert!(validate_file_name("../evil.mp3").is_err());
        assert!(validate_file_name("a\\b.mp3").is_err());
    }

    #[test]
    fn rename_file_moves_within_the_folder_and_never_overwrites() {
        let dir = std::env::temp_dir().join(format!("discoballs-rename-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let first = dir.join("a.mp3");
        let second = dir.join("b.mp3");
        fs::write(&first, b"1").unwrap();
        fs::write(&second, b"2").unwrap();

        let renamed = rename_file(first.to_string_lossy().to_string(), "c.mp3".to_string()).unwrap();
        assert!(PathBuf::from(&renamed.path).ends_with("c.mp3"));
        assert!(!first.exists());

        let clash = rename_file(renamed.path.clone(), "b.mp3".to_string());
        assert!(clash.is_err());
        assert!(second.exists());
        assert!(rename_file(renamed.path.clone(), "../x.mp3".to_string()).is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn primary_tag_type_matches_scanned_audio_formats() {
        let cases = [
            ("track.mp3", TagType::Id3v2),
            ("track.flac", TagType::VorbisComments),
            ("track.m4a", TagType::Mp4Ilst),
            ("track.ogg", TagType::VorbisComments),
            ("track.wav", TagType::Id3v2),
        ];

        for (path, expected) in cases {
            assert_eq!(
                primary_tag_type_for_path(Path::new(path)).unwrap(),
                expected
            );
        }
    }

    #[test]
    fn cover_sidecars_are_not_scanned_as_audio_tracks() {
        assert!(!is_supported_audio_path(Path::new("album.cover.mp3")));
        assert!(!is_supported_audio_path(Path::new("cover.flac.cover")));
    }
}
