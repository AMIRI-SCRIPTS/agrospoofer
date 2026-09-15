// ============================================================
// AGRO-WARE Admin Panel - Logic
// ============================================================

const ADMIN_PASSWORD = "agro2024";
const KEYS_STORAGE = "agro_ware_keys";
const SESSION_KEY = "agro_ware_session";

let keysDatabase = [];
let generatedKeysCache = [];

// ============================================================
// LOGIN SYSTEM
// ============================================================

function login() {
    const password = document.getElementById("passwordInput").value;
    const errorEl = document.getElementById("loginError");
    
    if (password === ADMIN_PASSWORD) {
        sessionStorage.setItem(SESSION_KEY, "authenticated");
        showDashboard();
        errorEl.textContent = "";
    } else {
        errorEl.textContent = "❌ Invalid password";
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

// Check if already logged in
window.addEventListener("DOMContentLoaded", () => {
    if (sessionStorage.getItem(SESSION_KEY) === "authenticated") {
        showDashboard();
    }
    
    // Enter key for password
    document.getElementById("passwordInput").addEventListener("keypress", (e) => {
        if (e.key === "Enter") login();
    });
});

// ============================================================
// PAGE NAVIGATION
// ============================================================

function showPage(pageName) {
    // Update nav
    document.querySelectorAll(".nav-item").forEach(item => {
        item.classList.toggle("active", item.dataset.page === pageName);
    });
    
    // Update content
    document.querySelectorAll(".page").forEach(page => {
        page.classList.toggle("active", page.id === `page-${pageName}`);
    });
    
    // Refresh data on certain pages
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
    // Format: AGRO-PRO-2024-XXXX-XXXX-XXXX
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
        
        let expiresAt = null;
        if (duration > 0) {
            const expDate = new Date();
            expDate.setDate(expDate.getDate() + duration);
            expiresAt = expDate.toISOString();
        }
        
        generatedKeysCache.push({
            key: key,
            type: type,
            duration: duration,
            expiresAt: expiresAt,
            hwid: null,
            used: false,
            generated: new Date().toISOString(),
            note: note
        });
    }
    
    // Show output
    const output = document.getElementById("keysOutput");
    output.innerHTML = generatedKeysCache
        .map(k => `<div class="key-item">${k.key}</div>`)
        .join("");
    
    document.getElementById("generatedKeys").classList.remove("hidden");
}

function copyGeneratedKeys() {
    const text = generatedKeysCache.map(k => k.key).join("\n");
    navigator.clipboard.writeText(text);
    alert("✅ Keys copied to clipboard!");
}

function saveKeys() {
    if (generatedKeysCache.length === 0) return;
    
    // Add to database
    keysDatabase.push(...generatedKeysCache);
    saveKeysToStorage();
    
    alert(`✅ ${generatedKeysCache.length} key(s) saved!`);
    
    // Reset
    generatedKeysCache = [];
    document.getElementById("generatedKeys").classList.add("hidden");
    document.getElementById("genNote").value = "";
    
    updateStats();
}

// ============================================================
// KEY MANAGEMENT
// ============================================================

function loadKeys() {
    const stored = localStorage.getItem(KEYS_STORAGE);
    if (stored) {
        keysDatabase = JSON.parse(stored);
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
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:40px; color: var(--text-muted);">No keys found</td></tr>`;
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
                <td><span class="badge badge-${status}">${status.toUpperCase()}</span></td>
                <td>${expiryText}</td>
                <td>${key.hwid || "Not bound"}</td>
                <td>
                    <button class="action-btn" onclick="copyKey('${key.key}')">📋</button>
                    <button class="action-btn" onclick="unbindKey('${key.key}')">🔓</button>
                    <button class="action-btn danger" onclick="deleteKey('${key.key}')">🗑️</button>
                </td>
            </tr>
        `;
    }).join("");
}

function getKeyStatus(key) {
    if (key.hwid) {
        if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
            return "expired";
        }
        return "active";
    }
    if (key.used) return "used";
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) return "expired";
    return "unused";
}

function copyKey(keyString) {
    navigator.clipboard.writeText(keyString);
    alert("✅ Key copied!");
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
    }
}

function deleteKey(keyString) {
    if (!confirm(`Delete key ${keyString}?\n\nThis cannot be undone!`)) return;
    
    keysDatabase = keysDatabase.filter(k => k.key !== keyString);
    saveKeysToStorage();
    renderKeysTable();
    updateStats();
}

function filterKeys() {
    renderKeysTable();
}

function refreshKeys() {
    loadKeys();
    renderKeysTable();
    updateStats();
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
    document.getElementById("keyCount").textContent = `${total} key(s) loaded`;
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
    a.download = `agro_ware_keys_${Date.now()}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
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
                    alert(`✅ Imported ${imported.length} keys`);
                }
            } catch (err) {
                alert("❌ Invalid JSON file");
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
    alert("✅ Settings saved");
}

function showGitHubInstructions() {
    alert(
        "To push keys to GitHub:\n\n" +
        "1. Click 'Export Database'\n" +
        "2. Go to your GitHub repo\n" +
        "3. Upload the JSON file as 'keys.json'\n" +
        "4. Commit changes\n\n" +
        "Your client will fetch it automatically!"
    );
}