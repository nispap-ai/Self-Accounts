/* =========================================================================
   SELF ACCOUNTING SYSTEM — Local / Offline / Sync Edition
   সম্পূর্ণ ডাটা এই ব্রাউজারের localStorage-এ (এই ডিভাইসে) সংরক্ষিত থাকে।
   ========================================================================= */

const DB_KEY = "selfAccountingDB_v1";
let db = null;
let isSettingsUnlocked = false;
let pendingRestoreData = null;

/* ---------------------------- storage layer ---------------------------- */
function defaultDB() {
  return { pin: "1234", names: ["Cash"], categories: [], records: [] };
}

function loadDB() {
  const raw = localStorage.getItem(DB_KEY);
  try {
    db = raw ? JSON.parse(raw) : defaultDB();
    if (!db.pin) db.pin = "1234";
    if (!Array.isArray(db.names)) db.names = ["Cash"];
    if (!Array.isArray(db.categories)) db.categories = [];
    if (!Array.isArray(db.records)) db.records = [];
  } catch (e) {
    db = defaultDB();
  }
  if (!raw) saveDB();
}

function saveDB() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    
    // ফায়ারবেসে অটো-সেভ (যদি উপলব্ধ থাকে)
    if (window.firebaseDB && window.firebaseSet && window.firebaseRef) {
      window.firebaseSet(window.firebaseRef(window.firebaseDB, 'myAppData/db'), db);
    }

    return true;
  } catch (e) {
    showToastAlert("⚠️ সংরক্ষণে সমস্যা হয়েছে!");
    return false;
  }
}

/* ------------------------------- helpers -------------------------------- */
function val(id) { const el = document.getElementById(id); return el ? el.value : ""; }
function setTxt(id, t) { const el = document.getElementById(id); if (el) el.innerText = t; }

function esc(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function n0(v) { return (v !== null && v !== undefined && !isNaN(v)) ? Number(v).toFixed(0) : "-"; }
function pad2(n) { return String(n).padStart(2, "0"); }

function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

function toDMY(dateStr, twoDigitYear) {
  if (!dateStr) return "-";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return "-";
  const y = twoDigitYear ? String(d.getFullYear()).slice(-2) : d.getFullYear();
  return pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + "/" + y;
}

function toDM(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return "-";
  return pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1);
}

function showToastAlert(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.innerText = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

function inRange(dateStr, from, to) {
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
}

/* ----------------------------- PIN handling ----------------------------- */
function checkAppPin() {
  const pin = val("appPinInput").trim();
  const errorMsg = document.getElementById("pinErrorMsg");
  
  if (!db) loadDB();

  if (!pin) { 
    showToastAlert("পিন নম্বরটি লিখুন!"); 
    return; 
  }
  
  if (pin !== db.pin) {
    if (errorMsg) {
      errorMsg.innerText = "❌ ভুল পিন নম্বর! আবার চেষ্টা করুন।";
      errorMsg.classList.remove("hidden");
    }
    const input = document.getElementById("appPinInput");
    if(input) input.value = "";
    return;
  }

  if (errorMsg) errorMsg.classList.add("hidden");
  const lockScr = document.getElementById("pinLockScreen");
  const mainContent = document.getElementById("mainAppContent");
  if (lockScr) lockScr.classList.add("hidden");
  if (mainContent) mainContent.classList.remove("hidden");
  
  const navBar = document.getElementById("bottomNavBar");
  if (navBar) {
    navBar.classList.remove("hidden");
    navBar.style.display = "flex";
  }

  initializeAppEngine();
}

function settingsClickTrigger() {
  if (isSettingsUnlocked) { switchTab("settings"); return; }
  const pInput = document.getElementById("settingsGatePin");
  if (pInput) pInput.value = "";
  const gateModal = document.getElementById("settingsGateModal");
  if (gateModal) gateModal.classList.remove("hidden");
  setTimeout(() => { if (pInput) pInput.focus(); }, 100);
}

function cancelSettingsAccess() { 
  const gateModal = document.getElementById("settingsGateModal");
  if (gateModal) gateModal.classList.add("hidden"); 
}

function verifySettingsAccess() {
  const pin = val("settingsGatePin").trim();
  if (!pin) { showToastAlert("পিন নম্বরটি লিখুন!"); return; }
  if (pin === db.pin) {
    isSettingsUnlocked = true;
    cancelSettingsAccess();
    switchTab("settings");
  } else {
    showToastAlert("❌ ভুল পিন! সেটিংসে অ্যাক্সেস অস্বীকৃত।");
    const sgPin = document.getElementById("settingsGatePin");
    if(sgPin) sgPin.value = "";
  }
}

function changeSystemPin() {
  const oldPin = val("oldPinInput").trim();
  const newPin = val("newPinInput").trim();
  if (!oldPin || !newPin) { showToastAlert("❌ বর্তমান এবং নতুন উভয় পিনই প্রদান করুন!"); return; }
  if (oldPin !== db.pin) { showToastAlert("❌ বর্তমান পিন নম্বরটি সঠিক নয়!"); return; }
  if (newPin.length < 4) { showToastAlert("❌ নতুন পিন অবশ্যই কমপক্ষে ৪ ডিজিটের হতে হবে।"); return; }
  db.pin = newPin;
  saveDB();
  showToastAlert("🔐 সিকিউরিটি পিন সফলভাবে পরিবর্তন করা হয়েছে।");
  if(document.getElementById("oldPinInput")) document.getElementById("oldPinInput").value = "";
  if(document.getElementById("newPinInput")) document.getElementById("newPinInput").value = "";
  isSettingsUnlocked = false;
  switchTab("entry");
}

/* ------------------------------ navigation ------------------------------ */
function switchTab(tabName) {
  const screens = { dashboard: "dashboardViewScreen", entry: "entryViewScreen", report: "reportViewScreen", settings: "settingsViewScreen" };
  const tabs = { dashboard: "tabDashboard", entry: "tabEntry", report: "tabReport", settings: "tabSettings" };
  Object.keys(screens).forEach(k => {
    const scr = document.getElementById(screens[k]);
    const tab = document.getElementById(tabs[k]);
    if (scr) {
      if (k === tabName) scr.classList.remove("hidden");
      else scr.classList.add("hidden");
    }
    if (tab) {
      if (k === tabName) tab.classList.add("active");
      else tab.classList.remove("active");
    }
  });

  if (tabName !== "settings") {
    isSettingsUnlocked = false;
    triggerLiveUpdate();
    if (tabName === "entry") updateLiveSummaryAndEntries();
  } else {
    loadManagementOptions();
    updateDbStatsText();
  }
}

function initializeAppEngine() {
  const today = todayStr();
  const now = new Date();
  const firstDay = now.getFullYear() + "-" + pad2(now.getMonth() + 1) + "-01";

  if (document.getElementById("date")) document.getElementById("date").value = today;
  if (document.getElementById("transferDate")) document.getElementById("transferDate").value = today;
  if (document.getElementById("reportFromDate")) document.getElementById("reportFromDate").value = firstDay;
  if (document.getElementById("reportToDate")) document.getElementById("reportToDate").value = today;

  const yearSel = document.getElementById("reportYear");
  if (yearSel) {
    yearSel.innerHTML = "";
    const curY = now.getFullYear();
    for (let y = curY + 1; y >= curY - 4; y--) yearSel.add(new Option(y, y));
    yearSel.value = curY;
  }

  const monthSel = document.getElementById("dashMonthSelect");
  if (monthSel) monthSel.value = now.getFullYear() + "-" + pad2(now.getMonth() + 1);

  reloadDropdowns();
  updateDbStatsText();
  switchTab("dashboard");
}

/* ---------------------------- dropdown syncing --------------------------- */
function syncAccountName(v) {
  if(!v) return;
  const n = document.getElementById("name");
  const rn = document.getElementById("reportName");
  const da = document.getElementById("dashAccountSelect");
  if (n) n.value = v;
  if (rn) rn.value = v;
  if (da) da.value = v;
}

function syncCategory(v) {
  if(!v) return;
  const c = document.getElementById("category");
  const rc = document.getElementById("reportCategory");
  if (c) c.value = v;
  if (rc) rc.value = v;
}

function reloadDropdowns() {
  const nameSelect = document.getElementById("name");
  const catSelect = document.getElementById("category");
  const rNameSelect = document.getElementById("reportName");
  const rCatSelect = document.getElementById("reportCategory");
  const dashAccSelect = document.getElementById("dashAccountSelect");
  const badgeContainer = document.getElementById("accountBadgesContainer");

  if (nameSelect) nameSelect.innerHTML = "<option value=''>-- সিলেক্ট হিসাব --</option>";
  if (catSelect) catSelect.innerHTML = "<option value=''>-- সিলেক্ট ক্যাটাগরি --</option>";
  if (rNameSelect) rNameSelect.innerHTML = "<option value=''>-- সিলেক্ট হিসাব --</option>";
  if (rCatSelect) rCatSelect.innerHTML = "<option value=''>-- সিলেক্ট ক্যাটাগরি --</option>";
  if (dashAccSelect) dashAccSelect.innerHTML = "<option value=''>-- অ্যাকাউন্ট সিলেক্ট করুন --</option>";
  if (badgeContainer) badgeContainer.innerHTML = "";

  db.names.forEach(nm => {
    if (nameSelect) nameSelect.add(new Option(nm, nm));
    if (rNameSelect) rNameSelect.add(new Option(nm, nm));
    if (dashAccSelect) dashAccSelect.add(new Option(nm, nm));
    if (badgeContainer) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "badge-btn"; b.dataset.acc = nm; b.innerText = nm;
      b.onclick = () => selectDashboardAccount(nm);
      badgeContainer.appendChild(b);
    }
  });

  db.categories.forEach(c => { 
    if (catSelect) catSelect.add(new Option(c, c)); 
    if (rCatSelect) rCatSelect.add(new Option(c, c)); 
  });

  populateTransferDropdowns();

  if (db.names.length > 0) {
    selectDashboardAccount(db.names[0]);
  }
}

