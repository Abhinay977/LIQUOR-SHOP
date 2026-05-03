// Firebase Configuration
// NOTE: Firebase web API keys are intended to be public (they identify the project,
// not grant admin access). Security is enforced via Firebase Security Rules and
// authorized domains in the Firebase Console (Authentication > Settings > Authorized domains).
const firebaseConfig = {
  apiKey: "AIzaSyDr1PWp6sNdAwe0JfhsPkFT6m8-33XSH9U",
  authDomain: "liquor-shop-c21da.firebaseapp.com",
  projectId: "liquor-shop-c21da",
  storageBucket: "liquor-shop-c21da.firebasestorage.app",
  messagingSenderId: "143928302985",
  appId: "1:143928302985:web:7c1f125445a9d6cd9d5558",
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();
const db = firebase.firestore();

let appData = [];
let historyData = [];
let currentUser = null;
let saveTimeout = null;

let currentSortType = 'default';
let currentFilterType = 'all';

let historySortType = 'default';
let historyFilterType = 'all';

// Auth State Observer
// signInWithPopup is used (not signInWithRedirect) because this app is hosted
// on GitHub Pages, which does NOT support the /__/firebase/init.json endpoint
// that Firebase Hosting provides. signInWithRedirect depends on that endpoint
// and silently stalls/fails on GitHub Pages.
auth.onAuthStateChanged((user) => {
  const loginScreen = document.getElementById("login-screen");
  const appContainer = document.getElementById("app-container");
  const loadingScreen = document.getElementById("loading-screen");

  if (loadingScreen) {
    loadingScreen.classList.add("hidden");
  }

  if (user) {
    currentUser = user;
    loginScreen.classList.add("hidden");
    appContainer.classList.remove("hidden");
    if (typeof updateProfileUI === "function") updateProfileUI(user);
    loadDataFromFirestore();
  } else {
    currentUser = null;
    loginScreen.classList.remove("hidden");
    appContainer.classList.add("hidden");
  }
});

async function loadDataFromFirestore() {
  if (!currentUser) return;
  try {
    const doc = await db.collection("users").doc(currentUser.uid).get();
    if (doc.exists) {
      const data = doc.data();
      appData = data.appData || [];
      historyData = data.historyData || [];
      sanitizeData(appData);
      localStorage.setItem("liquorShopData", JSON.stringify(appData));
      localStorage.setItem("liquorShopHistory", JSON.stringify(historyData));
    } else {
      // First time on cloud, migrate local data if exists
      appData = JSON.parse(localStorage.getItem("liquorShopData")) || [];
      historyData = JSON.parse(localStorage.getItem("liquorShopHistory")) || [];
      sanitizeData(appData);
      if (appData.length === 0) {
        appData.push({
          id: generateId(),
          name: "",
          mrp: { q: "", p: "", n: "" },
          discount: { q: "", p: "", n: "" },
          cost: { q: "", p: "", n: "" },
          qty: { q: "", p: "", n: "" },
          dqty: { q: "", p: "", n: "" },
          extraDiscount: "",
        });
      }
      saveData(true);
    }
    renderTable();
    if (
      !document.getElementById("history-content").classList.contains("hidden")
    ) {
      renderHistoryFeed();
    }
  } catch (error) {
    console.error("Error loading data from Firestore:", error);
    alert(
      "Cloud Sync Error: " +
        error.message +
        "\n\nFalling back to local offline data.",
    );

    // Fallback to local data so the app still works
    appData = JSON.parse(localStorage.getItem("liquorShopData")) || [];
    historyData = JSON.parse(localStorage.getItem("liquorShopHistory")) || [];
    sanitizeData(appData);
    if (appData.length === 0) {
      appData.push({
        id: generateId(),
        name: "",
        mrp: { q: "", p: "", n: "" },
        discount: { q: "", p: "", n: "" },
        cost: { q: "", p: "", n: "" },
        qty: { q: "", p: "", n: "" },
        dqty: { q: "", p: "", n: "" },
      });
    }
    renderTable();
    if (
      !document.getElementById("history-content").classList.contains("hidden")
    ) {
      renderHistoryFeed();
    }
  }
}

// Auth Functions
function updateProfileUI(user) {
  const photoURL =
    user.photoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || "User")}&background=random`;
  const name = user.displayName || "User";
  const email = user.email || "";

  const profileImg = document.getElementById("profile-img");
  const dropdownImg = document.getElementById("dropdown-profile-img");
  if (profileImg) profileImg.src = photoURL;
  if (dropdownImg) dropdownImg.src = photoURL;

  const profileName = document.getElementById("profile-name");
  const profileEmail = document.getElementById("profile-email");
  if (profileName) profileName.textContent = name;
  if (profileEmail) profileEmail.textContent = email;
}

function toggleProfileDropdown() {
  const dropdown = document.getElementById("profile-dropdown");
  if (!dropdown) return;
  if (dropdown.classList.contains("hidden")) {
    dropdown.classList.remove("hidden");
    void dropdown.offsetWidth; // trigger reflow
    dropdown.classList.remove("opacity-0", "scale-95");
    dropdown.classList.add("opacity-100", "scale-100");
  } else {
    dropdown.classList.remove("opacity-100", "scale-100");
    dropdown.classList.add("opacity-0", "scale-95");
    setTimeout(() => dropdown.classList.add("hidden"), 200);
  }
}

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
  const dropdown = document.getElementById("profile-dropdown");
  const profileBtn = document.getElementById("profile-btn");
  if (
    dropdown &&
    !dropdown.classList.contains("hidden") &&
    !dropdown.contains(e.target) &&
    (!profileBtn || !profileBtn.contains(e.target))
  ) {
    dropdown.classList.remove("opacity-100", "scale-100");
    dropdown.classList.add("opacity-0", "scale-95");
    setTimeout(() => dropdown.classList.add("hidden"), 200);
  }

});

function forceSync() {
  saveData(true);
  const btn = document.getElementById("sync-btn");
  if (btn) {
    btn.innerHTML =
      '<i class="fa-solid fa-check text-emerald-500 w-4 text-center"></i> Synced Successfully';
    setTimeout(() => {
      btn.innerHTML =
        '<i class="fa-solid fa-cloud-arrow-up text-indigo-500 w-4 text-center"></i> Sync Data to Cloud';
    }, 2000);
  }
}

function signInWithGoogle() {
  const errorMsg = document.getElementById("login-error-msg");
  errorMsg.textContent = "Opening Google sign-in...";

  // Use signInWithPopup — works on GitHub Pages.
  // signInWithRedirect CANNOT be used here because it requires Firebase Hosting's
  // /__/firebase/init.json endpoint which returns 404 on GitHub Pages.
  auth
    .signInWithPopup(provider)
    .then((result) => {
      errorMsg.textContent = "";
      console.log("Sign-in successful:", result.user.displayName);
    })
    .catch((error) => {
      console.error("Auth Error:", error);
      if (
        error.code === "auth/invalid-api-key" ||
        error.code === "auth/api-key-not-found"
      ) {
        errorMsg.textContent =
          "Configuration Error: API key is invalid. Please check your Firebase project settings.";
      } else if (error.code === "auth/unauthorized-domain") {
        errorMsg.textContent =
          "Unauthorized domain. Please add this domain in Firebase Console \u203a Authentication \u203a Settings \u203a Authorized domains.";
      } else if (error.code === "auth/popup-blocked") {
        errorMsg.textContent =
          "Pop-up was blocked by your browser. Please allow pop-ups for this site and try again.";
      } else if (error.code === "auth/popup-closed-by-user") {
        errorMsg.textContent = "Sign-in was cancelled. Please try again.";
      } else {
        errorMsg.textContent =
          "Sign-in failed: " + (error.message || "Unknown error");
      }
    });
}

function logout() {
  auth.signOut().catch((error) => {
    console.error("Sign-out error:", error);
  });
}

// Utilities
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}
function formatMoney(num) {
  const n = Number(num);
  return isNaN(n) ? '0.00' : n.toFixed(2);
}

function sanitizeData(data) {
  data.forEach((row) => {
    ["mrp", "discount", "cost", "qty", "dqty"].forEach((field) => {
      if (row[field]) {
        ["q", "p", "n"].forEach((size) => {
          if (row[field][size] && parseFloat(row[field][size]) < 0) {
            row[field][size] = Math.abs(
              parseFloat(row[field][size]),
            ).toString();
          }
        });
      }
    });
    if (row.extraDiscount && parseFloat(row.extraDiscount) < 0) {
      row.extraDiscount = Math.abs(parseFloat(row.extraDiscount)).toString();
    }
  });
}

async function saveData(immediate = false) {
  localStorage.setItem("liquorShopData", JSON.stringify(appData));
  localStorage.setItem("liquorShopHistory", JSON.stringify(historyData));

  if (currentUser) {
    clearTimeout(saveTimeout);
    const btn = document.getElementById("sync-btn");

    const saveToCloud = async () => {
      try {
        if (btn && !immediate) {
          btn.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin text-indigo-500 w-4 text-center"></i> Syncing...';
        }

        await db.collection("users").doc(currentUser.uid).set(
          {
            appData: appData,
            historyData: historyData,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

        if (btn && !immediate) {
          btn.innerHTML =
            '<i class="fa-solid fa-check text-emerald-500 w-4 text-center"></i> Auto-saved!';
          setTimeout(() => {
            btn.innerHTML =
              '<i class="fa-solid fa-cloud-arrow-up text-indigo-500 w-4 text-center"></i> Sync Data to Cloud';
          }, 2000);
        }
      } catch (error) {
        console.error("Error saving to Firestore:", error);
        if (btn && !immediate) {
          btn.innerHTML =
            '<i class="fa-solid fa-triangle-exclamation text-red-500 w-4 text-center"></i> Sync Error';
          setTimeout(() => {
            btn.innerHTML =
              '<i class="fa-solid fa-cloud-arrow-up text-indigo-500 w-4 text-center"></i> Sync Data to Cloud';
          }, 2000);
        }
      }
    };

    if (immediate) {
      await saveToCloud();
    } else {
      if (btn)
        btn.innerHTML =
          '<i class="fa-solid fa-clock text-amber-500 w-4 text-center"></i> Waiting to sync...';
      saveTimeout = setTimeout(saveToCloud, 2000);
    }
  }
}

// Core Functions
function addRow() {
  appData.push({
    id: generateId(),
    name: "",
    mrp: { q: "", p: "", n: "" },
    discount: { q: "", p: "", n: "" },
    cost: { q: "", p: "", n: "" },
    qty: { q: "", p: "", n: "" },
    dqty: { q: "", p: "", n: "" },
    extraDiscount: "",
  });
  saveData(true);
  renderTable();
}

function deleteRow(id) {
  if (confirm("Are you sure you want to delete this brand row?")) {
    appData = appData.filter((r) => r.id !== id);
    saveData(true);
    renderTable();
  }
}

function resetData() {
  if (confirm("WARNING: This will delete all your data! Are you sure?")) {
    appData = [];
    saveData(true);
    renderTable();
  }
}

function startNewDay() {
  const dateStr = prompt(
    "Enter a name or date for today's record to save it to History:",
    new Date().toLocaleDateString(),
  );
  if (dateStr === null) return; // Cancelled

  if (
    confirm(
      "Are you sure you want to start a new day?\nThis will save the current data to history and reset all Quantities Sold back to zero.",
    )
  ) {
    // Save Snapshot to History
    const snapshot = JSON.parse(JSON.stringify(appData));
    historyData.push({
      id: generateId(),
      date: dateStr,
      timestamp: Date.now(),
      data: snapshot,
    });

    // Clear Quantities and extra discounts
    appData.forEach((row) => {
      row.qty = { q: "", p: "", n: "" };
      row.dqty = { q: "", p: "", n: "" };
      row.extraDiscount = "";
    });
    saveData(true);
    renderTable();
    alert("Saved to History! Quantities have been reset.");
  }
}

function updateData(id, field, size, value) {
  const row = appData.find((r) => r.id === id);
  if (!row) return;

  // Prevent negative inputs mathematically
  if (field !== "name" && value !== "") {
    const num = parseFloat(value);
    if (num < 0) value = Math.abs(num).toString();
  }

  if (size) {
    row[field][size] = value;
  } else {
    row[field] = value;
  }

  saveData();
  updateRowCalculations(row);
  updateDashboard();
}

// Bargain Calculator Logic
let currentBargainRowId = null;

function openBargainModal(rowId) {
  currentBargainRowId = rowId;
  const row = appData.find((r) => r.id === rowId);
  if (!row) return;

  document.getElementById("bargain-brand-name").textContent =
    "Brand: " + (row.name || "Unnamed Brand");
  document.getElementById("bargain-qty").value = "";
  document.getElementById("bargain-price").value = "";

  const modal = document.getElementById("bargain-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeBargainModal() {
  const modal = document.getElementById("bargain-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  currentBargainRowId = null;

  // If the bargain calc was opened from inside the mobile edit modal,
  // sync the updated extraDiscount value back to the modal input and
  // re-show the mobile edit modal (which was underneath).
  if (mobileEditRowId) {
    const row = appData.find((r) => r.id === mobileEditRowId);
    if (row) {
      const extraEl = document.getElementById('medit-extra');
      if (extraEl) {
        extraEl.value = row.extraDiscount || '';
      }
      mobileEditLiveCalc();
    }
  }
}

function calculateAndAddBargain() {
  if (!currentBargainRowId) return;

  const row = appData.find((r) => r.id === currentBargainRowId);
  if (!row) return;

  const size = document.getElementById("bargain-size").value;
  const qty = parseFloat(document.getElementById("bargain-qty").value) || 0;
  const soldPrice =
    parseFloat(document.getElementById("bargain-price").value) || 0;

  if (qty <= 0) {
    alert("Please enter a valid quantity.");
    return;
  }

  const standardPrice = parseFloat(row.discount[size]) || 0;
  if (standardPrice <= 0) {
    alert("Please enter a standard 'Discount Price' for this size first.");
    return;
  }

  const lossPerBottle = standardPrice - soldPrice;
  const totalLoss = lossPerBottle * qty;

  const currentExtra = parseFloat(row.extraDiscount) || 0;
  const newExtra = parseFloat((currentExtra + totalLoss).toFixed(2));

  // This triggers saveData and recalculation
  updateData(currentBargainRowId, "extraDiscount", null, newExtra);
  closeBargainModal();
  renderTable(); // Force re-render to update the input value
}

function getColorClass(val, baseClasses) {
  if (val > 0) return `${baseClasses} text-emerald-600 dark:text-emerald-400`;
  if (val < 0) return `${baseClasses} text-red-600 dark:text-red-400`;
  return `${baseClasses} text-slate-700 dark:text-slate-300`;
}

function updateRowCalculations(row) {
  let totalMrpProfit = 0;
  let totalDiscProfit = 0;

  ["q", "p", "n"].forEach((size) => {
    const mrp = parseFloat(row.mrp[size]) || 0;
    const disc = parseFloat(row.discount[size]) || 0;
    const cost = parseFloat(row.cost[size]) || 0;
    const qty = parseFloat(row.qty[size]) || 0;
    const dqty = row.dqty ? parseFloat(row.dqty[size]) || 0 : 0;

    totalMrpProfit += (mrp - cost) * qty;
    totalDiscProfit += (disc - cost) * dqty;
  });

  const extraDisc = parseFloat(row.extraDiscount) || 0;
  let brandProfit = totalMrpProfit + totalDiscProfit - extraDisc;

  const tmpEl = document.getElementById(`tmp_total_${row.id}`);
  if (tmpEl) {
    tmpEl.textContent = "₹" + formatMoney(totalMrpProfit);
    tmpEl.className = getColorClass(
      totalMrpProfit,
      "p-3 border-r border-slate-200 dark:border-slate-700 text-right font-bold bg-cyan-50/30 dark:bg-cyan-900/10 whitespace-nowrap",
    );
  }

  const tdpEl = document.getElementById(`tdp_total_${row.id}`);
  if (tdpEl) {
    tdpEl.textContent = "₹" + formatMoney(totalDiscProfit);
    tdpEl.className = getColorClass(
      totalDiscProfit,
      "p-3 border-r border-slate-200 dark:border-slate-700 text-right font-bold bg-emerald-50/30 dark:bg-emerald-900/10 whitespace-nowrap",
    );
  }

  const bpEl = document.getElementById(`bp_${row.id}`);
  if (bpEl) {
    bpEl.textContent = "₹" + formatMoney(brandProfit);
    bpEl.className = getColorClass(
      brandProfit,
      "p-3 border-r border-slate-200 dark:border-slate-700 text-right font-bold bg-amber-50/50 dark:bg-amber-900/20 text-base whitespace-nowrap",
    );
  }
}

function updateDashboard() {
  let totalBrands = appData.length;
  let totalBottles = 0;
  let grandTotalProfit = 0;

  appData.forEach((row) => {
    ["q", "p", "n"].forEach((size) => {
      const mrp = parseFloat(row.mrp[size]) || 0;
      const disc = parseFloat(row.discount[size]) || 0;
      const cost = parseFloat(row.cost[size]) || 0;
      const qty = parseFloat(row.qty[size]) || 0;
      const dqty = row.dqty ? parseFloat(row.dqty[size]) || 0 : 0;

      totalBottles += qty + dqty;
      const tmp = (mrp - cost) * qty;
      const tdp = (disc - cost) * dqty;
      grandTotalProfit += tmp + tdp;
    });
    const extraDisc = parseFloat(row.extraDiscount) || 0;
    grandTotalProfit -= extraDisc;
  });

  document.getElementById("dash-brands").textContent = totalBrands;
  document.getElementById("dash-bottles").textContent = totalBottles;

  const dashProfit = document.getElementById("dash-profit");
  dashProfit.textContent = "₹" + formatMoney(grandTotalProfit);
  dashProfit.className = `text-2xl font-bold ${grandTotalProfit > 0 ? "text-emerald-600 dark:text-emerald-400" : grandTotalProfit < 0 ? "text-red-600 dark:text-red-400" : "text-slate-800 dark:text-slate-200"}`;
}

// Rendering logic
function initHeaders() {
  const subHeaders = document.getElementById("sub-headers");
  let html = "";

  // Generate 7 groups of Q, P, N
  const groups = [
    { bg: "bg-blue-50/50 dark:bg-blue-900/10" },
    { bg: "bg-pink-50/50 dark:bg-pink-900/10" },
    { bg: "bg-orange-50/50 dark:bg-orange-900/10" },
    { bg: "bg-purple-50/50 dark:bg-purple-900/10" },
    { bg: "bg-indigo-50/50 dark:bg-indigo-900/10" },
  ];

  groups.forEach((g) => {
    ["Q", "P", "N"].forEach((size, index) => {
      const borderClass =
        index === 2
          ? "border-r-2 border-slate-400 dark:border-slate-500"
          : "border-r border-slate-300 dark:border-slate-600";
      html += `<th class="p-2 border-b border-slate-300 dark:border-slate-600 w-20 text-center ${borderClass} ${g.bg}">${size}</th>`;
    });
  });

  subHeaders.innerHTML = html;
}

// --- NEW HELPER FUNCTIONS FOR SORTING/FILTERING ---
function calculateBrandProfit(row) {
    let totalMrpProfit = 0;
    let totalDiscProfit = 0;
    ['q', 'p', 'n'].forEach(size => {
        const mrp = parseFloat(row.mrp?.[size]) || 0;
        const disc = parseFloat(row.discount?.[size]) || 0;
        const cost = parseFloat(row.cost?.[size]) || 0;
        const qty = parseFloat(row.qty?.[size]) || 0;
        const dqty = row.dqty ? (parseFloat(row.dqty[size]) || 0) : 0;
        totalMrpProfit += (mrp - cost) * qty;
        totalDiscProfit += (disc - cost) * dqty;
    });
    const extraDisc = parseFloat(row.extraDiscount) || 0;
    return totalMrpProfit + totalDiscProfit - extraDisc;
}

function calculateTotalSales(row) {
    let totalSales = 0;
    ['q', 'p', 'n'].forEach(size => {
        const qty = parseFloat(row.qty?.[size]) || 0;
        const dqty = row.dqty ? (parseFloat(row.dqty[size]) || 0) : 0;
        totalSales += qty + dqty;
    });
    return totalSales;
}

function getTopBrands(data) {
    const sorted = [...data].sort((a, b) => calculateBrandProfit(b) - calculateBrandProfit(a));
    const top = {};
    let rank = 1;
    for (let i = 0; i < sorted.length; i++) {
        if (rank > 3) break;
        const profit = calculateBrandProfit(sorted[i]);
        if (profit > 0) {
            top[sorted[i].id] = rank;
            rank++;
        } else {
            break; // Don't rank zero or negative profit brands
        }
    }
    return top;
}

function getFilteredAndSortedData() {
    const searchTerm = (document.getElementById('search-input')?.value || '').toLowerCase();
    
    // Filter
    let result = appData.filter(row => {
        if (searchTerm && !(row.name || '').toLowerCase().includes(searchTerm)) return false;
        
        if (currentFilterType === 'profit') {
            return calculateBrandProfit(row) > 0;
        } else if (currentFilterType === 'loss') {
            return calculateBrandProfit(row) < 0;
        } else if (currentFilterType === 'sales') {
            return calculateTotalSales(row) > 10;
        }
        return true;
    });

    // Sort
    if (currentSortType === 'profit-high') {
        result.sort((a, b) => calculateBrandProfit(b) - calculateBrandProfit(a));
    } else if (currentSortType === 'profit-low') {
        result.sort((a, b) => calculateBrandProfit(a) - calculateBrandProfit(b));
    } else if (currentSortType === 'name-asc') {
        result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    return result;
}

function setFilter(type) {
    currentFilterType = type;
    
    // Update button styles
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm', 'border-indigo-600', 'active-filter');
        btn.classList.add('bg-white', 'dark:bg-darkCard', 'border', 'border-slate-200', 'dark:border-slate-700', 'hover:bg-slate-50', 'dark:hover:bg-slate-800');
        
        // Restore text colors for unselected
        if (btn.id === 'filter-profit') { btn.classList.add('text-emerald-600', 'dark:text-emerald-400'); btn.classList.remove('text-white'); }
        if (btn.id === 'filter-loss') { btn.classList.add('text-red-600', 'dark:text-red-400'); btn.classList.remove('text-white'); }
        if (btn.id === 'filter-sales') { btn.classList.add('text-amber-600', 'dark:text-amber-400'); btn.classList.remove('text-white'); }
        if (btn.id === 'filter-all') { btn.classList.add('text-slate-700', 'dark:text-slate-300'); btn.classList.remove('text-white'); }
    });

    const activeBtn = document.getElementById('filter-' + type);
    if (activeBtn) {
        // Remove individual colors so white text applies
        if (type === 'profit') activeBtn.classList.remove('text-emerald-600', 'dark:text-emerald-400');
        if (type === 'loss') activeBtn.classList.remove('text-red-600', 'dark:text-red-400');
        if (type === 'sales') activeBtn.classList.remove('text-amber-600', 'dark:text-amber-400');
        if (type === 'all') activeBtn.classList.remove('text-slate-700', 'dark:text-slate-300');
        
        activeBtn.className = `filter-btn active-filter px-4 py-1.5 rounded-full text-sm font-semibold transition-colors bg-indigo-600 border-indigo-600 text-white shadow-sm whitespace-nowrap`;
        if (type === 'profit') activeBtn.id = 'filter-profit';
        if (type === 'loss') activeBtn.id = 'filter-loss';
        if (type === 'sales') activeBtn.id = 'filter-sales';
        if (type === 'all') activeBtn.id = 'filter-all';
    }
    
    renderTable();
}

function applySortAndFilter() {
    currentSortType = document.getElementById('sort-dropdown').value;

    const label = document.getElementById("active-sort-label");
    if (label) {
        if (currentSortType === "profit-high") {
            label.textContent = "Sorted by: Highest Profit";
        } else if (currentSortType === "profit-low") {
            label.textContent = "Sorted by: Lowest Profit";
        } else if (currentSortType === "name-asc") {
            label.textContent = "Sorted by: Name A → Z";
        } else {
            label.textContent = "";
        }
    }

    renderTable();
}

function generateSmartInsights(data) {
    let insights = [];

    if (!data || data.length === 0) return insights;

    // 1. BEST SELLING BRAND
    let bestBrand = null;
    let maxSales = 0;

    data.forEach(row => {
        let totalSales = calculateTotalSales(row);
        if (totalSales > maxSales) {
            maxSales = totalSales;
            bestBrand = row;
        }
    });

    if (bestBrand && maxSales > 0) {
        insights.push(`🔥 Best Seller: ${bestBrand.name || "Unnamed Brand"} (${maxSales} bottles sold)`);
    }

    // 2. LOSS DETECTION (Advanced)
    data.forEach(row => {
        let profit = calculateBrandProfit(row);
        if (profit < -100) { // ignore small fluctuations
            insights.push(`⚠️ ${row.name || "Unnamed Brand"} is in LOSS (₹${profit.toFixed(0)})`);
        }
    });

    // 3. PRICE OPTIMIZATION (Advanced)
    data.forEach(row => {
        ['q','p','n'].forEach(size => {
            let cost = parseFloat(row.cost?.[size]) || 0;
            let discount = parseFloat(row.discount?.[size]) || 0;

            if (discount < cost && discount !== 0) {
                let margin = 15; // 15₹ profit target
                let suggested = (cost + margin).toFixed(0);
                insights.push(`💡 ${row.name || "Unnamed Brand"}: Increase ${size.toUpperCase()} price to ₹${suggested}`);
            }
        });
    });

    // 4. HIGH PROFIT HIGHLIGHT
    data.forEach(row => {
        let profit = calculateBrandProfit(row);
        if (profit > 500) {
            insights.push(`🚀 ${row.name || "Unnamed Brand"} is highly profitable (₹${profit.toFixed(0)})`);
        }
    });

    return insights;
}

function updateInsights(data) {
    const el = document.getElementById("insight-box");
    if (!el) return;

    const insights = generateSmartInsights(data);

    if (insights.length === 0) {
        el.textContent = "✅ All brands performing well";
        return;
    }

    el.innerHTML = insights.map(i => {
        if (i.includes("LOSS")) return `<div class="text-red-500 dark:text-red-400">• ${i}</div>`;
        if (i.includes("Best Seller")) return `<div class="text-emerald-500 dark:text-emerald-400">• ${i}</div>`;
        if (i.includes("Increase")) return `<div class="text-orange-500 dark:text-orange-400">• ${i}</div>`;
        if (i.includes("profitable")) return `<div class="text-blue-500 dark:text-blue-400">• ${i}</div>`;
        return `<div>• ${i}</div>`;
    }).join('');
}

function getProcessedHistoryData(data) {
    let result = [...data];

    // FILTER
    if (historyFilterType === 'profit') {
        result = result.filter(row => calculateBrandProfit(row) > 0);
    } else if (historyFilterType === 'loss') {
        result = result.filter(row => calculateBrandProfit(row) < 0);
    } else if (historyFilterType === 'sales') {
        result = result.filter(row => calculateTotalSales(row) > 10);
    }

    // SORT
    if (historySortType === 'profit-high') {
        result.sort((a, b) => calculateBrandProfit(b) - calculateBrandProfit(a));
    } else if (historySortType === 'profit-low') {
        result.sort((a, b) => calculateBrandProfit(a) - calculateBrandProfit(b));
    } else if (historySortType === 'name-asc') {
        result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    return result;
}

function setHistoryFilter(type) {
    historyFilterType = type;
    
    // Update button styles
    document.querySelectorAll('.hfilter-btn').forEach(btn => {
        btn.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm', 'border-indigo-600', 'active-filter');
        btn.classList.add('bg-white', 'dark:bg-darkCard', 'border', 'border-slate-200', 'dark:border-slate-700', 'hover:bg-slate-50', 'dark:hover:bg-slate-800');
        
        // Restore text colors for unselected
        if (btn.id === 'hfilter-profit') { btn.classList.add('text-emerald-600', 'dark:text-emerald-400'); btn.classList.remove('text-white'); }
        if (btn.id === 'hfilter-loss') { btn.classList.add('text-red-600', 'dark:text-red-400'); btn.classList.remove('text-white'); }
        if (btn.id === 'hfilter-sales') { btn.classList.add('text-amber-600', 'dark:text-amber-400'); btn.classList.remove('text-white'); }
        if (btn.id === 'hfilter-all') { btn.classList.add('text-slate-700', 'dark:text-slate-300'); btn.classList.remove('text-white'); }
    });

    const activeBtn = document.getElementById('hfilter-' + type);
    if (activeBtn) {
        // Remove individual colors so white text applies
        if (type === 'profit') activeBtn.classList.remove('text-emerald-600', 'dark:text-emerald-400');
        if (type === 'loss') activeBtn.classList.remove('text-red-600', 'dark:text-red-400');
        if (type === 'sales') activeBtn.classList.remove('text-amber-600', 'dark:text-amber-400');
        if (type === 'all') activeBtn.classList.remove('text-slate-700', 'dark:text-slate-300');
        
        activeBtn.className = `hfilter-btn active-filter px-3 py-1.5 rounded-full text-sm font-semibold transition-colors bg-indigo-600 border border-indigo-600 text-white shadow-sm whitespace-nowrap`;
        if (type === 'profit') activeBtn.id = 'hfilter-profit';
        if (type === 'loss') activeBtn.id = 'hfilter-loss';
        if (type === 'sales') activeBtn.id = 'hfilter-sales';
        if (type === 'all') activeBtn.id = 'hfilter-all';
    }
    
    renderHistoryFeed();
}

function setHistorySort(type) {
    historySortType = type;
    renderHistoryFeed();
}
// --- END HELPER FUNCTIONS ---

function renderTable() {
  const tbody = document.getElementById("table-body");
  tbody.style.opacity = "0.3";
  setTimeout(() => {
    tbody.style.opacity = "1";
  }, 150);
  tbody.innerHTML = "";

  const displayData = getFilteredAndSortedData();
  const topBrands = getTopBrands(appData); // compute top 3 from full data
  
  updateInsights(displayData);

  if (displayData.length === 0) {
      tbody.innerHTML = `
          <tr>
              <td colspan="100%" class="text-center py-6 text-slate-400">
                  No data found for selected filter
              </td>
          </tr>
      `;
      updateDashboard();
      renderCardList();
      return;
  }

  displayData.forEach((row) => {
    if (!row.dqty) row.dqty = { q: "", p: "", n: "" };
    
    const rank = topBrands[row.id];
    let highlightClass = "hover:bg-slate-50 dark:hover:bg-slate-800/50";
    let badgeHtml = "";
    
    if (rank === 1) {
        highlightClass = "bg-gradient-to-r from-yellow-100 to-yellow-50 dark:from-yellow-900/30 dark:to-yellow-900/10 ring-2 ring-yellow-400 scale-[1.01]";
        badgeHtml = `<div class="absolute -top-2 -left-2 bg-gradient-to-r from-yellow-400 to-yellow-600 text-yellow-900 text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow z-20">🥇 TOP 1</div>`;
    } else if (rank === 2) {
        highlightClass = "bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700 ring-1 ring-slate-400";
        badgeHtml = `<div class="absolute -top-2 -left-2 bg-gradient-to-r from-slate-200 to-slate-400 text-slate-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow z-20">🥈 TOP 2</div>`;
    } else if (rank === 3) {
        highlightClass = "bg-gradient-to-r from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-900/10 ring-1 ring-orange-300";
        badgeHtml = `<div class="absolute -top-2 -left-2 bg-gradient-to-r from-orange-200 to-orange-400 text-orange-900 text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow z-20">🥉 TOP 3</div>`;
    }

    const tr = document.createElement("tr");
    tr.className = `${highlightClass} hover:scale-[1.01] transition-all duration-200 group relative`;

    const renderInput = (field, size, isLast) => `
                    <td class="p-1 ${isLast ? "border-r-2 border-slate-400 dark:border-slate-500" : "border-r border-slate-200 dark:border-slate-700"}">
                        <input type="text" inputmode="decimal" value="${row[field][size]}" oninput="this.value = this.value.replace(/[^0-9.]/g, '').replace(/(\\..*?)\\..*/g, '$1'); updateData('${row.id}', '${field}', '${size}', this.value)" 
                        class="w-full min-w-[65px] text-right p-1.5 bg-white dark:bg-darkBg border border-slate-300 dark:border-slate-600 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm transition-all shadow-inner">
                    </td>
                `;

    const renderOutput = (prefix, size, isLast) => `
                    <td id="${prefix}_${size}_${row.id}" class="p-2 ${isLast ? "border-r-2 border-slate-400 dark:border-slate-500" : "border-r border-slate-200 dark:border-slate-700"} text-right font-medium">0.00</td>
                `;

    tr.innerHTML = `
                    <td class="sticky-col bg-white dark:bg-darkCard p-0.5 md:p-1 border-r border-slate-300 dark:border-slate-600 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] group-hover:bg-slate-50 dark:group-hover:bg-slate-800/80 transition-colors z-10 relative">
                        ${badgeHtml}
                        <input type="text" value="${row.name}" placeholder="Brand" oninput="updateData('${row.id}', 'name', null, this.value)" 
                        class="w-[60px] md:w-full md:min-w-[120px] p-1 md:p-2 bg-white dark:bg-darkBg border border-slate-300 dark:border-slate-600 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-medium transition-all shadow-inner text-xs md:text-sm">
                    </td>
                    
                    ${renderInput("mrp", "q", false)}
                    ${renderInput("mrp", "p", false)}
                    ${renderInput("mrp", "n", true)}
                    
                    ${renderInput("discount", "q", false)}
                    ${renderInput("discount", "p", false)}
                    ${renderInput("discount", "n", true)}
                    
                    ${renderInput("cost", "q", false)}
                    ${renderInput("cost", "p", false)}
                    ${renderInput("cost", "n", true)}
                    
                    ${renderInput("qty", "q", false)}
                    ${renderInput("qty", "p", false)}
                    ${renderInput("qty", "n", true)}
                    
                    ${renderInput("dqty", "q", false)}
                    ${renderInput("dqty", "p", false)}
                    ${renderInput("dqty", "n", true)}
                    
                    <td id="tmp_total_${row.id}" class="p-3 border-r border-slate-200 dark:border-slate-700 text-right font-bold bg-cyan-50/30 dark:bg-cyan-900/10 whitespace-nowrap">₹0.00</td>
                    <td id="tdp_total_${row.id}" class="p-3 border-r border-slate-200 dark:border-slate-700 text-right font-bold bg-emerald-50/30 dark:bg-emerald-900/10 whitespace-nowrap">₹0.00</td>
                    
                    <td class="p-1 border-r border-slate-200 dark:border-slate-700 bg-red-50/20 dark:bg-red-900/10">
                        <div class="relative w-full flex items-center">
                            <input type="text" inputmode="decimal" value="${row.extraDiscount || ""}" placeholder="0" oninput="this.value = this.value.replace(/[^0-9.]/g, '').replace(/(\\..*?)\\..*/g, '$1'); updateData('${row.id}', 'extraDiscount', null, this.value)" 
                            class="w-full min-w-[75px] text-right p-1.5 pr-7 bg-white dark:bg-darkBg border border-slate-300 dark:border-slate-600 rounded focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none text-sm transition-all shadow-inner text-red-600 dark:text-red-400 font-medium placeholder:text-red-300 dark:placeholder:text-red-800">
                            
                            <button onclick="openBargainModal('${row.id}')" title="Bargain Calculator" class="absolute right-1 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors z-10">
                                <i class="fa-solid fa-calculator text-[11px]"></i>
                            </button>
                        </div>
                    </td>
                    
                    <td id="bp_${row.id}" class="p-3 border-r border-slate-200 dark:border-slate-700 text-right font-bold bg-amber-50/30 dark:bg-amber-900/10 text-base text-amber-700 dark:text-amber-500 whitespace-nowrap">₹0.00</td>
                    
                    <td class="p-2 text-center bg-white dark:bg-darkCard group-hover:bg-slate-50 dark:group-hover:bg-slate-800/80 transition-colors">
                        <button onclick="deleteRow('${row.id}')" class="text-slate-400 hover:text-red-500 transition-colors p-2 rounded hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete Row">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                `;
    tbody.appendChild(tr);
    updateRowCalculations(row);
  });
  updateDashboard();
  renderCardList();
}

// Features
function filterTable() {
    // Instead of hiding rows, we rely on our getFilteredAndSortedData()
    // which applies the search term automatically. We just trigger a re-render.
    renderTable();
}

function toggleDarkMode() {
  document.documentElement.classList.toggle("dark");
  const isDark = document.documentElement.classList.contains("dark");
  localStorage.setItem("liquorDarkMode", isDark ? "1" : "0");
}

function toggleHistoryMode() {
  const mainApp = document.getElementById("main-app-content");
  const historyApp = document.getElementById("history-content");

  if (mainApp.classList.contains("hidden")) {
    mainApp.classList.remove("hidden");
    historyApp.classList.add("hidden");
    historyApp.style.display = "";
  } else {
    mainApp.classList.add("hidden");
    historyApp.classList.remove("hidden");
    historyApp.style.display = "flex";
    renderHistoryFeed();
  }
}

function renderHistoryFeed() {
  const feed = document.getElementById("history-feed");
  const emptyState = document.getElementById("history-empty-state");

  if (historyData.length === 0) {
    feed.innerHTML = "";
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");
  let feedHtml = "";

  const reversed = [...historyData].reverse();

  reversed.forEach((record) => {
    const processedData = getProcessedHistoryData(record.data);
    
    if (processedData.length === 0) {
        return; // skip this record completely if no data matches the filter
    }

    const topBrands = getTopBrands(processedData);

    let totalBrands = processedData.length;
    let totalBottles = 0;
    let grandTotalProfit = 0;

    // pre-calculate summary
    processedData.forEach((row) => {
      ["q", "p", "n"].forEach((s) => {
        const m = parseFloat(row.mrp[s]) || 0;
        const d = parseFloat(row.discount[s]) || 0;
        const c = parseFloat(row.cost[s]) || 0;
        const q = parseFloat(row.qty[s]) || 0;
        const dq = row.dqty ? parseFloat(row.dqty[s]) || 0 : 0;
        totalBottles += q + dq;
        grandTotalProfit += (m - c) * q + (d - c) * dq;
      });
      const extraDisc = parseFloat(row.extraDiscount) || 0;
      grandTotalProfit -= extraDisc;
    });

    const profitClass =
      grandTotalProfit > 0
        ? "text-emerald-600 dark:text-emerald-400"
        : grandTotalProfit < 0
          ? "text-red-600 dark:text-red-400"
          : "text-slate-800 dark:text-slate-200";
    const timeStr = new Date(record.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Build Table HTML
    let tableHtml = `
                <div id="table_${record.id}" class="mt-4 overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg" style="display:none">
                <table class="min-w-max w-full text-sm text-left border-collapse">
                    <thead class="text-xs uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-b border-slate-300 dark:border-slate-600">
                        <tr>
                            <th rowspan="2" class="sticky-col bg-slate-100 dark:bg-slate-800 p-1 md:p-2 border-r border-b border-slate-300 dark:border-slate-600 whitespace-nowrap">Brand</th>
                            <th colspan="3" class="text-center p-2 border-r border-b border-slate-300 dark:border-slate-600 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300">MRP</th>
                            <th colspan="3" class="text-center p-2 border-r border-b border-slate-300 dark:border-slate-600 bg-pink-50 dark:bg-pink-900/20 text-pink-800 dark:text-pink-300">Discount</th>
                            <th colspan="3" class="text-center p-2 border-r border-b border-slate-300 dark:border-slate-600 bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300">Buying Cost</th>
                            <th colspan="3" class="text-center p-2 border-r border-b border-slate-300 dark:border-slate-600 bg-purple-50 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300">MRP QTY SOLD</th>
                            <th colspan="3" class="text-center p-2 border-r border-b border-slate-300 dark:border-slate-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-300">DISCOUNT QTY SOLD</th>
                            <th rowspan="2" class="text-center p-2 border-r border-b border-slate-300 dark:border-slate-600 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-800 dark:text-cyan-300">TOTAL MRP PROFIT</th>
                            <th rowspan="2" class="text-center p-2 border-r border-b border-slate-300 dark:border-slate-600 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300">TOTAL DISCOUNT PROFIT</th>
                            <th rowspan="2" class="text-center p-2 border-r border-b border-slate-300 dark:border-slate-600 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 font-bold">EXTRA BARGAIN</th>
                            <th rowspan="2" class="text-center p-2 border-b border-slate-300 dark:border-slate-600 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300">Brand Profit</th>
                        </tr>
                        <tr>
                `;

    const groups = [
      { bg: "bg-blue-50/50 dark:bg-blue-900/10" },
      { bg: "bg-pink-50/50 dark:bg-pink-900/10" },
      { bg: "bg-orange-50/50 dark:bg-orange-900/10" },
      { bg: "bg-purple-50/50 dark:bg-purple-900/10" },
      { bg: "bg-indigo-50/50 dark:bg-indigo-900/10" },
    ];
    groups.forEach((g) => {
      ["Q", "P", "N"].forEach((size, idx) => {
        const bClass =
          idx === 2
            ? "border-r-2 border-slate-400 dark:border-slate-500"
            : "border-r border-slate-300 dark:border-slate-600";
        tableHtml += `<th class="p-1 border-b border-slate-300 dark:border-slate-600 w-16 text-center ${bClass} ${g.bg}">${size}</th>`;
      });
    });
    tableHtml += `</tr></thead><tbody class="divide-y divide-slate-200 dark:divide-slate-700">`;

    processedData.forEach((row) => {
      let bp = 0;
      let totalMrp = 0,
        totalDisc = 0;
      ["q", "p", "n"].forEach((s) => {
        const m = parseFloat(row.mrp[s]) || 0;
        const d = parseFloat(row.discount[s]) || 0;
        const c = parseFloat(row.cost[s]) || 0;
        const q = parseFloat(row.qty[s]) || 0;
        const dq = row.dqty ? parseFloat(row.dqty[s]) || 0 : 0;
        totalMrp += (m - c) * q;
        totalDisc += (d - c) * dq;
      });
      const extraDisc = parseFloat(row.extraDiscount) || 0;
      bp = totalMrp + totalDisc - extraDisc;

      const tdText = (val, isLast) =>
        `<td class="p-1 ${isLast ? "border-r-2 border-slate-400 dark:border-slate-500" : "border-r border-slate-200 dark:border-slate-700"} text-right">${val || ""}</td>`;
      const tdMoney = (val, colorClass) =>
        `<td class="p-2 border-r border-slate-200 dark:border-slate-700 text-right font-bold ${getColorClass(val, colorClass)} whitespace-nowrap">₹${formatMoney(val)}</td>`;
      const tdRedMoney = (val) =>
        `<td class="p-2 border-r border-slate-200 dark:border-slate-700 text-right font-bold text-red-600 dark:text-red-400 bg-red-50/20 dark:bg-red-900/10 whitespace-nowrap">₹${formatMoney(val)}</td>`;

      const rank = topBrands[row.id];
      let highlightClass = "hover:bg-slate-50 dark:hover:bg-slate-800/50";
      let badgeHtml = "";
      
      if (rank === 1) {
          highlightClass = "bg-gradient-to-r from-yellow-100 to-yellow-50 dark:from-yellow-900/30 dark:to-yellow-900/10 ring-2 ring-yellow-400 scale-[1.01]";
          badgeHtml = `<div class="absolute -top-2 -left-2 bg-gradient-to-r from-yellow-400 to-yellow-600 text-yellow-900 text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow z-20">🥇 TOP 1</div>`;
      } else if (rank === 2) {
          highlightClass = "bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700 ring-1 ring-slate-400";
          badgeHtml = `<div class="absolute -top-2 -left-2 bg-gradient-to-r from-slate-200 to-slate-400 text-slate-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow z-20">🥈 TOP 2</div>`;
      } else if (rank === 3) {
          highlightClass = "bg-gradient-to-r from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-900/10 ring-1 ring-orange-300";
          badgeHtml = `<div class="absolute -top-2 -left-2 bg-gradient-to-r from-orange-200 to-orange-400 text-orange-900 text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow z-20">🥉 TOP 3</div>`;
      }

      tableHtml += `<tr class="${highlightClass} hover:scale-[1.01] transition-all duration-200 group relative">
                        <td class="sticky-col bg-white dark:bg-darkCard p-1 md:p-2 border-r border-slate-200 dark:border-slate-700 font-bold z-10 text-[10px] md:text-xs truncate max-w-[60px] md:max-w-[120px] relative" title="${row.name || "-"}">${badgeHtml}${row.name || "-"}</td>
                        ${tdText(row.mrp.q, false)}${tdText(row.mrp.p, false)}${tdText(row.mrp.n, true)}
                        ${tdText(row.discount.q, false)}${tdText(row.discount.p, false)}${tdText(row.discount.n, true)}
                        ${tdText(row.cost.q, false)}${tdText(row.cost.p, false)}${tdText(row.cost.n, true)}
                        ${tdText(row.qty.q, false)}${tdText(row.qty.p, false)}${tdText(row.qty.n, true)}
                        ${tdText(row.dqty ? row.dqty.q : "", false)}${tdText(row.dqty ? row.dqty.p : "", false)}${tdText(row.dqty ? row.dqty.n : "", true)}
                        ${tdMoney(totalMrp, "bg-cyan-50/30 dark:bg-cyan-900/10")}
                        ${tdMoney(totalDisc, "bg-emerald-50/30 dark:bg-emerald-900/10")}
                        ${tdRedMoney(extraDisc)}
                        ${tdMoney(bp, "font-bold bg-amber-50/50 dark:bg-amber-900/20")}
                    </tr>`;
    });
    // Build mobile brand card list (mobile only)
    let mobileBrandsHtml = `<div id="mobile_brands_${record.id}" class="mobile-history-brands" style="display:none">`;
    processedData.forEach((row) => {
      let rowMrp = 0, rowDisc = 0, rowBottles = 0;
      ['q','p','n'].forEach((s) => {
        const m = parseFloat(row.mrp?.[s])      || 0;
        const d = parseFloat(row.discount?.[s]) || 0;
        const c = parseFloat(row.cost?.[s])     || 0;
        const q = parseFloat(row.qty?.[s])      || 0;
        const dq = parseFloat(row.dqty?.[s])    || 0;
        rowMrp  += (m - c) * q;
        rowDisc += (d - c) * dq;
        rowBottles += q + dq;
      });
      const rowExtra = parseFloat(row.extraDiscount) || 0;
      const rowBp = rowMrp + rowDisc - rowExtra;
      const rowProfitColor = rowBp > 0 ? 'color:#059669' : rowBp < 0 ? 'color:#dc2626' : 'color:#64748b';
      
      const rank = topBrands[row.id];
      let cardStyle = "";
      let badgeHtml = "";
      
      if (rank === 1) {
          cardStyle = "bg-gradient-to-r from-yellow-100 to-yellow-50 dark:from-yellow-900/30 dark:to-yellow-900/10 ring-2 ring-yellow-400 scale-[1.01]";
          badgeHtml = `<div class="absolute -top-2 -left-2 bg-gradient-to-r from-yellow-400 to-yellow-600 text-yellow-900 text-[10px] font-extrabold px-2 py-0.5 rounded shadow z-10">🥇 TOP 1</div>`;
      } else if (rank === 2) {
          cardStyle = "bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700 ring-1 ring-slate-400";
          badgeHtml = `<div class="absolute -top-2 -left-2 bg-gradient-to-r from-slate-200 to-slate-400 text-slate-800 text-[10px] font-extrabold px-2 py-0.5 rounded shadow z-10">🥈 TOP 2</div>`;
      } else if (rank === 3) {
          cardStyle = "bg-gradient-to-r from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-900/10 ring-1 ring-orange-300";
          badgeHtml = `<div class="absolute -top-2 -left-2 bg-gradient-to-r from-orange-200 to-orange-400 text-orange-900 text-[10px] font-extrabold px-2 py-0.5 rounded shadow z-10">🥉 TOP 3</div>`;
      }

      mobileBrandsHtml += `
        <div class="mobile-brand-card relative ${cardStyle} hover:scale-[1.01] transition-all duration-200" onclick="openHistoryBrandModal('${record.id}', '${row.id}')">
          ${badgeHtml}
          <div class="mobile-card-icon"><i class="fa-solid fa-wine-bottle"></i></div>
          <div class="mobile-card-body">
            <div class="mobile-card-name">${row.name || 'Unnamed Brand'}</div>
            <div class="mobile-card-meta">${rowBottles} bottle${rowBottles !== 1 ? 's' : ''} sold</div>
          </div>
          <div class="mobile-card-profit" style="${rowProfitColor}">₹${formatMoney(rowBp)}</div>
          <div class="mobile-card-edit-btn" style="cursor:pointer"><i class="fa-solid fa-eye"></i></div>
        </div>`;
    });
    mobileBrandsHtml += `</div>`;

    tableHtml += `</tbody></table></div>`;

    feedHtml += `
                <div class="bg-white dark:bg-darkCard p-5 rounded-xl shadow border border-slate-200 dark:border-darkBorder flex flex-col gap-4 border-l-4 border-indigo-500 pl-4">
                    <div class="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-lg">
                                <i class="fa-solid fa-calendar-check"></i>
                            </div>
                            <div>
                                <h3 class="text-lg font-bold bg-indigo-100 dark:bg-indigo-900/30 px-3 py-1 rounded-lg inline-block text-indigo-800 dark:text-indigo-200">${record.date}</h3>
                                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1"><i class="fa-regular fa-clock"></i> ${timeStr}</p>
                            </div>
                        </div>
                        <div class="flex gap-2 relative">
                            <button onclick="toggleHistoryDetails('${record.id}')" class="px-3 py-1.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm font-medium flex items-center gap-2">
                                <i class="fa-solid fa-table"></i> <span>View Details</span>
                            </button>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">Brands</p>
                            <p class="text-xl font-bold text-slate-700 dark:text-slate-300">${totalBrands}</p>
                        </div>
                        <div>
                            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">Bottles Sold</p>
                            <p class="text-xl font-bold text-amber-600 dark:text-amber-500">${totalBottles}</p>
                        </div>
                        <div>
                            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">Grand Profit</p>
                            <p class="text-xl font-bold ${profitClass}">₹${formatMoney(grandTotalProfit)}</p>
                        </div>
                    </div>
                    
                    ${tableHtml}
                    ${mobileBrandsHtml}
                </div>
                `;
  });

  feed.innerHTML = feedHtml;

  if (!feedHtml.trim()) {
      emptyState.classList.remove("hidden");
  } else {
      emptyState.classList.add("hidden");
  }
}


/**
 * Toggles history detail view: shows mobile brand cards on mobile,
 * wide table on desktop.
 */
function toggleHistoryDetails(recordId) {
  const isMobile = window.innerWidth < 768;
  const tableDiv  = document.getElementById(`table_${recordId}`);
  const mobileDiv = document.getElementById(`mobile_brands_${recordId}`);
  if (isMobile) {
    if (!mobileDiv) return;
    mobileDiv.style.display = mobileDiv.style.display === 'none' ? 'flex' : 'none';
  } else {
    if (!tableDiv) return;
    tableDiv.style.display = tableDiv.style.display === 'none' ? 'block' : 'none';
  }
}

// Store reference to currently-open history brand for the view modal
let _histBrandRecord = null;
let _histBrandRow    = null;

/**
 * Opens a read-only bottom-sheet showing all field values for a historical brand entry.
 */
function openHistoryBrandModal(recordId, rowId) {
  const record = historyData.find((r) => r.id === recordId);
  if (!record) return;
  const row = record.data.find((r) => r.id === rowId);
  if (!row) return;
  _histBrandRecord = record;
  _histBrandRow    = row;

  // Header
  const el = (id) => document.getElementById(id);
  el('hbm-title').textContent = row.name || 'Unnamed Brand';
  el('hbm-date').textContent  = record.date;

  // Helper to set read-only display value (handles 0 correctly)
  const sv = (id, val) => {
    const e = el(id);
    if (e) e.textContent = (val !== '' && val !== null && val !== undefined) ? val : '—';
  };

  ['q','p','n'].forEach((s) => {
    sv(`hbm-mrp-${s}`,      row.mrp      ? (row.mrp[s]      ?? '') : '');
    sv(`hbm-discount-${s}`, row.discount ? (row.discount[s] ?? '') : '');
    sv(`hbm-cost-${s}`,     row.cost     ? (row.cost[s]     ?? '') : '');
    sv(`hbm-qty-${s}`,      row.qty      ? (row.qty[s]      ?? '') : '');
    sv(`hbm-dqty-${s}`,     row.dqty     ? (row.dqty[s]     ?? '') : '');
  });
  sv('hbm-extra', row.extraDiscount ?? '0');

  // Compute profits — null-safe field access for old records
  let totalMrp = 0, totalDisc = 0;
  ['q','p','n'].forEach((s) => {
    const m = parseFloat(row.mrp?.[s])  || 0;
    const d = parseFloat(row.discount?.[s]) || 0;
    const c = parseFloat(row.cost?.[s]) || 0;
    const q = parseFloat(row.qty?.[s])  || 0;
    const dq = parseFloat(row.dqty?.[s]) || 0;
    totalMrp  += (m - c) * q;
    totalDisc += (d - c) * dq;
  });
  const extra = parseFloat(row.extraDiscount) || 0;
  const brand = totalMrp + totalDisc - extra;
  const colorFn = (v) => v > 0 ? '#059669' : v < 0 ? '#dc2626' : '#64748b';

  const setMoney = (id, val) => {
    const e = el(id); if (!e) return;
    e.textContent  = '₹' + formatMoney(val);
    e.style.color  = colorFn(val);
  };
  setMoney('hbm-result-mrp',   totalMrp);
  setMoney('hbm-result-disc',  totalDisc);
  setMoney('hbm-result-brand', brand);

  // Show modal
  const modal = document.getElementById('history-brand-modal');
  const sheet = document.getElementById('history-modal-sheet');
  sheet.classList.remove('closing');
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

/**
 * Closes the history brand view modal.
 */
function closeHistoryBrandModal() {
  const modal = document.getElementById('history-brand-modal');
  const sheet = document.getElementById('history-modal-sheet');
  sheet.classList.add('closing');
  setTimeout(() => {
    modal.classList.add('hidden');
    sheet.classList.remove('closing');
    document.body.style.overflow = '';
    _histBrandRecord = null;
    _histBrandRow    = null;
  }, 220);
}

// =============================================
// MOBILE CARD VIEW + EDIT MODAL
// =============================================

let mobileEditRowId = null;

/**
 * Renders the mobile-only card list (visible on < md screens).
 * Each card shows brand name, total bottles, brand profit, and an Edit button.
 */
function renderCardList() {
  const container = document.getElementById('mobile-card-list');
  if (!container) return;

  const displayData = getFilteredAndSortedData();
  const topBrands = getTopBrands(appData);

  if (displayData.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
        <i class="fa-solid fa-wine-bottle text-4xl mb-3 opacity-40"></i>
        <p class="text-sm">No matching brands found. ${appData.length === 0 ? 'Tap <b>Add Brand Row</b> below to get started.' : ''}</p>
      </div>`;
    return;
  }

  let html = '';

  displayData.forEach((row) => {
    if (!row.dqty) row.dqty = { q: '', p: '', n: '' };

    // Compute totals
    let totalMrpProfit = 0, totalDiscProfit = 0, totalBottles = 0;
    ['q', 'p', 'n'].forEach((s) => {
      const mrp  = parseFloat(row.mrp[s])      || 0;
      const disc = parseFloat(row.discount[s]) || 0;
      const cost = parseFloat(row.cost[s])     || 0;
      const qty  = parseFloat(row.qty[s])      || 0;
      const dqty = parseFloat(row.dqty[s])     || 0;
      totalMrpProfit  += (mrp  - cost) * qty;
      totalDiscProfit += (disc - cost) * dqty;
      totalBottles    += qty + dqty;
    });
    const extraDisc   = parseFloat(row.extraDiscount) || 0;
    const brandProfit = totalMrpProfit + totalDiscProfit - extraDisc;

    const profitColor = brandProfit > 0
      ? 'color:#059669' // emerald
      : brandProfit < 0
        ? 'color:#dc2626' // red
        : 'color:#64748b';

    const rank = topBrands[row.id];
    let cardStyle = "";
    let badgeHtml = "";
    
    if (rank === 1) {
        cardStyle = "bg-gradient-to-r from-yellow-100 to-yellow-50 dark:from-yellow-900/30 dark:to-yellow-900/10 ring-2 ring-yellow-400 scale-[1.01]";
        badgeHtml = `<div class="absolute -top-2 -left-2 bg-gradient-to-r from-yellow-400 to-yellow-600 text-yellow-900 text-[10px] font-extrabold px-2 py-0.5 rounded shadow z-10">🥇 TOP 1</div>`;
    } else if (rank === 2) {
        cardStyle = "bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700 ring-1 ring-slate-400";
        badgeHtml = `<div class="absolute -top-2 -left-2 bg-gradient-to-r from-slate-200 to-slate-400 text-slate-800 text-[10px] font-extrabold px-2 py-0.5 rounded shadow z-10">🥈 TOP 2</div>`;
    } else if (rank === 3) {
        cardStyle = "bg-gradient-to-r from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-900/10 ring-1 ring-orange-300";
        badgeHtml = `<div class="absolute -top-2 -left-2 bg-gradient-to-r from-orange-200 to-orange-400 text-orange-900 text-[10px] font-extrabold px-2 py-0.5 rounded shadow z-10">🥉 TOP 3</div>`;
    }

    html += `
      <div class="mobile-brand-card relative ${cardStyle} hover:scale-[1.01] transition-all duration-200" onclick="openMobileEditModal('${row.id}')">
        ${badgeHtml}
        <div class="mobile-card-icon">
          <i class="fa-solid fa-wine-bottle"></i>
        </div>
        <div class="mobile-card-body">
          <div class="mobile-card-name">${row.name || 'Unnamed Brand'}</div>
          <div class="mobile-card-meta">${totalBottles} bottle${totalBottles !== 1 ? 's' : ''} sold</div>
        </div>
        <div class="mobile-card-profit" style="${profitColor}">₹${formatMoney(brandProfit)}</div>
        <button class="mobile-card-edit-btn" onclick="event.stopPropagation(); openMobileEditModal('${row.id}')" title="Edit">
          <i class="fa-solid fa-pen"></i>
        </button>
      </div>`;
  });

  // "Add brand" button at bottom
  html += `
    <button class="mobile-add-card" onclick="addRow()">
      <i class="fa-solid fa-plus"></i> Add Brand
    </button>`;

  container.innerHTML = html;
}

