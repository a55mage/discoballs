use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use tauri::Manager;

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
}

#[tauri::command]
fn pick_music_folder() -> Option<String> {
    rfd::FileDialog::new()
        .set_title("Seleziona cartella musica")
        .pick_folder()
        .map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
fn scan_folder(path: String) -> Result<ScanResult, String> {
    run_python_scan(&path)
}

#[tauri::command]
async fn search_online(query: OnlineQuery) -> Result<Vec<OnlineMatch>, String> {
    if query.title.trim().is_empty() && query.artist.trim().is_empty() && query.album.trim().is_empty() {
        return Ok(Vec::new());
    }

    let client = Client::builder()
        .user_agent("musicmanager/0.1.0 (desktop app)")
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
fn save_track(input: SaveTrackInput) -> Result<(), String> {
    run_python_save(&input)
}

fn project_root() -> PathBuf {
    // web/src-tauri -> project root is parent of web
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(|p| p.parent())
        .unwrap()
        .to_path_buf()
}

fn bridge_script_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("py_bridge.py")
}

fn python_executable() -> PathBuf {
    let root = project_root();
    let candidates = [root.join(".venv/bin/python"), root.join(".venv/bin/python3")];
    for candidate in candidates {
        if candidate.exists() {
            return candidate;
        }
    }
    PathBuf::from("python3")
}

fn run_python_scan(path: &str) -> Result<ScanResult, String> {
    let output = Command::new(python_executable())
        .arg(bridge_script_path())
        .arg("scan")
        .arg(path)
        .output()
        .map_err(|e| format!("Errore avvio bridge scan: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("Bridge scan failed: {stderr}"));
    }

    serde_json::from_slice::<ScanResult>(&output.stdout)
        .map_err(|e| format!("Parse risultato scan fallita: {e}"))
}

fn run_python_save(input: &SaveTrackInput) -> Result<(), String> {
    let mut child = Command::new(python_executable())
        .arg(bridge_script_path())
        .arg("save")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Errore avvio bridge save: {e}"))?;

    if let Some(stdin) = child.stdin.as_mut() {
        let payload = serde_json::to_vec(input).map_err(|e| format!("Serialize input save failed: {e}"))?;
        stdin
            .write_all(&payload)
            .map_err(|e| format!("Errore write stdin bridge save: {e}"))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Errore attesa bridge save: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("Bridge save failed: {stderr}"));
    }

    Ok(())
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
                let _ = window.set_title("MusicManager");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pick_music_folder,
            scan_folder,
            search_online,
            save_track
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
