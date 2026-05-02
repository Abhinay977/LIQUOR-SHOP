// Firebase Configuration
// IMPORTANT SECURITY NOTICE:
// 1. Web API keys are public by design. To prevent abuse, you MUST restrict this API key
//    to your specific domain in the Google Cloud Console (APIs & Services > Credentials).
// 2. Enable Firebase App Check in the Firebase Console and replace the ReCaptcha site key below.
const firebaseConfig = {
  apiKey: "AIzaSyAaCykQ_rT5mY6hvkQU7INX9BCs9ud5N9c",
  authDomain: "liquor-shop-c21da.firebaseapp.com",
  projectId: "liquor-shop-c21da",
  storageBucket: "liquor-shop-c21da.firebasestorage.app",
  messagingSenderId: "143928302985",
  appId: "1:143928302985:web:7c1f125445a9d6cd9d5558",
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);

  // Initialize App Check
  // TODO: Replace 'YOUR_RECAPTCHA_V3_SITE_KEY' with your actual site key from Google Cloud Console.
  if (typeof firebase.appCheck === "function") {
    const appCheck = firebase.appCheck();
    appCheck.activate(
      // You can use ReCaptchaV3Provider or ReCaptchaEnterpriseProvider
      new firebase.appCheck.ReCaptchaV3Provider(
        "6LfXTdIsAAAAAAU72_7pEqsaZyqEqCLP_2U9iH8q",
      ),
      true, // isTokenAutoRefreshEnabled
    );
  }
}

const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();
const db = firebase.firestore();

let appData = [];
let historyData = [];
let currentUser = null;
let saveTimeout = null;

// Check for redirect errors on page load
auth.getRedirectResult().catch((error) => {
  console.error("Redirect Auth Error:", error);
  const errorMsg = document.getElementById("login-error-msg");
  if (errorMsg) {
    if (
      error.code === "auth/invalid-api-key" ||
      error.code === "auth/unauthorized-domain"
    ) {
      errorMsg.textContent =
        "Configuration Error: Please update your API key restrictions in Google Cloud Console.";
    } else {
      errorMsg.textContent = "Sign-in failed: " + error.message;
    }
  }
});

// Auth State Observer
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

  // Close export dropdowns
  if (
    !e.target.closest('[id^="export-dropdown-"]') &&
    !e.target.closest('button[onclick^="toggleExportDropdown"]')
  ) {
    document
      .querySelectorAll('[id^="export-dropdown-"]')
      .forEach((dropdownEl) => {
        if (!dropdownEl.classList.contains("hidden")) {
          dropdownEl.classList.remove("opacity-100", "scale-100");
          dropdownEl.classList.add("opacity-0", "scale-95");
          setTimeout(() => dropdownEl.classList.add("hidden"), 200);
        }
      });
  }
});