function populateTransferDropdowns() {
  const tFrom = document.getElementById("transferFromAcc");
  const tTo = document.getElementById("transferToAcc");
  if (!tFrom || !tTo) return;

  tFrom.innerHTML = "<option value='' disabled selected>-- সিলেক্ট উৎস --</option>";
  tTo.innerHTML = "<option value='' disabled selected>-- সিলেক্ট গন্তব্য --</option>";
  db.names.forEach(nm => { tFrom.add(new Option(nm, nm)); tTo.add(new Option(nm, nm)); });
}

function selectDashboardAccount(accName) {
  const dashAccSelect = document.getElementById("dashAccountSelect");
  if (dashAccSelect) dashAccSelect.value = accName;
  document.querySelectorAll(".badge-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.acc === accName);
  });
  triggerLiveUpdate();
}
/* ---------------------------- settings: dropdown CRUD -------------------- */
function loadManagementOptions() {
  const type = val("manageType");
  const mSelect = document.getElementById("existingItemsSelect");
  const inputEl = document.getElementById("itemValueInput");
  const btnDelete = document.getElementById("btnDeleteItem");
  
  if (!mSelect) return;

  mSelect.innerHTML = '<option value="">-- নতুন যোগ করুন --</option>';
  const items = type === "name" ? db.names : db.categories;
  items.forEach(it => mSelect.add(new Option(it, it)));
  
  if (inputEl) inputEl.value = "";
  if (btnDelete) btnDelete.classList.add("hidden");
}

function prepareEditItem() {
  const selected = val("existingItemsSelect");
  const inputEl = document.getElementById("itemValueInput");
  const btnDelete = document.getElementById("btnDeleteItem");

  if (inputEl) inputEl.value = selected;
  if (btnDelete) {
    if (selected) {
      btnDelete.classList.remove("hidden");
    } else {
      btnDelete.classList.add("hidden");
    }
  }
}

function saveDropdownData() {
  const type = val("manageType");
  const oldVal = val("existingItemsSelect");
  const inputEl = document.getElementById("itemValueInput");
  const newVal = inputEl ? inputEl.value.trim() : "";

  if (!newVal) { 
    showToastAlert("⚠️ আইটেমের নাম ফাঁকা রাখা যাবে না!"); 
    return; 
  }

  const targetKey = type === "name" ? "names" : "categories";

  // নতুন আইটেম যোগ করার ক্ষেত্রে
  if (!oldVal) {
    if (db[targetKey].includes(newVal)) { 
      showToastAlert("⚠️ এই নামটি ইতিমধ্যে তালিকাভুক্ত আছে!"); 
      return; 
    }
    db[targetKey].push(newVal);
    showToastAlert("✅ নতুন আইটেম সফলভাবে যোগ করা হয়েছে।");
  } 
  // পুরাতন আইটেম এডিট করার ক্ষেত্রে
  else {
    const idx = db[targetKey].indexOf(oldVal);
    if (idx === -1) { 
      showToastAlert("❌ আইটেমটি খুঁজে পাওয়া যায়নি।"); 
      return; 
    }
    db[targetKey][idx] = newVal;

    // যদি কোনো রেকর্ডে এই ক্যাটাগরি বা একাউন্ট ব্যবহার হয়ে থাকে, তবে সেটাও আপডেট হবে
    if (type === "name") {
      db.records.forEach(r => { if (r.name === oldVal) r.name = newVal; });
    } else {
      db.records.forEach(r => { if (r.category === oldVal) r.category = newVal; });
    }

    showToastAlert("✅ আইটেমটি সফলভাবে আপডেট করা হয়েছে।");
  }

  // ডাটাবেজ আপডেট এবং ড্রপডাউন রিফ্রেশ
  if (saveDB()) {
    reloadDropdowns();
    loadManagementOptions();
    updateDbStatsText();
  }
}

