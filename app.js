// ============================================================
// AGRO-WARE Admin Panel - Logic
// ============================================================

const ADMIN_PASSWORD = "agro2024";
const KEYS_STORAGE = "agro_ware_keys";
const SESSION_KEY = "agro_ware_session";

let keysDatabase = [];
let generatedKeysCache = [];

// ============================================================
// LOGIN
// ============================================================

function login() {
    const password = document.getElementById("passwordInput").value;
    const errorEl = document.getElementById("loginError");
    
    if (password === ADMIN_PASSWORD) {
        sessionStorage.setItem(SESSION_KEY, "authenticated");
        showDashboard();
        errorEl.textContent = "";
    } else {
        errorEl.textContent = "Invalid password";
        document.getElementById("passwordInput").value = "";
        document.getElementById("passwordInput").focus();
    }
}

function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    location.reload();
}

function showDashboard() {
    document.getElementById("loginScreen").classList.remove("active");
    document.getElementById("dashboard").classList.add("active");
    loadKeys();
    updateStats();
}

window.addEventListener("DOMContentLoaded", () => {
    if (sessionStorage.getItem(SESSION_KEY) === "authenticated") {
        showDashboard();
    }
    
    document.getElementById("passwordInput").addEventListener("keypress", (e) => {
        if (e.key === "Enter") login();
    });
});

// ============================================================
// NAVIGATION
// ============================================================

const PAGE_META = {
    overview: { title: "Overview", subtitle: "Dashboard statistics and quick actions" },
    generate: { title: "Generate Keys", subtitle: "Create new license keys for your users" },
    manage: { title: "Manage Keys", subtitle: "View, search, and manage existing keys" },
    settings: { title: "Settings", subtitle: "Configure your license system" }
};

function showPage(pageName) {
    document.querySelectorAll(".nav-item").forEach(item => {
        item.classList.toggle("active", item.dataset.page === pageName);
    });
    
    document.querySelectorAll(".page").forEach(page => {
        page.classList.toggle("active", page.id === `page-${pageName}`);
    });
    
    const meta = PAGE_META[pageName];
    if (meta) {
        document.getElementById("pageTitle").textContent = meta.title;
        document.getElementById("pageSubtitle").textContent = meta.subtitle;
    }
    
    if (pageName === "manage") renderKeysTable();
    if (pageName === "overview") updateStats();
}

// ============================================================
// KEY GENERATION
// ============================================================