function toggleExportDropdown(id) {
  const dropdown = document.getElementById(`export-dropdown-${id}`);
  if (!dropdown) return;

  // Close all other export dropdowns
  document.querySelectorAll('[id^="export-dropdown-"]').forEach((el) => {
    if (el.id !== `export-dropdown-${id}` && !el.classList.contains("hidden")) {
      el.classList.remove("opacity-100", "scale-100");
      el.classList.add("opacity-0", "scale-95");
      setTimeout(() => el.classList.add("hidden"), 200);
    }
  });

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
  errorMsg.textContent = "Redirecting to Google..."; // show a loading message

  // Use signInWithRedirect instead of Popup to avoid mobile browser popup blockers
  auth.signInWithRedirect(provider).catch((error) => {
    console.error("Auth Error:", error);
    if (error.code === "auth/invalid-api-key") {
      errorMsg.textContent =
        "Configuration Error: Please update your Firebase keys in script.js";
    } else {
      errorMsg.textContent =
        "Sign-in request failed. Check console for details.";
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
  return num.toFixed(2);
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

function renderTable() {
  const tbody = document.getElementById("table-body");
  tbody.innerHTML = "";

  appData.forEach((row) => {
    if (!row.dqty) row.dqty = { q: "", p: "", n: "" };
    const tr = document.createElement("tr");
    tr.className =
      "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group";

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
                    <td class="sticky-col bg-white dark:bg-darkCard p-0.5 md:p-1 border-r border-slate-300 dark:border-slate-600 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] group-hover:bg-slate-50 dark:group-hover:bg-slate-800/80 transition-colors z-10">
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
}

// Features
function filterTable() {
  const term = document.getElementById("search-input").value.toLowerCase();
  const rows = document.querySelectorAll("#table-body tr");
  rows.forEach((tr) => {
    const input = tr.querySelector("td:first-child input");
    if (input && input.value.toLowerCase().includes(term)) {
      tr.style.display = "";
    } else {
      tr.style.display = "none";
    }
  });
}

function toggleDarkMode() {
  document.documentElement.classList.toggle("dark");
  const isDark = document.documentElement.classList.contains("dark");
  localStorage.setItem("liquorDarkMode", isDark ? "1" : "0");
}

async function exportData(format, recordId) {
  // Close dropdown
  const dropdownId = recordId
    ? `export-dropdown-${recordId}`
    : "export-dropdown-main";
  const dropdown = document.getElementById(dropdownId);
  if (dropdown) {
    dropdown.classList.add("hidden", "opacity-0", "scale-95");
    dropdown.classList.remove("opacity-100", "scale-100");
  }

  const dataToExport = recordId
    ? historyData.find((r) => r.id === recordId)?.data
    : appData;
  if (!dataToExport || dataToExport.length === 0) {
    alert("No data available to export.");
    return;
  }

  // Safely handle potentially missing dates in old history records
  const rawDate = recordId
    ? historyData.find((r) => r.id === recordId)?.date
    : new Date().toLocaleDateString();
  const safeDateStr = String(rawDate || "History_Record").replace(
    /[^a-zA-Z0-9]/g,
    "_",
  );
  const fileName = `Liquor_Shop_Export_${safeDateStr}`;

  const needsScreenshot = ["pdf", "png", "jpeg", "word"].includes(format);
  let canvas = null;
  let imgData = null;

  if (needsScreenshot) {
    let originalElement;
    let wasHidden = false;

    if (recordId) {
      originalElement = document.getElementById(`table_${recordId}`);
      if (originalElement && originalElement.classList.contains("hidden")) {
        wasHidden = true;
        originalElement.classList.remove("hidden");
        void originalElement.offsetWidth;
      }
    } else {
      originalElement = document.querySelector(".table-wrapper");
    }

    if (!originalElement) {
      alert("Could not find the table to export.");
      return;
    }

    let clone = null;
    try {
      // Clone the element for a pristine screenshot without UI interference
      clone = originalElement.cloneNode(true);

      // Replace inputs with spans for a cleaner look and to preserve values
      const originalInputs = originalElement.querySelectorAll("input");
      const clonedInputs = clone.querySelectorAll("input");

      originalInputs.forEach((input, index) => {
        if (clonedInputs[index]) {
          const span = document.createElement("span");
          span.textContent = input.value || "";
          span.style.display = "inline-block";
          span.style.width = "100%";
          span.style.textAlign = input.classList.contains("text-right")
            ? "right"
            : "left";
          span.style.padding = "6px";
          span.style.fontWeight = "500";

          // If it's a search box or something else, it might look weird, but the table only has data inputs
          clonedInputs[index].parentNode.replaceChild(
            span,
            clonedInputs[index],
          );
        }
      });

      // Remove action columns if it's the main table
      if (!recordId) {
        const actionCells = clone.querySelectorAll(
          "th:last-child, td:last-child",
        );
        actionCells.forEach((cell) => cell.remove());
      }

      // Style the clone to break out of all parent constraints
      clone.style.position = "absolute";
      clone.style.top = "0";
      clone.style.left = "0";
      clone.style.zIndex = "-9999"; // Hide behind main content
      clone.style.width = "max-content";
      clone.style.overflow = "visible";
      const isDark = document.documentElement.classList.contains("dark");
      clone.style.backgroundColor = isDark ? "#1e293b" : "#ffffff";
      clone.style.margin = "0";

      // Append to body to escape any relative/flex constraints of the app container
      document.body.appendChild(clone);

      // Wait a tick for browser to paint the clone
      await new Promise((r) => setTimeout(r, 100));

      canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        scrollX: 0,
        scrollY: 0,
        windowWidth: clone.scrollWidth + 200,
        windowHeight: Math.max(clone.scrollHeight + 200, window.innerHeight),
      });
    } catch (err) {
      console.error("Screenshot Error: ", err);
      alert("An error occurred while generating the screenshot.");
      return;
    } finally {
      if (clone && document.body.contains(clone)) {
        document.body.removeChild(clone);
      }
      if (wasHidden && originalElement) {
        originalElement.classList.add("hidden");
      }
    }

    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      alert("Failed to capture the table. The image was empty.");
      return;
    }

    imgData = canvas.toDataURL(
      format === "png" ? "image/png" : "image/jpeg",
      1.0,
    );
  }

  // Export based on selected format
  if (format === "pdf") {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("l", "mm", "a4");
    const pdfWidth = doc.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    doc.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
    doc.save(`${fileName}.pdf`);
  } else if (format === "png" || format === "jpeg") {
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = `${fileName}.${format}`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      `image/${format}`,
      1.0,
    );
  } else if (format === "word") {
    // Embed the screenshot in Word
    const htmlStr = `
                    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                    <head><meta charset='utf-8'><title>Export</title></head>
                    <body>
                        <h2 style="font-family: Arial, sans-serif; text-align: center;">Liquor Shop Data Export - ${safeDateStr}</h2>
                        <img src="${imgData}" style="max-width: 100%; height: auto;" />
                    </body>
                    </html>
                `;
    const blob = new Blob(["\ufeff", htmlStr], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (format === "excel" || format === "csv") {
    // Excel, CSV formats build data from JSON
    const rows = [];
    dataToExport.forEach((row) => {
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

      rows.push({
        "Brand Name": row.name || "",
        "MRP (Q)": row.mrp.q || "0",
        "MRP (P)": row.mrp.p || "0",
        "MRP (N)": row.mrp.n || "0",
        "Discount (Q)": row.discount.q || "0",
        "Discount (P)": row.discount.p || "0",
        "Discount (N)": row.discount.n || "0",
        "Buying Cost (Q)": row.cost.q || "0",
        "Buying Cost (P)": row.cost.p || "0",
        "Buying Cost (N)": row.cost.n || "0",
        "MRP Qty (Q)": row.qty.q || "0",
        "MRP Qty (P)": row.qty.p || "0",
        "MRP Qty (N)": row.qty.n || "0",
        "Disc Qty (Q)": row.dqty ? row.dqty.q || "0" : "0",
        "Disc Qty (P)": row.dqty ? row.dqty.p || "0" : "0",
        "Disc Qty (N)": row.dqty ? row.dqty.n || "0" : "0",
        "Total MRP Profit": totalMrp.toFixed(2),
        "Total Disc Profit": totalDisc.toFixed(2),
        "Extra Bargain": extraDisc.toFixed(2),
        "Brand Profit": bp.toFixed(2),
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data");

    if (format === "excel") {
      XLSX.writeFile(workbook, `${fileName}.xlsx`);
    } else {
      XLSX.writeFile(workbook, `${fileName}.csv`);
    }
  }
}

function toggleHistoryMode() {
  const mainApp = document.getElementById("main-app-content");
  const historyApp = document.getElementById("history-content");

  if (mainApp.classList.contains("hidden")) {
    mainApp.classList.remove("hidden");
    historyApp.classList.add("hidden");
  } else {
    mainApp.classList.add("hidden");
    historyApp.classList.remove("hidden");
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
    let totalBrands = record.data.length;
    let totalBottles = 0;
    let grandTotalProfit = 0;

    // pre-calculate summary
    record.data.forEach((row) => {
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
                <div id="table_${record.id}" class="hidden mt-4 overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
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

    record.data.forEach((row) => {
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

      tableHtml += `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td class="sticky-col bg-white dark:bg-darkCard p-1 md:p-2 border-r border-slate-200 dark:border-slate-700 font-bold z-10 text-[10px] md:text-xs truncate max-w-[60px] md:max-w-[120px]" title="${row.name || "-"}">${row.name || "-"}</td>
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
    tableHtml += `</tbody></table></div>`;

    feedHtml += `
                <div class="bg-white dark:bg-darkCard p-5 rounded-xl shadow border border-slate-200 dark:border-darkBorder flex flex-col gap-4">
                    <div class="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-lg">
                                <i class="fa-solid fa-calendar-check"></i>
                            </div>
                            <div>
                                <h3 class="text-lg font-bold text-slate-800 dark:text-slate-200">${record.date}</h3>
                                <p class="text-xs text-slate-500 dark:text-slate-400"><i class="fa-regular fa-clock"></i> ${timeStr}</p>
                            </div>
                        </div>
                        <div class="flex gap-2 relative">
                            <button onclick="toggleExportDropdown('${record.id}')" class="px-3 py-1.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-800 transition-colors text-sm font-medium flex items-center gap-2">
                                <i class="fa-solid fa-file-export"></i> Export
                            </button>
                            <div id="export-dropdown-${record.id}" class="absolute right-0 top-full mt-2 w-32 bg-white dark:bg-darkCard rounded-xl shadow-xl border border-slate-200 dark:border-darkBorder hidden z-[60] overflow-hidden transform opacity-0 scale-95 transition-all duration-200 origin-top-right">
                                <div class="py-1">
                                    <button onclick="exportData('pdf', '${record.id}')" class="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-3"><i class="fa-regular fa-file-pdf text-red-500 w-4"></i> PDF</button>
                                    <button onclick="exportData('png', '${record.id}')" class="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-3"><i class="fa-regular fa-image text-blue-500 w-4"></i> PNG</button>
                                    <button onclick="exportData('jpeg', '${record.id}')" class="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-3"><i class="fa-regular fa-image text-cyan-500 w-4"></i> JPEG</button>
                                    <button onclick="exportData('excel', '${record.id}')" class="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-3"><i class="fa-regular fa-file-excel text-green-600 w-4"></i> Excel</button>
                                    <button onclick="exportData('csv', '${record.id}')" class="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-3"><i class="fa-solid fa-file-csv text-emerald-500 w-4"></i> CSV</button>
                                    <button onclick="exportData('word', '${record.id}')" class="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-3"><i class="fa-regular fa-file-word text-blue-600 w-4"></i> Word</button>
                                </div>
                            </div>
                            <button onclick="document.getElementById('table_${record.id}').classList.toggle('hidden')" class="px-3 py-1.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm font-medium">
                                <i class="fa-solid fa-table"></i> View Details
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
                </div>
                `;
  });

  feed.innerHTML = feedHtml;
}

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