function deleteDropdownData() {
  const type = val("manageType");
  const v = val("existingItemsSelect");

  if (!v) {
    showToastAlert("⚠️ ডিলিট করার জন্য একটি আইটেম সিলেক্ট করুন!");
    return;
  }

  if (!confirm(`আপনি কি নিশ্চিতভাবে "${v}" আইটেমটি ডিলিট করতে চান?`)) return;

  const targetKey = type === "name" ? "names" : "categories";
  const idx = db[targetKey].indexOf(v);
  
  if (idx === -1) { 
    showToastAlert("❌ আইটেমটি পাওয়া যায়নি।"); 
    return; 
  }

  db[targetKey].splice(idx, 1);
  
  if (saveDB()) {
    showToastAlert("🗑️ আইটেমটি সফলভাবে ডিলিট করা হয়েছে।");
    reloadDropdowns();
    loadManagementOptions();
    updateDbStatsText();
  }
}
/* ------------------------------ processed data --------------------------- */
function getProcessedForAccount(accName) {
  const recs = db.records.filter(r => r.name === accName);
  recs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (parseInt(a.sl) || 0) - (parseInt(b.sl) || 0)));
  let bal = 0;
  return recs.map(r => {
    const taka = parseFloat(r.taka) || 0;
    const income = r.type === "Income" ? taka : 0;
    const expense = r.type === "Expense" ? taka : 0;
    const pending = r.type === "Pending" ? taka : 0;
    bal += income - expense;
    return Object.assign({}, r, { taka, income, expense, pending, acBalance: bal });
  });
}

/* -------------------------------- dashboard ------------------------------- */
function computeDashboard(accountName, monthYear) {
  const res = { currentBalance: 0, monthIncome: 0, monthExpense: 0, pendingAmount: 0, topExpenses: [], expensePercentage: 0, balancePercentage: 0 };
  if (!accountName) return res;
  const rows = getProcessedForAccount(accountName);
  if (rows.length === 0) return res;

  let targetYear, targetMonth;
  if (monthYear) { const p = monthYear.split("-"); targetYear = parseInt(p[0]); targetMonth = parseInt(p[1]) - 1; }
  else { const now = new Date(); targetYear = now.getFullYear(); targetMonth = now.getMonth(); }

  let monthOpeningBalance = 0, newMonthIncomeOnly = 0;
  const catMap = {};

  rows.forEach(r => {
    const d = new Date(r.date + "T00:00:00");
    const ry = d.getFullYear(), rm = d.getMonth();
    if (ry < targetYear || (ry === targetYear && rm < targetMonth)) monthOpeningBalance = r.acBalance;
    if (ry === targetYear && rm === targetMonth) {
      res.currentBalance = r.acBalance;
      if (r.type === "Income") newMonthIncomeOnly += r.taka;
      else if (r.type === "Expense") { res.monthExpense += r.taka; catMap[r.category] = (catMap[r.category] || 0) + r.taka; }
      else if (r.type === "Pending") res.pendingAmount += r.taka;
    }
  });

  res.monthIncome = monthOpeningBalance + newMonthIncomeOnly;
  res.expensePercentage = res.monthIncome > 0 ? Math.round((res.monthExpense / res.monthIncome) * 100) : (res.monthExpense > 0 ? 100 : 0);
  res.balancePercentage = res.currentBalance > 0 ? Math.round((res.monthExpense / res.currentBalance) * 100) : (res.monthExpense > 0 ? 100 : 0);

  const sortedCats = Object.keys(catMap).sort((a, b) => catMap[b] - catMap[a]);
  res.topExpenses = sortedCats.slice(0, 7).map(c => ({ category: c, amount: catMap[c] }));
  return res;
}

function triggerLiveUpdate() {
  const monthSel = document.getElementById("dashMonthSelect");
  if (monthSel && !monthSel.value) {
    const now = new Date();
    monthSel.value = now.getFullYear() + "-" + pad2(now.getMonth() + 1);
  }
  const acc = val("dashAccountSelect");
  const monthYear = val("dashMonthSelect");
  if (!acc) return;

  const d = computeDashboard(acc, monthYear);
  setTxt("dashBalance", d.currentBalance.toFixed(0));
  setTxt("dashIncome", d.monthIncome.toFixed(0));
  setTxt("dashExpense", d.monthExpense.toFixed(0));
  setTxt("dashPending", d.pendingAmount.toFixed(0));
  setTxt("dashPercentText", `আয়ের ${d.expensePercentage}% খরচ হয়েছে`);
  
  const progressBar = document.getElementById("dashProgressBar");
  if (progressBar) progressBar.style.width = Math.min(d.expensePercentage, 100) + "%";
  
  setTxt("dashBalancePercentText", `ব্যালেন্সের ${d.balancePercentage}% খরচ হয়েছে`);
  
  const balProgressBar = document.getElementById("dashBalanceProgressBar");
  if (balProgressBar) balProgressBar.style.width = Math.min(d.balancePercentage, 100) + "%";

  const listEl = document.getElementById("dashTopExpensesList");
  if (listEl) {
    if (!d.topExpenses.length) {
      listEl.innerHTML = `<li class="empty-note">এই মাসে এখনো কোনো খরচের ডাটা নেই</li>`;
    } else {
      listEl.innerHTML = d.topExpenses.map((item, i) =>
        `<li style="display:flex;justify-content:space-between;padding:8px 2px;border-bottom:1px solid var(--slate-100);">
          <span>${i + 1}. ${esc(item.category)}</span>
          <span style="font-family:monospace;font-weight:800;color:var(--red);">${item.amount.toFixed(0)} ৳</span>
        </li>`).join("");
    }
  }
}

