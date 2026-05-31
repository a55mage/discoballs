use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use lofty::config::WriteOptions;
use lofty::file::{AudioFile, FileType, TaggedFileExt};
use lofty::picture::{MimeType, Picture, PictureType};
use lofty::prelude::Accessor;
use lofty::probe::Probe;
use lofty::tag::{Tag, TagExt, TagType};
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
    let response = client
        .get(format!("{base_url}/rest/ping.view"))
        .query(&[
            ("u", username.to_string()),
            ("p", format!("enc:{}", hex_encode(&input.password))),
            ("v", "1.16.1".to_string()),
            ("c", "DiscoBalls".to_string()),
            ("f", "json".to_string()),
        ])
        .send()
        .await
        .map_err(|e| format!("Navidrome connection failed: {e}"))?;

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

    if let Ok(tagged_file) = Probe::open(&audio_path).and_then(|p| p.read()) {
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
    }
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
    let response = client
        .get(format!("{base_url}/rest/{endpoint}.view"))
        .query(&params)
        .send()
        .await
        .map_err(|e| format!("Navidrome request failed: {e}"))?;

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
    let response = client
        .get(format!("{base_url}/rest/{endpoint}.view"))
        .query(&params)
        .send()
        .await
        .map_err(|e| format!("Navidrome media request failed: {e}"))?;

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
