let githubConnected = false;
let ghToken = "";

function setStatus(msg, isError = false) {
  const statusEl = document.getElementById("status");
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#ff6666" : "var(--muted)";
}

function toggleInputs(connected) {
  document.getElementById("fileInput").disabled = !connected;
  document.getElementById("commitMessage").disabled = !connected;
  document.getElementById("uploadBtn").disabled = !connected;
  document.getElementById("connectBtn").disabled = connected;
  document.getElementById("token").disabled = connected;
  document.getElementById("username").disabled = connected;
  document.getElementById("repo").disabled = connected;
  document.getElementById("folder").disabled = connected;
  githubConnected = connected;
}

async function testConnection(token, username, repo) {
  const apiUrl = `https://api.github.com/repos/${username}/${repo}`;
  try {
    const res = await fetch(apiUrl, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (!res.ok) {
      const err = await res.json();
      return { success: false, message: err.message || res.statusText };
    }
    return { success: true };
  } catch {
    return { success: false, message: "Network error" };
  }
}

async function connectGitHub() {
  const token = document.getElementById("token").value.trim();
  const username = document.getElementById("username").value.trim();
  const repo = document.getElementById("repo").value.trim();

  if (!token) {
    setStatus("❌ Please enter your GitHub token.", true);
    return;
  }
  if (!username) {
    setStatus("❌ Please enter your GitHub username.", true);
    return;
  }
  if (!repo) {
    setStatus("❌ Please enter your repository name.", true);
    return;
  }

  setStatus("⏳ Testing connection to GitHub...");

  const result = await testConnection(token, username, repo);
  if (!result.success) {
    setStatus(`❌ Connection failed: ${result.message}`, true);
    return;
  }

  ghToken = token;
  toggleInputs(true);
  setStatus("✅ Connected to GitHub. Ready to upload and refresh images.");

  // Load images from the folder after successful connect
  loadImages();
}

async function loadImages() {
  if (!githubConnected) {
    setStatus("❌ Not connected to GitHub.", true);
    return;
  }

  const username = document.getElementById("username").value.trim();
  const repo = document.getElementById("repo").value.trim();
  const folder = document.getElementById("folder").value.trim() || "images";

  setStatus("⏳ Loading images from GitHub...");

  const apiUrl = `https://api.github.com/repos/${username}/${repo}/contents/${folder}`;

  try {
    const res = await fetch(apiUrl, {
      headers: {
        Authorization: `token ${ghToken}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (!res.ok) {
      if (res.status === 404) {
        setStatus("❌ Folder not found. Please check folder name.", true);
      } else {
        const err = await res.json();
        setStatus(`❌ Failed to load images: ${err.message || res.statusText}`, true);
      }
      return;
    }

    const files = await res.json();

    // Filter only image files
    const images = files.filter(file =>
      file.type === "file" &&
      /\.(png|jpe?g|gif|bmp|webp|svg)$/i.test(file.name)
    );

    // Display image list
    const imageList = document.getElementById("imageList");
    if (!imageList) {
      // If imageList container does not exist in your HTML, you can create it here or skip display
      setStatus(`✅ Loaded ${images.length} images.`);
      return;
    }
    imageList.innerHTML = "";

    images.forEach(img => {
      const imgEl = document.createElement("img");
      imgEl.src = img.download_url;
      imgEl.alt = img.name;
      imgEl.title = img.name;
      imgEl.style.cursor = "pointer";
      imgEl.style.maxWidth = "100px";
      imgEl.style.margin = "5px";
      imgEl.onclick = () => previewImage(img.download_url, img.name);
      imageList.appendChild(imgEl);
    });

    setStatus(`✅ Loaded ${images.length} images.`);
  } catch (err) {
    setStatus("❌ Network error while loading images.", true);
  }
}

function previewImage(url, name) {
  const preview = document.getElementById("previewImage");
  if (preview) {
    preview.src = url;
    preview.alt = name;
  }
}

async function addImage() {
  if (!githubConnected) {
    setStatus("❌ Not connected to GitHub.", true);
    return;
  }

  const username = document.getElementById("username").value.trim();
  const repo = document.getElementById("repo").value.trim();
  const folder = document.getElementById("folder").value.trim() || "images";
  const commitMessage = document.getElementById("commitMessage").value.trim() || "Add / update image";
  const fileInput = document.getElementById("fileInput");

  if (!fileInput.files.length) {
    setStatus("❌ Please select an image file first.", true);
    return;
  }

  const file = fileInput.files[0];
  const path = `${folder}/${file.name}`;

  setStatus("⏳ Reading file...");

  const reader = new FileReader();
  reader.onload = async () => {
    const base64Content = reader.result.split(",")[1];

    const apiUrl = `https://api.github.com/repos/${username}/${repo}/contents/${path}`;

    // Check if file exists to get SHA (needed for overwrite)
    let sha = null;
    try {
      const getRes = await fetch(apiUrl, {
        headers: {
          Authorization: `token ${ghToken}`,
          Accept: "application/vnd.github+json",
        },
      });

      if (getRes.ok) {
        const data = await getRes.json();
        sha = data.sha;
      } else if (getRes.status !== 404) {
        setStatus(`❌ Error checking file existence: ${getRes.status}`, true);
        return;
      }
    } catch (err) {
      setStatus("❌ Network error while checking file existence.", true);
      return;
    }

    setStatus("⏳ Uploading image to GitHub...");

    const body = {
      message: commitMessage,
      content: base64Content,
    };
    if (sha) body.sha = sha;

    try {
      const putRes = await fetch(apiUrl, {
        method: "PUT",
        headers: {
          Authorization: `token ${ghToken}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!putRes.ok) {
        const errData = await putRes.json();
        setStatus(`❌ Commit failed: ${errData.message || putRes.statusText}`, true);
        return;
      }

      setStatus(`✅ Image committed successfully!`);
      // Clear file input and commit message
      fileInput.value = "";
      document.getElementById("commitMessage").value = "";

      // Refresh image list
      loadImages();
    } catch (err) {
      setStatus("❌ Network error while committing image.", true);
    }
  };

  reader.readAsDataURL(file);
}

// Optional: Show/hide token for user convenience
function toggleTokenVisibility() {
  const tokenInput = document.getElementById("token");
  if (tokenInput.type === "password") {
    tokenInput.type = "text";
  } else {
    tokenInput.type = "password";
  }
}