/* --------------------------------- entry --------------------------------- */
function renderRecentTen(accountName) {
  const rows = getProcessedForAccount(accountName);
  const last10 = rows.slice(-10).reverse();
  let html;
  if (!last10.length) {
    html = `<tr><td colspan="6" class="empty-note">কোনো ডাটা পাওয়া যায়নি</td></tr>`;
  } else {
    html = last10.map(r => `<tr>
      <td>${r.sl}</td><td>${toDM(r.date)}</td><td class="l">${esc(r.desc || "-")}</td>
      <td class="r" style="color:var(--green);">${n0(r.income)}</td>
      <td class="r" style="color:var(--red);">${n0(r.expense)}</td>
      <td class="r" style="color:#d97706;">${n0(r.pending)}</td>
    </tr>`).join("");
  }
  const a = document.getElementById("entryHistoryTableBody");
  const b = document.getElementById("historyTableBody");
  if (a) a.innerHTML = html;
  if (b) b.innerHTML = html;
}

function getTodayLiveSummary(accountName, date) {
  const rows = getProcessedForAccount(accountName).filter(r => r.date === date);
  if (!rows.length) return { income: 0, expense: 0, balance: 0 };
  const income = rows.reduce((s, r) => s + r.income, 0);
  const expense = rows.reduce((s, r) => s + r.expense, 0);
  const balance = rows[rows.length - 1].acBalance;
  return { income, expense, balance };
}

function updateLiveSummaryAndEntries() {
  const acc = val("name");
  const date = val("date");
  if (!acc) return;
  renderRecentTen(acc);
  if (date) {
    const s = getTodayLiveSummary(acc, date);
    setTxt("liveIncome", s.income.toFixed(0));
    setTxt("liveExpense", s.expense.toFixed(0));
    setTxt("liveBalance", s.balance.toFixed(0));
  }
}

function saveRecord() {
  const obj = { 
    slno: val("slno"), 
    name: val("name"), 
    date: val("date"), 
    category: val("category"), 
    desc: val("desc"), 
    type: val("type"), 
    taka: val("taka") 
  };

  if (!obj.name || !obj.date || !obj.category || !obj.type || !obj.taka) {
    showToastAlert("⚠️ ত্রুটি: হিসাবের নাম, তারিখ, ক্যাটাগরি, টাইপ এবং টাকা প্রদান করা বাধ্যতামুলক!");
    return;
  }

  let rowIdx = -1;
  let finalSl = obj.slno ? parseInt(obj.slno) : null;
  if (obj.slno) rowIdx = db.records.findIndex(r => String(r.sl) === String(obj.slno).trim());

  if (rowIdx === -1 && !finalSl) {
    let maxSl = 0;
    db.records.forEach(r => { const s = parseInt(r.sl) || 0; if (s > maxSl) maxSl = s; });
    finalSl = maxSl + 1;
  }

  const rec = { 
    sl: finalSl, 
    name: obj.name.trim(), 
    date: obj.date, 
    category: obj.category.trim(), 
    desc: (obj.desc || "").trim(), 
    type: obj.type, 
    taka: parseFloat(obj.taka) || 0 
  };

  if (rowIdx === -1) db.records.push(rec); else db.records[rowIdx] = rec;
  
  if (saveDB()) {
    showToastAlert(`সিরিয়াল নম্বর ${finalSl} সফলভাবে সংরক্ষিত হয়েছে।`);
    clearForm();
    updateLiveSummaryAndEntries();
    triggerLiveUpdate();
    updateDbStatsText();
  }
}

function loadRecord() {
  const sl = val("slno");
  if (!sl) { showToastAlert("সিরিয়াল নম্বর লিখুন!"); return; }
  const rec = db.records.find(r => String(r.sl) === String(sl).trim());
  if (!rec) { showToastAlert("সিরিয়াল নম্বরটি পাওয়া যায়নি!"); return; }
  
  if (document.getElementById("name")) document.getElementById("name").value = rec.name;
  if (document.getElementById("date")) document.getElementById("date").value = rec.date;
  if (document.getElementById("category")) document.getElementById("category").value = rec.category;
  if (document.getElementById("desc")) document.getElementById("desc").value = rec.desc;
  if (document.getElementById("type")) document.getElementById("type").value = rec.type;
  if (document.getElementById("taka")) document.getElementById("taka").value = rec.taka;
  
  syncAccountName(rec.name); 
  syncCategory(rec.category);
  updateLiveSummaryAndEntries();
  triggerLiveUpdate();
  showToastAlert("🔍 রেকর্ড লোড করা হয়েছে!");
}

function deleteRecord() {
  const sl = val("slno");
  if (!sl) { showToastAlert("সিরিয়াল নম্বর দিন!"); return; }
  if (!confirm("রেকর্ডটি কি নিশ্চিত ডিলিট করবেন?")) return;
  const idx = db.records.findIndex(r => String(r.sl) === String(sl).trim());
  if (idx === -1) { showToastAlert("রেকর্ড পাওয়া যায়নি!"); return; }
  db.records.splice(idx, 1);
  saveDB();
  showToastAlert(`সিরিয়াল নম্বর ${sl} সফলভাবে ডিলিট করা হয়েছে।`);
  clearForm();
  updateLiveSummaryAndEntries();
  triggerLiveUpdate();
  updateDbStatsText();
}

function clearForm() {
  if (document.getElementById("slno")) document.getElementById("slno").value = "";
  if (document.getElementById("desc")) document.getElementById("desc").value = "";
  if (document.getElementById("taka")) document.getElementById("taka").value = "";
}

/* -------------------------------- transfer -------------------------------- */
function openTransferModal() {
  const modal = document.getElementById("transferModal");
  if (modal) modal.classList.remove("hidden");
  populateTransferDropdowns();
  setTimeout(() => { if (document.getElementById("transferTaka")) document.getElementById("transferTaka").focus(); }, 100);
}

function closeTransferModal() { 
  const modal = document.getElementById("transferModal");
  if (modal) modal.classList.add("hidden"); 
}

