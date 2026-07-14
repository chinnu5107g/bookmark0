const API_BASE = "https://bookmark2-gxjg.onrender.com/api";

let isBackendOffline = false;

// ----------------------------------------------------
// BACKEND STATUS CHECK
// ----------------------------------------------------
export const checkBackendStatus = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // increased timeout

    const res = await fetch("https://bookmark2-gxjg.onrender.com/", {
      method: "GET",
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    console.log("Backend ping succeeded. Status:", res.status);
    isBackendOffline = false;
    return true;
  } catch (err) {
    console.error("Backend ping failed. Error:", err);
    isBackendOffline = true;
    return false;
  }
};

export const getBackendOfflineStatus = () => isBackendOffline;

// ----------------------------------------------------
// HEADERS
// ----------------------------------------------------
const getHeaders = (userId) => {
  const headers = {
    "Content-Type": "application/json"
  };
  if (userId) headers["X-User-Id"] = userId;
  return headers;
};

// ----------------------------------------------------
// AUTH APIs
// ----------------------------------------------------

export const register = async (name, email, password) => {
  const isOnline = await checkBackendStatus();

  if (!isOnline) {
    const users = JSON.parse(localStorage.getItem("users") || "[]");

    if (users.some(u => u.name.toLowerCase() === name.toLowerCase()))
      throw new Error("Username already exists (offline)");

    if (users.some(u => u.email.toLowerCase() === email.toLowerCase()))
      throw new Error("Email already exists (offline)");

    const newUser = {
      id: `local_${Date.now()}`,
      name,
      email,
      password
    };

    users.push(newUser);
    localStorage.setItem("users", JSON.stringify(users));

    return { user: newUser, offline: true };
  }

  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ name, email, password })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Register failed");

  const localUsers = JSON.parse(localStorage.getItem("users") || "[]");

  const userObj = {
    id: data.user._id || data.user.id,
    name: data.user.name,
    email: data.user.email,
    password,
    avatar: data.user.avatar
  };

  localUsers.push(userObj);
  localStorage.setItem("users", JSON.stringify(localUsers));

  return { user: data.user, offline: false };
};

// ----------------------------------------------------

export const login = async (identifier, password) => {
  const isOnline = await checkBackendStatus();

  if (!isOnline) {
    const users = JSON.parse(localStorage.getItem("users") || "[]");

    const found = users.find(
      u =>
        (u.email.toLowerCase() === identifier.toLowerCase() ||
          u.name.toLowerCase() === identifier.toLowerCase()) &&
        u.password === password
    );

    if (!found) throw new Error("Invalid offline credentials");

    return { user: found, offline: true };
  }

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ identifier, password })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");

  const localUsers = JSON.parse(localStorage.getItem("users") || "[]");

  const idx = localUsers.findIndex(
    u => u.email.toLowerCase() === data.user.email.toLowerCase()
  );

  const userObj = {
    id: data.user._id || data.user.id,
    name: data.user.name,
    email: data.user.email,
    password,
    avatar: data.user.avatar
  };

  if (idx > -1) localUsers[idx] = userObj;
  else localUsers.push(userObj);

  localStorage.setItem("users", JSON.stringify(localUsers));

  return { user: data.user, offline: false };
};

// ----------------------------------------------------

export const updateProfile = async (userId, payload) => {
  const isOnline = await checkBackendStatus();

  if (!isOnline) {
    const users = JSON.parse(localStorage.getItem("users") || "[]");

    const index = users.findIndex(u => u.id === userId);
    if (index === -1) throw new Error("User not found");

    users[index] = { ...users[index], ...payload };
    localStorage.setItem("users", JSON.stringify(users));

    return { user: users[index], offline: true };
  }

  const res = await fetch(`${API_BASE}/users/${userId}`, {
    method: "PUT",
    headers: getHeaders(userId),
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Update failed");

  return {
    user: {
      id: data._id,
      name: data.name,
      email: data.email,
      avatar: data.avatar
    },
    offline: false
  };
};

// ----------------------------------------------------
// BOOKMARK APIs
// ----------------------------------------------------

export const getBookmarks = async (userId) => {
  const isOnline = await checkBackendStatus();

  if (!isOnline) {
    const key = `bookmarks_${userId || "guest"}`;
    return JSON.parse(localStorage.getItem(key) || "[]");
  }

  const res = await fetch(`${API_BASE}/bookmarks`, {
    method: "GET",
    headers: getHeaders(userId)
  });

  if (!res.ok) throw new Error("Failed to fetch bookmarks");

  return await res.json();
};

// ----------------------------------------------------

export const addBookmark = async (bookmark, userId) => {
  const isOnline = await checkBackendStatus();

  if (!isOnline) {
    const key = `bookmarks_${userId || "guest"}`;
    const stored = JSON.parse(localStorage.getItem(key) || "[]");

    const newB = { id: Date.now(), ...bookmark, favorite: false };
    const updated = [newB, ...stored];

    localStorage.setItem(key, JSON.stringify(updated));

    return newB;
  }

  const res = await fetch(`${API_BASE}/bookmarks`, {
    method: "POST",
    headers: getHeaders(userId),
    body: JSON.stringify(bookmark)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Add bookmark failed");

  return data;
};

// ----------------------------------------------------

export const deleteBookmark = async (id, userId) => {
  const isOnline = await checkBackendStatus();

  if (!isOnline) {
    const key = `bookmarks_${userId || "guest"}`;
    const stored = JSON.parse(localStorage.getItem(key) || "[]");

    const updated = stored.filter(b => b.id !== id);
    localStorage.setItem(key, JSON.stringify(updated));
    return;
  }

  const res = await fetch(`${API_BASE}/bookmarks/${id}`, {
    method: "DELETE",
    headers: getHeaders(userId)
  });

  if (!res.ok) throw new Error("Delete failed");
};

// ----------------------------------------------------

export const toggleFavorite = async (id, currentState, userId) => {
  const isOnline = await checkBackendStatus();

  if (!isOnline) {
    const key = `bookmarks_${userId || "guest"}`;
    const stored = JSON.parse(localStorage.getItem(key) || "[]");

    const updated = stored.map(b =>
      b.id === id ? { ...b, favorite: !b.favorite } : b
    );

    localStorage.setItem(key, JSON.stringify(updated));
    return;
  }

  const res = await fetch(`${API_BASE}/bookmarks/${id}`, {
    method: "PUT",
    headers: getHeaders(userId),
    body: JSON.stringify({ favorite: !currentState })
  });

  const data = await res.json();
  if (!res.ok) throw new Error("Toggle failed");

  return data;
};