/**
 * Opens the mobile edit modal for the given row ID and populates all fields.
 */
function openMobileEditModal(rowId) {
  const row = appData.find((r) => r.id === rowId);
  if (!row) return;
  mobileEditRowId = rowId;

  // Populate header
  document.getElementById('medit-brand-title').textContent =
    row.name ? `Edit: ${row.name}` : 'Edit Brand';

  // Brand name
  document.getElementById('medit-name').value = row.name || '';

  // 5 field groups
  const fields = ['mrp', 'discount', 'cost', 'qty', 'dqty'];
  const sizes  = ['q', 'p', 'n'];
  fields.forEach((f) => {
    sizes.forEach((s) => {
      const el = document.getElementById(`medit-${f}-${s}`);
      if (el) el.value = row[f] ? (row[f][s] || '') : '';
    });
  });

  // Extra bargain
  document.getElementById('medit-extra').value = row.extraDiscount || '';

  // Compute live results
  mobileEditLiveCalc();

  // Show modal (reset any closing animation)
  const modal = document.getElementById('mobile-edit-modal');
  const sheet = document.getElementById('mobile-modal-sheet');
  sheet.classList.remove('closing');
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden'; // prevent background scroll
}

/**
 * Closes the mobile edit modal with a slide-down animation.
 */