function executeTransferAction() {
  const obj = { fromAcc: val("transferFromAcc"), toAcc: val("transferToAcc"), date: val("transferDate"), taka: val("transferTaka"), desc: val("transferDesc").trim() };
  if (!obj.fromAcc || !obj.toAcc || !obj.date || !obj.taka) { showToastAlert("⚠️ ত্রুটি: উৎস, গন্তব্য, তারিখ এবং টাকার পরিমাণ দেওয়া বাধ্যতামূলক!"); return; }
  if (obj.fromAcc === obj.toAcc) { showToastAlert("⚠️ ত্রুটি: একই অ্যাকাউন্টে টাকা স্থানান্তর করা সম্ভব নয়!"); return; }
  const amount = parseFloat(obj.taka) || 0;
  if (amount <= 0) { showToastAlert("⚠️ ত্রুটি: টাকার পরিমাণ অবশ্যই ০ থেকে বেশি হতে হবে!"); return; }

  let maxSl = 0;
  db.records.forEach(r => { const s = parseInt(r.sl) || 0; if (s > maxSl) maxSl = s; });
  const sl1 = maxSl + 1, sl2 = maxSl + 2;
  
  db.records.push({ sl: sl1, name: obj.fromAcc, date: obj.date, category: "Transfer", desc: `Transferred to ${obj.toAcc}. ${obj.desc}`, type: "Expense", taka: amount });
  db.records.push({ sl: sl2, name: obj.toAcc, date: obj.date, category: "Transfer", desc: `Received from ${obj.fromAcc}. ${obj.desc}`, type: "Income", taka: amount });
  
  saveDB();
  showToastAlert(`🔄 সফলভাবে ${amount} টাকা স্থানান্তরিত হয়েছে! (SL: ${sl1}, ${sl2})`);
  if (document.getElementById("transferTaka")) document.getElementById("transferTaka").value = "";
  if (document.getElementById("transferDesc")) document.getElementById("transferDesc").value = "";
  closeTransferModal();
  updateLiveSummaryAndEntries();
  triggerLiveUpdate();
  updateDbStatsText();
}

/* --------------------------------- reports --------------------------------- */
function showLoaderState() {
  if (document.getElementById("loader")) document.getElementById("loader").classList.remove("hidden");
  if (document.getElementById("dynamicReportWrapper")) document.getElementById("dynamicReportWrapper").classList.add("hidden");
  if (document.getElementById("dynamicReportData")) document.getElementById("dynamicReportData").innerHTML = "";
  if (document.getElementById("defaultHistorySection")) document.getElementById("defaultHistorySection").classList.add("hidden");
}

function showReportResult(res) {
  if (document.getElementById("loader")) document.getElementById("loader").classList.add("hidden");
  if (document.getElementById("dynamicReportWrapper")) document.getElementById("dynamicReportWrapper").classList.remove("hidden");
  
  if (res.status === "success") {
    if (document.getElementById("dynamicReportData")) document.getElementById("dynamicReportData").innerHTML = res.html;
  } else if (res.status === "empty") {
    if (document.getElementById("dynamicReportData")) document.getElementById("dynamicReportData").innerHTML = `<div class="empty-note">⚠️ কোনো ডাটা পাওয়া যায়নি!</div>`;
  } else {
    showToastAlert("ত্রুটি: " + res.message);
  }
}

function backToHistory() {
  if (document.getElementById("dynamicReportWrapper")) document.getElementById("dynamicReportWrapper").classList.add("hidden");
  if (document.getElementById("defaultHistorySection")) document.getElementById("defaultHistorySection").classList.remove("hidden");
}

function topInfoBlock(title, accountName, from, to) {
  const dateText = (from && to) ? `${from} হতে ${to}` : "সকল সময়";
  return `<div style="text-align:center;margin-bottom:10px;">
    <div style="font-weight:800;font-size:14px;color:var(--slate-900);">SELF ACCOUNTING SYSTEM</div>
    <div style="font-weight:800;font-size:13px;color:var(--indigo-dark);margin-top:2px;">${title}</div>
    <div style="font-size:12px;font-weight:700;margin-top:2px;">হিসাবের নাম: ${esc(accountName || "N/A")} &nbsp;|&nbsp; তারিখ: ${dateText}</div>
  </div>`;
}

function renderDetailsView(account, from, to) {
  if (!account) return { status: "error", message: "হিসাবের নাম সিলেক্ট করুন।" };
  const rows = getProcessedForAccount(account);
  let opening = 0;
  rows.forEach(r => { if (from && r.date < from) opening = r.acBalance; });
  const filtered = rows.filter(r => inRange(r.date, from, to));
  if (!filtered.length && opening === 0) return { status: "empty", html: "" };

  let body = `<tr style="background:var(--slate-50);font-weight:800;">
    <td>-</td><td>${from || "শুরু"}</td><td class="l">-</td><td class="l" style="color:var(--indigo-dark);">প্রারম্ভিক জের</td><td class="r">-</td><td class="r">-</td><td class="r">${opening.toFixed(0)}</td></tr>`;
  let totalIncome = 0, totalExpense = 0, closing = opening;
  filtered.forEach(r => {
    totalIncome += r.income; totalExpense += r.expense; closing = r.acBalance;
    body += `<tr><td>${r.sl}</td><td>${toDMY(r.date, true)}</td><td class="l">${esc(r.category)}</td><td class="l">${esc(r.desc || "-")}</td>
      <td class="r" style="color:var(--green);">${n0(r.income)}</td><td class="r" style="color:var(--red);">${n0(r.expense)}</td><td class="r">${r.acBalance.toFixed(0)}</td></tr>`;
  });
  body += `<tr style="background:var(--slate-100);font-weight:800;"><td colspan="4" class="r">সর্বমোট / সমাপনী জের:</td>
    <td class="r" style="color:var(--green);">${totalIncome.toFixed(0)}</td><td class="r" style="color:var(--red);">${totalExpense.toFixed(0)}</td><td class="r">${closing.toFixed(0)}</td></tr>`;

  const html = topInfoBlock("📋 অ্যাকাউন্ট ডিটেইলস ভিউ", account, from, to) +
    `<table class="dt"><thead><tr><th>SL</th><th>তারিখ</th><th>ক্যাটাগরি</th><th>বিবরণ</th><th>আয়</th><th>ব্যয়</th><th>ব্যালেন্স</th></tr></thead><tbody>${body}</tbody></table>`;
  return { status: "success", html };
}

