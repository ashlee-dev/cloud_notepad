const API = "https://api.github.com";
const GITHUB_CLIENT_ID = "YOUR_CLIENT_ID_HERE";

/* ---------- STATUS ---------- */
function status(msg, ok = true) {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.style.color = ok ? "#6aff9f" : "#ff6a6a";
}

/* ---------- GITHUB OAUTH ---------- */
function githubLogin() {
  const redirect = window.location.origin + window.location.pathname;
  const scope = "repo read:user";

  window.location.href =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${GITHUB_CLIENT_ID}` +
    `&redirect_uri=${redirect}` +
    `&scope=${scope}`;
}

/* Detect OAuth redirect */
(function handleOAuth() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("code")) {
    status("GitHub sign-in successful. Enter token to continue.");
    window.history.replaceState({}, document.title, window.location.pathname);
  }
})();

/* ---------- CONNECT ---------- */
async function connect() {
  if (!token.value) {
    return status("GitHub token required", false);
  }

  await fetchUser();
  refreshImages();
}

/* ---------- FETCH USER ---------- */
async function fetchUser() {
  try {
    const res = await fetch(`${API}/user`, {
      headers: { Authorization: `token ${token.value}` }
    });
    const data = await res.json();
    username.value = data.login;
    status(`Authenticated as ${data.login}`);
  } catch {
    status("Failed to authenticate", false);
  }
}

/* ---------- LOAD IMAGES ---------- */
async function refreshImages() {
  try {
    const res = await fetch(
      `${API}/repos/${username.value}/${repo.value}/contents/${folder.value}`,
      { headers: { Authorization: `token ${token.value}` } }
    );

    if (!res.ok) throw new Error("Cannot load image folder");

    const files = await res.json();
    imageList.innerHTML = "";

    files.forEach(file => {
      if (file.type === "file") {
        const img = document.createElement("img");
        img.src = file.download_url;
        img.onclick = () => previewImage.src = img.src;
        imageList.appendChild(img);
      }
    });

    status("Images loaded");
  } catch (e) {
    status(e.message, false);
  }
}

/* ---------- ADD / UPDATE IMAGE ---------- */
async function addImage() {
  const file = fileInput.files[0];
  if (!file) return status("No image selected", false);

  const reader = new FileReader();
  reader.onload = async () => {
    const content = reader.result.split(",")[1];
    const path = `${folder.value}/${file.name}`;

    let sha = null;
    const check = await fetch(
      `${API}/repos/${username.value}/${repo.value}/contents/${path}`,
      { headers: { Authorization: `token ${token.value}` } }
    );
    if (check.ok) sha = (await check.json()).sha;

    const res = await fetch(
      `${API}/repos/${username.value}/${repo.value}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `token ${token.value}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "Add or update image",
          content,
          sha
        })
      }
    );

    res.ok
      ? status("Image saved successfully")
      : status("Image upload failed", false);

    refreshImages();
  };

  reader.readAsDataURL(file);
}