function closeMobileEditModal() {
  const modal = document.getElementById('mobile-edit-modal');
  const sheet = document.getElementById('mobile-modal-sheet');
  sheet.classList.add('closing');
  setTimeout(() => {
    modal.classList.add('hidden');
    sheet.classList.remove('closing');
    document.body.style.overflow = '';
    mobileEditRowId = null;
  }, 220);
}

/**
 * Saves all values from the mobile modal back to appData and re-renders.
 */
function saveMobileEdit() {
  if (!mobileEditRowId) return;
  const row = appData.find((r) => r.id === mobileEditRowId);
  if (!row) return;

  // Name
  row.name = document.getElementById('medit-name').value;

  // 5 numeric field groups
  const fields = ['mrp', 'discount', 'cost', 'qty', 'dqty'];
  const sizes  = ['q', 'p', 'n'];
  fields.forEach((f) => {
    if (!row[f]) row[f] = { q: '', p: '', n: '' };
    sizes.forEach((s) => {
      const el = document.getElementById(`medit-${f}-${s}`);
      if (el) {
        let val = el.value.replace(/[^0-9.]/g, '').replace(/(\.[^.]*)\..*/, '$1');
        row[f][s] = val;
      }
    });
  });

  // Extra bargain
  const extraEl = document.getElementById('medit-extra');
  if (extraEl) {
    let val = extraEl.value.replace(/[^0-9.]/g, '').replace(/(\.[^.]*)\..*/, '$1');
    row.extraDiscount = val;
  }

  saveData();
  renderTable(); // re-renders table (desktop) + card list (mobile)
  closeMobileEditModal();
}