function renderCategoryView(account, from, to) {
  if (!account) return { status: "error", message: "হিসাবের নাম সিলেক্ট করুন।" };
  const rows = getProcessedForAccount(account).filter(r => inRange(r.date, from, to));
  if (!rows.length) return { status: "empty", html: "" };
  const map = {};
  rows.forEach(r => {
    if (!map[r.category]) map[r.category] = { income: 0, expense: 0 };
    map[r.category].income += r.income; map[r.category].expense += r.expense;
  });
  let totalInc = 0, totalExp = 0, body = "";
  Object.keys(map).sort().forEach(cat => {
    totalInc += map[cat].income; totalExp += map[cat].expense;
    body += `<tr><td class="l">${esc(cat)}</td><td class="r" style="color:var(--green);">${n0(map[cat].income)}</td><td class="r" style="color:var(--red);">${n0(map[cat].expense)}</td></tr>`;
  });
  body += `<tr style="background:var(--slate-100);font-weight:800;"><td class="r">সর্বমোট:</td><td class="r" style="color:var(--green);">${totalInc.toFixed(0)}</td><td class="r" style="color:var(--red);">${totalExp.toFixed(0)}</td></tr>`;
  const html = topInfoBlock("🗂️ ক্যাটাগরি ভিত্তিক সারসংক্ষেপ", account, from, to) +
    `<table class="dt"><thead><tr><th>ক্যাটাগরি</th><th>আয়</th><th>ব্যয়</th></tr></thead><tbody>${body}</tbody></table>`;
  return { status: "success", html };
}

function renderPendingReport() {
  const rows = db.records.filter(r => r.type === "Pending").slice().sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  if (!rows.length) return { status: "empty", html: "" };
  let total = 0, body = "";
  rows.forEach(r => {
    const taka = parseFloat(r.taka) || 0;
    total += taka;
    body += `<tr><td>${r.sl}</td><td class="l">${esc(r.name)}</td><td>${toDMY(r.date, true)}</td><td class="l">${esc(r.category)}</td><td class="l">${esc(r.desc || "-")}</td><td class="r" style="color:#b45309;">${taka.toFixed(0)}</td></tr>`;
  });
  body += `<tr style="background:var(--slate-100);font-weight:800;"><td colspan="5" class="r">সর্বমোট পেন্ডিং:</td><td class="r">${total.toFixed(0)}</td></tr>`;
  const html = `<div style="text-align:center;margin-bottom:10px;font-weight:800;">⏳ পেন্ডিং লিস্ট রিপোর্ট (সকল হিসাব)</div>
    <table class="dt"><thead><tr><th>SL</th><th>হিসাব</th><th>তারিখ</th><th>ক্যাটাগরি</th><th>বিবরণ</th><th>টাকা</th></tr></thead><tbody>${body}</tbody></table>`;
  return { status: "success", html };
}

function renderCategoryDetail(account, cat, from, to) {
  if (!account || !cat) return { status: "error", message: "হিসাবের নাম ও ক্যাটাগরি সিলেক্ট করুন।" };
  const rows = db.records.filter(r => r.name === account && r.category === cat && inRange(r.date, from, to))
    .slice().sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  if (!rows.length) return { status: "empty", html: "" };
  let totalInc = 0, totalExp = 0, body = "";
  rows.forEach(r => {
    const taka = parseFloat(r.taka) || 0;
    const inc = r.type === "Income" ? taka : 0, exp = r.type === "Expense" ? taka : 0;
    totalInc += inc; totalExp += exp;
    body += `<tr><td>${r.sl}</td><td>${toDMY(r.date, true)}</td><td class="l">${esc(r.desc || "-")}</td><td class="r" style="color:var(--green);">${n0(inc)}</td><td class="r" style="color:var(--red);">${n0(exp)}</td></tr>`;
  });
  body += `<tr style="background:var(--slate-100);font-weight:800;"><td colspan="3" class="r">সর্বমোট যোগফল:</td><td class="r" style="color:var(--green);">${totalInc.toFixed(0)}</td><td class="r" style="color:var(--red);">${totalExp.toFixed(0)}</td></tr>`;
  const html = topInfoBlock(`🎯 ক্যাটাগরি ভিত্তিক ডিটেইলস রিপোর্ট (${esc(cat)})`, account, from, to) +
    `<table class="dt"><thead><tr><th>SL</th><th>তারিখ</th><th>বিবরণ</th><th>আয়</th><th>ব্যয়</th></tr></thead><tbody>${body}</tbody></table>`;
  return { status: "success", html };
}

function renderAllEntriesDescending(account) {
  if (!account) return { status: "error", message: "হিসাবের নাম সিলেক্ট করুন।" };
  const rows = db.records.filter(r => r.name === account).slice().sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : (parseInt(b.sl) || 0) - (parseInt(a.sl) || 0));
  if (!rows.length) return { status: "empty", html: "" };
  let total = 0, body = "";
  rows.forEach(r => {
    const taka = parseFloat(r.taka) || 0;
    let style = "", display = "";
    if (r.type === "Income") { total += taka; style = "color:var(--green);"; display = taka.toFixed(0); }
    else if (r.type === "Expense") { total -= taka; style = "color:var(--red);"; display = "-" + taka.toFixed(0); }
    else { total += taka; style = "color:#b45309;"; display = taka.toFixed(0); }
    body += `<tr><td>${r.sl}</td><td>${toDMY(r.date, true)}</td><td class="l">${esc(r.desc || "-")}</td><td class="l">${esc(r.category)}</td><td style="${style};font-weight:800;">${r.type}</td><td class="r" style="${style};font-weight:800;">${display}</td></tr>`;
  });
  body += `<tr style="background:var(--slate-100);font-weight:800;"><td colspan="5" class="r">মোট এন্ট্রি ও সর্বমোট টাকার পরিমাণ:</td><td class="r" style="color:${total < 0 ? "var(--red)" : "var(--green)"};">${total.toFixed(0)}</td></tr>`;
  const html = `<div style="text-align:center;margin-bottom:10px;"><div style="font-weight:800;">📋 সকল এন্ট্রির পূর্ণাঙ্গ তালিকা (লেটেস্ট আগে)</div><div style="font-size:12px;font-weight:700;color:var(--slate-500);">হিসাবের নাম: ${esc(account)}</div></div>
    <table class="dt"><thead><tr><th>Slno</th><th>তারিখ</th><th>ডিটেইলস</th><th>ক্যাটাগরি</th><th>টাইপ</th><th>টাকা</th></tr></thead><tbody>${body}</tbody></table>`;
  return { status: "success", html };
}