function generateRandomHex(length) {
    const chars = "0123456789ABCDEF";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function generateKey(type) {
    const year = new Date().getFullYear();
    return `AGRO-${type}-${year}-${generateRandomHex(4)}-${generateRandomHex(4)}-${generateRandomHex(4)}`;
}

function generateKeys() {
    const type = document.getElementById("genType").value;
    const duration = parseInt(document.getElementById("genDuration").value);
    const quantity = parseInt(document.getElementById("genQuantity").value);
    const note = document.getElementById("genNote").value;
    
    generatedKeysCache = [];
    
    for (let i = 0; i < quantity; i++) {
        const key = generateKey(type);
        
        // ✅ CHANGE: Don't set expiresAt on generation!
        // It will be set when the user activates the key
        generatedKeysCache.push({
            key: key,
            type: type,
            duration: duration,          // ← Duration in days (stored for later)
            expiresAt: null,             // ← NULL until first use!
            activatedAt: null,           // ← When user first used it
            hwid: null,
            used: false,
            generated: new Date().toISOString(),
            note: note
        });
    }
    
    const output = document.getElementById("keysOutput");
    output.innerHTML = generatedKeysCache
        .map(k => `<div class="key-item">${k.key}</div>`)
        .join("");
    
    document.getElementById("generatedKeys").classList.remove("hidden");
}

function copyGeneratedKeys() {
    const text = generatedKeysCache.map(k => k.key).join("\n");
    navigator.clipboard.writeText(text);
    showToast(`Copied ${generatedKeysCache.length} keys to clipboard`, "success");
}

function saveKeys() {
    if (generatedKeysCache.length === 0) {
        console.log("No keys to save");
        return;
    }
    
    // ✅ FIX: Make sure keysDatabase is an array
    if (!Array.isArray(keysDatabase)) {
        console.warn("keysDatabase was not an array, resetting to []", keysDatabase);
        keysDatabase = [];
    }
    
    keysDatabase.push(...generatedKeysCache);
    saveKeysToStorage();
    
    showToast(`Saved ${generatedKeysCache.length} key(s)`, "success");
    
    generatedKeysCache = [];
    document.getElementById("generatedKeys").classList.add("hidden");
    document.getElementById("genNote").value = "";
    
    updateStats();
}

// ============================================================
// KEY MANAGEMENT
// ============================================================

async function loadKeys() {
    console.log('Loading keys...');
    
    try {
        const response = await fetch('keys.json?t=' + Date.now());
        if (response.ok) {
            const data = await response.json();
            
            // ✅ FIX: Handle different JSON shapes
            if (Array.isArray(data)) {
                keysDatabase = data;
            } else if (data && Array.isArray(data.keys)) {
                keysDatabase = data.keys;
            } else if (data && typeof data === 'object') {
                // Single key object → wrap in array
                keysDatabase = Object.keys(data).length > 0 ? [data] : [];
            } else {
                keysDatabase = [];
            }
            
            console.log('✅ Loaded', keysDatabase.length, 'keys from GitHub');
            localStorage.setItem(KEYS_STORAGE, JSON.stringify(keysDatabase));
        } else {
            throw new Error('HTTP ' + response.status);
        }
    } catch (e) {
        console.log('⚠️ GitHub fetch failed, using localStorage:', e.message);
        const stored = localStorage.getItem(KEYS_STORAGE);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                keysDatabase = Array.isArray(parsed) ? parsed : [];
                console.log('📦 Loaded', keysDatabase.length, 'keys from localStorage');
            } catch (e2) {
                keysDatabase = [];
            }
        }
    }
    
    updateStats();
}

function saveKeysToStorage() {
    localStorage.setItem(KEYS_STORAGE, JSON.stringify(keysDatabase));
}

function renderKeysTable() {
    const tbody = document.getElementById("keysTableBody");
    const searchTerm = document.getElementById("searchInput").value.toLowerCase();
    const filterStatus = document.getElementById("filterStatus").value;
    
    let filtered = keysDatabase.filter(key => {
        const matchesSearch = key.key.toLowerCase().includes(searchTerm) ||
                             (key.note && key.note.toLowerCase().includes(searchTerm));
        if (!matchesSearch) return false;
        
        const status = getKeyStatus(key);
        if (filterStatus !== "all" && status !== filterStatus) return false;
        
        return true;
    });
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:40px; color: var(--text-3);">No keys found</td></tr>`;
        return;
    }
    
    tbody.innerHTML = filtered.map(key => {
        const status = getKeyStatus(key);
        const expiryText = key.expiresAt 
            ? new Date(key.expiresAt).toLocaleDateString()
            : "Never";
        
        return `
            <tr>
                <td>${key.key}</td>
                <td>${key.type}</td>
                <td><span class="badge badge-${status}">${status}</span></td>
                <td>${expiryText}</td>
                <td>${key.hwid || "—"}</td>
                <td>
                    <button class="action-btn" onclick="copyKey('${key.key}')" title="Copy">📋</button>
                    <button class="action-btn" onclick="unbindKey('${key.key}')" title="Unbind HWID">🔓</button>
                    <button class="action-btn danger" onclick="deleteKey('${key.key}')" title="Delete">🗑️</button>
                </td>
            </tr>
        `;
    }).join("");
}