/**
 * Deletes the currently-open row from the mobile modal.
 */
function deleteMobileRow() {
  if (!mobileEditRowId) return;
  const row = appData.find((r) => r.id === mobileEditRowId);
  const name = row ? (row.name || 'this brand') : 'this brand';
  if (confirm(`Delete "${name}"? This cannot be undone.`)) {
    appData = appData.filter((r) => r.id !== mobileEditRowId);
    saveData(true);
    renderTable();
    closeMobileEditModal();
  }
}

/**
 * Live-calculates profit inside the modal as the user types.
 */
function mobileEditLiveCalc() {
  const g = (id) => parseFloat(document.getElementById(id)?.value) || 0;

  let totalMrp = 0, totalDisc = 0;
  ['q', 'p', 'n'].forEach((s) => {
    const mrp  = g(`medit-mrp-${s}`);
    const disc = g(`medit-discount-${s}`);
    const cost = g(`medit-cost-${s}`);
    const qty  = g(`medit-qty-${s}`);
    const dqty = g(`medit-dqty-${s}`);
    totalMrp  += (mrp  - cost) * qty;
    totalDisc += (disc - cost) * dqty;
  });
  const extra  = g('medit-extra');
  const brand  = totalMrp + totalDisc - extra;

  const colorFn = (v) => v > 0 ? '#059669' : v < 0 ? '#dc2626' : '#64748b';

  const mrpEl   = document.getElementById('medit-result-mrp');
  const discEl  = document.getElementById('medit-result-disc');
  const brandEl = document.getElementById('medit-result-brand');

  if (mrpEl)   { mrpEl.textContent   = '₹' + formatMoney(totalMrp);  mrpEl.style.color   = colorFn(totalMrp); }
  if (discEl)  { discEl.textContent  = '₹' + formatMoney(totalDisc); discEl.style.color  = colorFn(totalDisc); }
  if (brandEl) { brandEl.textContent = '₹' + formatMoney(brand);     brandEl.style.color = colorFn(brand); }
}