function renderCashbook(account, from, to) {
  if (!account) return { status: "error", message: "হিসাবের নাম সিলেক্ট করুন।" };
  const rows = getProcessedForAccount(account);
  if (!rows.length) return { status: "empty", html: "" };
  let opening = 0;
  const left = {}, right = {};
  rows.forEach(r => {
    if (from && r.date < from) { opening = r.acBalance; return; }
    if (to && r.date > to) return;
    if (r.income) left[r.category] = (left[r.category] || 0) + r.income;
    if (r.expense) right[r.category] = (right[r.category] || 0) + r.expense;
  });
  let leftEntries = Object.keys(left).map(c => ({ desc: c, amount: left[c] }));
  let rightEntries = Object.keys(right).map(c => ({ desc: c, amount: right[c] }));
  leftEntries.unshift({ desc: "প্রারম্ভিক জের", amount: opening, open: true });
  const totalLeft = leftEntries.reduce((s, i) => s + i.amount, 0);
  const totalRight = rightEntries.reduce((s, i) => s + i.amount, 0);
  const closing = totalLeft - totalRight;
  rightEntries.push({ desc: "সমাপ্তি জের (ব্যাংক জমা)", amount: closing, close: true });

  const maxRows = Math.max(leftEntries.length, rightEntries.length);
  if (maxRows === 2 && opening === 0 && closing === 0) return { status: "empty", html: "" };

  let body = "";
  for (let k = 0; k < maxRows; k++) {
    const l = leftEntries[k] || { desc: "", amount: null };
    const r = rightEntries[k] || { desc: "", amount: null };
    const lStyle = l.open ? "font-weight:800;color:var(--blue);background:var(--slate-50);" : "";
    const rStyle = r.close ? "font-weight:800;color:#b91c1c;background:#fef2f2;" : "";
    body += `<tr>
      <td class="l" style="${lStyle}">${esc(l.desc)}</td><td class="r" style="${lStyle}">${l.amount !== null ? l.amount.toFixed(0) : "-"}</td>
      <td class="l" style="${rStyle}">${esc(r.desc)}</td><td class="r" style="${rStyle}">${r.amount !== null ? r.amount.toFixed(0) : "-"}</td>
    </tr>`;
  }
  const html = topInfoBlock("📓 ক্যাশ বহি (Cash Book)", account, from, to) +
    `<table class="dt"><thead>
      <tr><th colspan="2" style="background:#1e293b;color:#fff;">প্রাপ্তি / জমা পাশ (Debit)</th><th colspan="2" style="background:#1e293b;color:#fff;">পরিশোধ / খরচ পাশ (Credit)</th></tr>
      <tr><th>বিবরণ</th><th>টাকা</th><th>বিবরণ</th><th>টাকা</th></tr>
     </thead><tbody>${body}
      <tr style="background:var(--slate-200);font-weight:800;"><td class="r">সর্বমোট জমা:</td><td class="r">${totalLeft.toFixed(0)}</td><td class="r">সর্বমোট খরচ:</td><td class="r">${totalLeft.toFixed(0)}</td></tr>
     </tbody></table>`;
  return { status: "success", html };
}

function renderMonthlyBalance(account, year) {
  if (!account) return { status: "error", message: "হিসাবের নাম সিলেক্ট করুন।" };
  const y = parseInt(year);
  const monthsBn = ["জানুয়ারি","ফেব্রুয়ারি","মার্চ","এপ্রিল","মে","জুন","জুলাই","আগস্ট","সেপ্টেম্বর","অক্টোবর","নভেম্বর","ডিসেম্বর"];
  const monthly = Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }));
  let hasData = false;

  db.records.forEach(r => {
    if (r.name === account) {
      const d = new Date(r.date + "T00:00:00");
      if (d.getFullYear() === y) {
        hasData = true;
        const m = d.getMonth();
        const taka = parseFloat(r.taka) || 0;
        if (r.type === "Income") monthly[m].income += taka;
        else if (r.type === "Expense") monthly[m].expense += taka;
      }
    }
  });

  if (!hasData) return { status: "empty", html: "" };
  let running = 0, totInc = 0, totExp = 0, body = "";
  for (let m = 0; m < 12; m++) {
    const inc = monthly[m].income, exp = monthly[m].expense, bal = inc - exp;
    running += bal; totInc += inc; totExp += exp;
    body += `<tr><td class="l">${monthsBn[m]}</td><td class="r" style="color:var(--green);">${n0(inc)}</td><td class="r" style="color:var(--red);">${n0(exp)}</td><td class="r" style="font-weight:800;color:${running >= 0 ? "var(--indigo-dark)" : "var(--red)"};">${running.toFixed(0)}</td></tr>`;
  }
  body += `<tr style="background:var(--slate-100);font-weight:800;"><td class="l">সর্বমোট:</td><td class="r" style="color:var(--green);">${totInc.toFixed(0)}</td><td class="r" style="color:var(--red);">${totExp.toFixed(0)}</td><td class="r">${running.toFixed(0)}</td></tr>`;
  const html = `<div style="text-align:center;margin-bottom:10px;"><div style="font-weight:800;">📊 মাসিক ব্যালেন্স স্টেটমেন্ট (${y})</div><div style="font-size:12px;font-weight:700;color:var(--slate-500);">হিসাবের নাম: ${esc(account)}</div></div>
    <table class="dt"><thead><tr><th>মাস</th><th>মোট জমা</th><th>মোট খরচ</th><th>অবশিষ্ট ব্যালেন্স</th></tr></thead><tbody>${body}</tbody></table>`;
  return { status: "success", html };
}

function renderCategoryMonthlyExpense(account, year) {
  if (!account) return { status: "error", message: "হিসাবের নাম সিলেক্ট করুন।" };
  const y = parseInt(year);
  const monthsBn = ["জান","ফেব্র","মার্চ","এপ্রি","মে","জুন","জুলাই","আগ","সেপ্ট","অক্টো","নভে","ডিসে"];
  const catMap = {};
  let hasData = false;

  db.records.forEach(r => {
    if (r.name === account && r.type === "Expense") {
      const d = new Date(r.date + "T00:00:00");
      if (d.getFullYear() === y) {
        hasData = true;
        const m = d.getMonth();
        const taka = parseFloat(r.taka) || 0;
        if (!catMap[r.category]) catMap[r.category] = new Array(12).fill(0);
        catMap[r.category][m] += taka;
      }
    }
  });

  if (!hasData) return { status: "empty", html: "" };
  const colTotals = new Array(12).fill(0);
  let grand = 0, body = "";
  Object.keys(catMap).sort().forEach(cat => {
    let rowTotal = 0, cells = "";
    for (let m = 0; m < 12; m++) { 
      const v = catMap[cat][m]; 
      rowTotal += v; 
      colTotals[m] += v; 
      cells += `<td class="r" style="${v > 0 ? "font-weight:800;" : ""}">${v > 0 ? v.toFixed(0) : "-"}</td>`; 
    }
    grand += rowTotal;
    body += `<tr><td class="l">${esc(cat)}</td>${cells}<td class="r" style="font-weight:800;">${rowTotal.toFixed(0)}</td></tr>`;
  });
  let footCells = colTotals.map(v => `<td class="r">${v > 0 ? v.toFixed(0) : "-"}</td>`).join("");
  body += `<tr style="background:var(--slate-100);font-weight:800;"><td class="l">সর্বমোট (ব্যয়):</td>${footCells}<td class="r">${grand.toFixed(0)}</td></tr>`;
  const heads = monthsBn.map(m => `<th>${m}</th>`).join("");
  const html = `<div style="text-align:center;margin-bottom:10px;"><div style="font-weight:800;">📊 ক্যাটাগরি ভিত্তিক বার্ষিক ব্যয় বিবরণী (${y})</div><div style="font-size:12px;font-weight:700;color:var(--slate-500);">হিসাবের নাম: ${esc(account)}</div></div>
    <table class="dt" style="font-size:11px;"><thead><tr><th>ক্যাটাগরি</th>${heads}<th>মোট ব্যয়</th></tr></thead><tbody>${body}</tbody></table>`;
  return { status: "success", html };
}

