function detectRepositorySlug() {
  const host = window.location.hostname;
  const pathParts = window.location.pathname.split("/").filter(Boolean);

  if (host.endsWith(".github.io")) {
    const owner = host.split(".")[0];
    const repo = pathParts[0];
    if (owner && repo) return `${owner}/${repo}`;
  }

  return "OWNER/REPO";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric"
  }).format(date);
}

async function loadReleaseInfo() {
  const slug = detectRepositorySlug();
  const repoLabel = document.getElementById("repo-name");
  const versionLabel = document.getElementById("release-version");
  const dateLabel = document.getElementById("release-date");
  const assetsList = document.getElementById("assets-list");
  const latestLink = document.getElementById("latest-release");
  const allReleasesLink = document.getElementById("all-releases");

  repoLabel.textContent = slug;
  latestLink.href = `https://github.com/${slug}/releases/latest`;
  allReleasesLink.href = `https://github.com/${slug}/releases`;

  if (slug === "OWNER/REPO") {
    assetsList.innerHTML =
      '<li class="muted">Set the repository slug in <code>docs/script.js</code> when using a custom domain.</li>';
    return;
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${slug}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const release = await response.json();
    versionLabel.textContent = release.tag_name || "-";
    dateLabel.textContent = formatDate(release.published_at);

    if (!release.assets || release.assets.length === 0) {
      assetsList.innerHTML = '<li class="muted">No downloadable assets found for this release.</li>';
      return;
    }

    assetsList.innerHTML = "";
    release.assets.forEach((asset) => {
      const li = document.createElement("li");
      const sizeMb = (asset.size / (1024 * 1024)).toFixed(1);
      li.innerHTML = `<a href="${asset.browser_download_url}" target="_blank" rel="noreferrer">${asset.name}</a> · ${sizeMb} MB`;
      assetsList.appendChild(li);
    });
  } catch {
    assetsList.innerHTML =
      '<li class="muted">Could not load the latest release. Make sure the repository has public releases.</li>';
  }
}

loadReleaseInfo();