function getKeyStatus(key) {
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
        return "expired";
    }
    if (key.hwid) {
        return "active";
    }
    if (key.used) return "used";
    return "unused";
}

function copyKey(keyString) {
    navigator.clipboard.writeText(keyString);
    showToast("Key copied to clipboard", "success");
}

function unbindKey(keyString) {
    const key = keysDatabase.find(k => k.key === keyString);
    if (!key) return;
    
    if (confirm(`Unbind HWID from ${keyString}?\n\nThis allows the key to be used on another machine.`)) {
        key.hwid = null;
        key.used = false;
        saveKeysToStorage();
        renderKeysTable();
        updateStats();
        showToast("HWID unbound successfully", "success");
    }
}

function deleteKey(keyString) {
    if (!confirm(`Delete key ${keyString}?\n\nThis cannot be undone!`)) return;
    
    keysDatabase = keysDatabase.filter(k => k.key !== keyString);
    saveKeysToStorage();
    renderKeysTable();
    updateStats();
    showToast("Key deleted", "success");
}

function filterKeys() {
    renderKeysTable();
}

function refreshKeys() {
    loadKeys();
    renderKeysTable();
    updateStats();
    showToast("Keys refreshed", "info");
}

// ============================================================
// STATISTICS
// ============================================================

function updateStats() {
    const total = keysDatabase.length;
    const active = keysDatabase.filter(k => getKeyStatus(k) === "active").length;
    const bound = keysDatabase.filter(k => k.hwid).length;
    const expired = keysDatabase.filter(k => getKeyStatus(k) === "expired").length;
    
    document.getElementById("statTotal").textContent = total;
    document.getElementById("statActive").textContent = active;
    document.getElementById("statBound").textContent = bound;
    document.getElementById("statExpired").textContent = expired;
    document.getElementById("keyCount").textContent = `${total} key${total !== 1 ? 's' : ''}`;
}

// ============================================================
// EXPORT / IMPORT
// ============================================================

function exportKeys() {
    const data = JSON.stringify(keysDatabase, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `keys.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    showToast("Database exported", "success");
}

function importKeys() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = (ev) => {
            try {
                const imported = JSON.parse(ev.target.result);
                if (Array.isArray(imported)) {
                    keysDatabase = imported;
                    saveKeysToStorage();
                    renderKeysTable();
                    updateStats();
                    showToast(`Imported ${imported.length} keys`, "success");
                }
            } catch (err) {
                showToast("Invalid JSON file", "error");
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

// ============================================================
// SETTINGS
// ============================================================

function saveSettings() {
    showToast("Settings saved", "success");
}

function showGitHubInstructions() {
    alert(
        "To push keys to GitHub:\n\n" +
        "1. Click 'Export DB' on the Overview page\n" +
        "2. Go to your GitHub repo\n" +
        "3. Replace keys.json with the exported file\n" +
        "4. Commit changes\n\n" +
        "Your client will fetch it automatically!"
    );
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================

function showToast(message, type = "info") {
    const existing = document.querySelector(".toast");
    if (existing) existing.remove();
    
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    const colors = {
        success: "#4ade80",
        error: "#f87171",
        info: "#60a5fa"
    };
    
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        padding: 14px 20px;
        background: #17171f;
        border: 1px solid ${colors[type]};
        border-left: 3px solid ${colors[type]};
        border-radius: 8px;
        color: #ffffff;
        font-size: 13px;
        font-weight: 500;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        z-index: 9999;
        animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        font-family: 'Inter', sans-serif;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = "slideOut 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Add animations
const style = document.createElement("style");
style.textContent = `
    @keyframes slideIn {
        from { opacity: 0; transform: translateX(100px); }
        to { opacity: 1; transform: translateX(0); }
    }
    @keyframes slideOut {
        from { opacity: 1; transform: translateX(0); }
        to { opacity: 0; transform: translateX(100px); }
    }
`;
document.head.appendChild(style);