/* --------------------------- report entry points --------------------------- */
function runReport(type) {
  const name = val("reportName"), cat = val("reportCategory"), from = val("reportFromDate"), to = val("reportToDate");
  showLoaderState();
  let res;
  if (type === 1) res = renderDetailsView(name, from, to);
  else if (type === 2) res = renderCategoryView(name, from, to);
  else if (type === 3) res = renderPendingReport();
  else if (type === 4) res = renderCategoryDetail(name, cat, from, to);
  showReportResult(res);
}

function getAllEntriesDescendingReportUI() {
  const name = val("reportName");
  if (!name) { showToastAlert("⚠️ অ্যাকাউন্ট সিলেক্ট করুন"); return; }
  showLoaderState();
  showReportResult(renderAllEntriesDescending(name));
}

function loadCashbook() {
  const name = val("reportName"), from = val("reportFromDate"), to = val("reportToDate");
  if (!name) { showToastAlert("অনুগ্রহ করে একটি হিসাবের নাম সিলেক্ট করুন!"); return; }
  showLoaderState();
  showReportResult(renderCashbook(name, from, to));
}

function getMonthlyBalanceReportUI() {
  const name = val("reportName"), year = val("reportYear");
  if (!name) { showToastAlert("⚠️ অ্যাকাউন্ট সিলেক্ট করুন"); return; }
  showLoaderState();
  showReportResult(renderMonthlyBalance(name, year));
}

function getCategoryMonthlyExpenseReportUI() {
  const name = val("reportName"), year = val("reportYear");
  if (!name) { showToastAlert("⚠️ অ্যাকাউন্ট সিলেক্ট করুন"); return; }
  showLoaderState();
  showReportResult(renderCategoryMonthlyExpense(name, year));
}

/* --------------------------- backup / restore --------------------------- */
function exportBackup() {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const d = new Date();
  a.href = url;
  a.download = `accounting_backup_${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToastAlert("⬇️ ব্যাকআপ ফাইল ডাউনলোড হয়েছে।");
}

function handleRestoreFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed || !Array.isArray(parsed.records)) throw new Error("invalid");
      pendingRestoreData = parsed;
      const rModal = document.getElementById("restoreModal");
      if (rModal) rModal.classList.remove("hidden");
    } catch (err) {
      showToastAlert("❌ ফাইলটি সঠিক ব্যাকআপ ফাইল নয়!");
    }
  };
  reader.readAsText(file);
}

function closeRestoreModal() {
  const rModal = document.getElementById("restoreModal");
  if (rModal) rModal.classList.add("hidden");
  if (document.getElementById("restoreFileInput")) document.getElementById("restoreFileInput").value = "";
  pendingRestoreData = null;
}

function confirmRestore() {
  if (!pendingRestoreData) { closeRestoreModal(); return; }
  db = {
    pin: pendingRestoreData.pin || "1234",
    names: Array.isArray(pendingRestoreData.names) ? pendingRestoreData.names : ["Cash"],
    categories: Array.isArray(pendingRestoreData.categories) ? pendingRestoreData.categories : [],
    records: Array.isArray(pendingRestoreData.records) ? pendingRestoreData.records : []
  };
  saveDB();
  closeRestoreModal();
  reloadDropdowns();
  triggerLiveUpdate();
  updateDbStatsText();
  showToastAlert("✅ ডাটাবেজ সফলভাবে রিস্টোর করা হয়েছে।");
  switchTab("dashboard");
}

function updateDbStatsText() {
  const el = document.getElementById("dbStatsText");
  if (!el) return;
  el.innerHTML = `মোট রেকর্ড: <b>${db.records.length}</b> টি &nbsp;•&nbsp; অ্যাকাউন্ট: <b>${db.names.length}</b> টি &nbsp;•&nbsp; ক্যাটাগরি: <b>${db.categories.length}</b> টি<br>ডাটা এই ব্রাউজারের localStorage-এ সংরক্ষিত।`;
}

/* ---------------------------- Document Ready ---------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  loadDB();
  
  const pinInput = document.getElementById("appPinInput");
  if (pinInput) {
    pinInput.addEventListener("keypress", e => { 
      if (e.key === "Enter") checkAppPin(); 
    });
    setTimeout(() => pinInput.focus(), 200);
  }

  const settingsGatePin = document.getElementById("settingsGatePin");
  if (settingsGatePin) {
    settingsGatePin.addEventListener("keypress", e => { 
      if (e.key === "Enter") verifySettingsAccess(); 
    });
  }

  // ফায়ারবেস থেকে রিয়েলটাইম সিঙ্ক
  let isInitialLoad = true;
  const checkFirebase = setInterval(() => {
    if (window.firebaseDB && window.firebaseOnValue && window.firebaseRef) {
      clearInterval(checkFirebase);
      const dataRef = window.firebaseRef(window.firebaseDB, 'myAppData/db');
      window.firebaseOnValue(dataRef, (snapshot) => {
        const fbData = snapshot.val();
        if (fbData && isInitialLoad) {
          db = fbData;
          localStorage.setItem(DB_KEY, JSON.stringify(db));
          reloadDropdowns();
          triggerLiveUpdate();
          isInitialLoad = false;
        }
      });
    }
  }, 500);
});