/**
 * Strips non-numeric characters from a mobile input (allows decimals only).
 */
function sanitizeMobileInput(el) {
  el.value = el.value.replace(/[^0-9.]/g, '').replace(/(\.[^.]*)\..*/g, '$1');
}

/**
 * Opens the bargain calculator modal from inside the mobile edit modal.
 * Sets the row ID using the currently-open mobile modal's row.
 */
function openBargainModalFromMobile() {
  if (!mobileEditRowId) return;
  // The bargain modal expects currentBargainRowId and the row's discount values
  // to be already in appData. First, flush the current modal inputs to appData so
  // the bargain calc has up-to-date discount prices.
  const row = appData.find((r) => r.id === mobileEditRowId);
  if (!row) return;

  // Temporarily flush discount values so bargain calc is accurate
  ['q', 'p', 'n'].forEach((s) => {
    const el = document.getElementById(`medit-discount-${s}`);
    if (el) row.discount[s] = el.value || '';
  });
  row.name = document.getElementById('medit-name').value;

  openBargainModal(mobileEditRowId);
}


// filterTable is now cleanly decoupled, so we don't need a patch
// (renderTable automatically calls renderCardList internally)

// Initialization
window.onload = () => {
  if (
    localStorage.getItem("liquorDarkMode") === "1" ||
    (!localStorage.getItem("liquorDarkMode") &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  ) {
    document.documentElement.classList.add("dark");
  }
  initHeaders();

  // Note: Table rendering and initial data logic is handled by
  // loadDataFromFirestore() which is called during auth state change
};
