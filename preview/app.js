(() => {
  "use strict";

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const viewNames = {
    dashboard: "工作台",
    enterprise: "企业档案",
    library: "资料中心",
    generate: "文档生成",
    archive: "档案库",
    gaps: "功能缺口"
  };

  const sidebar = $("#sidebar");
  const mobileMenu = $("#mobileMenu");
  const mobileScrim = $("#mobileScrim");
  const currentPageLabel = $("#currentPageLabel");
  const toast = $("#toast");
  const toastTitle = $("#toastTitle");
  const toastMessage = $("#toastMessage");
  let toastTimer = null;

  function showToast(message, title = "操作提示") {
    clearTimeout(toastTimer);
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3600);
  }

  function closeMobileNav() {
    sidebar.classList.remove("mobile-open");
    mobileScrim.hidden = true;
  }

  // Account, registration and local demo login state.
  const accountArea = $("#accountArea");
  const accountMenu = $("#accountMenu");
  const userMenuButton = $("#userMenuButton");
  const sidebarUser = $("#sidebarUser");
  const logoutButton = $("#logoutButton");
  const loginScreen = $("#loginScreen");
  const appFrame = $("#appFrame");
  const authCard = $("#authCard");
  const authTabs = $("#authTabs");
  const authTabButtons = $$("[data-auth-tab]");
  const authPanels = $$("[data-auth-panel]");
  const loginForm = $("#loginForm");
  const loginAccount = $("#loginAccount");
  const loginPassword = $("#loginPassword");
  const loginError = $("#loginError");
  const loginSubmit = $("#loginSubmit");
  const passwordToggle = $("#passwordToggle");
  const loginSubmitMarkup = loginSubmit.innerHTML;

  const enterpriseRegisterForm = $("#enterpriseRegisterForm");
  const enterpriseRegisterError = $("#enterpriseRegisterError");
  const enterpriseRegisterSubmit = $("#enterpriseRegisterSubmit");
  const personalRegisterForm = $("#personalRegisterForm");
  const personalRegisterError = $("#personalRegisterError");
  const personalRegisterSubmit = $("#personalRegisterSubmit");
  const personalCompanyCode = $("#personalCompanyCode");
  const verifyCompanyCodeButton = $("#verifyCompanyCode");
  const companyVerifyResult = $("#companyVerifyResult");
  const verifiedCompanyName = $("#verifiedCompanyName");
  const verifiedCompanyMeta = $("#verifiedCompanyMeta");
  const personalGateNote = $("#personalGateNote");
  const personalPending = $("#personalPending");
  let loggingIn = false;
  let currentAuthView = "login";
  let currentEnterprise = null;
  let currentPersonal = null;
  let verifiedCompany = null;

  const authViewPanelIds = {
    login: "authLoginPanel",
    register: "authRegisterHome",
    enterprise: "authEnterprisePanel",
    personal: "authPersonalPanel",
    personalPending: "personalPending"
  };

  function readSession(key) {
    try { return sessionStorage.getItem(key); } catch (error) { return null; }
  }

  function writeSession(key, value) {
    try {
      if (value === null) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, value);
    } catch (error) {
      // Local file preview can run with storage disabled; login still works in-memory.
    }
  }

  function readLocal(key) {
    try { return localStorage.getItem(key); } catch (error) { return null; }
  }

  function writeLocal(key, value) {
    try { localStorage.setItem(key, value); } catch (error) {
      // Registration remains usable for the current page session without storage.
    }
  }

  function getOwnedCompanyFiles(company) {
    if (!company) return [];
    const ownCode = String(company.code || "").trim().toUpperCase();
    const allFiles = Array.isArray(company.libraryFiles) ? company.libraryFiles : [];
    return allFiles.filter((file) => {
      if (!file) return false;
      const fileCode = String(file.accountCode || "").trim().toUpperCase();
      return Boolean(ownCode) && fileCode === ownCode;
    });
  }

  function appendAuditLog(company, action, detail, actor) {
    if (!company) return;
    company.auditLogs = Array.isArray(company.auditLogs) ? company.auditLogs : [];
    company.auditLogs.unshift({
      id: "log-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7),
      action: String(action || "操作"),
      detail: String(detail || ""),
      actor: String(actor || company.account || "系统"),
      createdAt: new Date().toISOString()
    });
    company.auditLogs = company.auditLogs.slice(0, 300);
  }

  function normalizeAccount(value) {
    return String(value || "").trim().toLowerCase();
  }

  // Local preview only. Production authentication must be validated and hashed by a backend.
  function buildPasswordDigest(account, password) {
    const source = normalizeAccount(account) + "\u0000" + String(password || "");
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return "local-preview:" + (hash >>> 0).toString(16).padStart(8, "0");
  }

  function setAccountMenu(open) {
    accountMenu.hidden = !open;
    userMenuButton.setAttribute("aria-expanded", String(open));
  }

  function setAuthView(viewName, focusFirst = false) {
    if (!authViewPanelIds[viewName]) viewName = "login";
    currentAuthView = viewName;
    authPanels.forEach((panel) => {
      panel.hidden = panel.id !== authViewPanelIds[viewName];
    });
    const isRegisterFlow = ["register", "enterprise", "personal"].includes(viewName);
    const isResultView = viewName === "personalPending";
    authTabs.hidden = isResultView;
    authTabButtons.forEach((button) => {
      const active = (button.dataset.authTab === "login" && viewName === "login") ||
        (button.dataset.authTab === "register" && isRegisterFlow);
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    authCard.classList.toggle("auth-card-wide", ["enterprise", "personal", "personalPending"].includes(viewName));
    if (viewName === "login") {
      document.title = "账号登录 · 职安文档云";
    } else if (viewName === "register") {
      document.title = "注册账号 · 职安文档云";
    } else if (viewName === "enterprise") {
      document.title = "创建企业账号 · 职安文档云";
    } else if (viewName === "personal") {
      document.title = "加入企业空间 · 职安文档云";
    } else {
      document.title = "注册申请已提交 · 职安文档云";
    }
    loginScreen.scrollTo({ top: 0, behavior: "smooth" });
    if (focusFirst) {
      let target = null;
      if (viewName === "login") target = loginAccount;
      if (viewName === "enterprise") target = $("#enterpriseAccount");
      if (viewName === "personal") target = personalCompanyCode;
      if (target) setTimeout(() => target.focus(), 90);
    }
  }

  function showLoginScreen(persistLogout = true) {
    currentEnterprise = null;
    currentPersonal = null;
    verifiedCompany = null;
    selectedImportFiles = [];
    setAccountMenu(false);
    closeMobileNav();
    closeModal();
    closeEnterpriseImportModal(true);
    loginScreen.hidden = false;
    if (appFrame) appFrame.hidden = true;
    document.body.classList.add("login-open");
    loginError.hidden = true;
    loginSubmit.disabled = false;
    loginSubmit.innerHTML = loginSubmitMarkup;
    loginPassword.type = "password";
    passwordToggle.setAttribute("aria-label", "显示密码");
    loggingIn = false;
    setAuthView("login");
    writeSession("zadocs_session_company_code", null);
    if (persistLogout) writeSession("zadocs_logged_out", "1");
    setTimeout(() => loginAccount.focus(), 80);
  }

  function hideLoginScreen() {
    loginScreen.hidden = true;
    if (appFrame) appFrame.hidden = false;
    document.body.classList.remove("login-open");
    writeSession("zadocs_logged_out", null);
    resetArchiveViewState();
  }

  function applyWorkspace(companyName, userName, role) {
    const workspaceName = $(".workspace-copy strong");
    const workspaceAvatar = $(".workspace-avatar");
    if (workspaceName) workspaceName.textContent = companyName;
    if (workspaceAvatar) workspaceAvatar.textContent = companyName.slice(0, 1);
    if (userName) {
      const initial = userName.slice(0, 1);
      userMenuButton.textContent = initial;
      const sidebarAvatar = $(".sidebar-user .avatar");
      const sidebarName = $(".sidebar-user strong");
      const sidebarRole = $(".sidebar-user div span");
      const accountAvatar = $(".account-avatar");
      const accountName = $(".account-copy strong");
      const accountAccount = $(".account-copy > span");
      const accountRole = $(".account-copy small");
      if (sidebarAvatar) sidebarAvatar.textContent = initial;
      if (sidebarName) sidebarName.textContent = userName;
      if (sidebarRole) sidebarRole.textContent = role || "企业成员";
      if (accountAvatar) accountAvatar.textContent = initial;
      if (accountName) accountName.textContent = userName;
      if (accountAccount) accountAccount.textContent = currentEnterprise ? currentEnterprise.account : userName;
      if (accountRole) accountRole.innerHTML = "<i></i>" + escapeHtml(role || "企业成员") + " · 当前在线";
    }
  }

  function activateEnterprise(company, sessionUser) {
    if (!company) return;
    currentEnterprise = company;
    currentPersonal = null;
    verifiedCompany = null;
    selectedImportFiles = [];
    company.accountScope = "enterprise:" + normalizeAccount(company.account);
    company.libraryFiles = getOwnedCompanyFiles(company);
    company.importedCategories = Array.isArray(company.importedCategories) ? company.importedCategories : [];
    company.archiveDocuments = Array.isArray(company.archiveDocuments) ? company.archiveDocuments : [];
    ensureLibraryFileMetadata(company);
    ensureArchiveDocuments(company);
    saveCompany(company);
    writeSession("zadocs_session_company_code", company.code);
    writeSession("zadocs_session_member_account", sessionUser && sessionUser.account ? normalizeAccount(sessionUser.account) : null);
    showEnterpriseProfile(company);
    applyWorkspace(
      company.name,
      sessionUser && sessionUser.name || company.account || "企业管理员",
      sessionUser && sessionUser.role || "企业管理员"
    );
    hideLoginScreen();
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    const input = document.createElement("textarea");
    input.value = text;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    try { document.execCommand("copy"); } catch (error) { /* Clipboard may be blocked in file preview. */ }
    input.remove();
  }

  function showFormError(element, message) {
    element.textContent = message;
    element.hidden = false;
    element.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function clearFormError(element) {
    element.hidden = true;
    element.textContent = "";
  }

  function getField(form, name) {
    return form.elements.namedItem(name);
  }

  function isValidPhone(value) {
    return /^1[3-9]\d{9}$/.test(value);
  }

  function loadCompanyDirectory() {
    let stored = [];
    try {
      const parsed = JSON.parse(readLocal("zadocs_registered_companies") || "[]");
      if (Array.isArray(parsed)) stored = parsed;
    } catch (error) {
      stored = [];
    }
    const seen = new Set();
    return stored.filter((company) => {
      if (!company || !company.code || !company.account || company.isDemo === true) return false;
      const code = String(company.code).trim().toUpperCase();
      if (!code || code === "HDJM-8K3F" || seen.has(code)) return false;
      seen.add(code);
      company.code = code;
      company.libraryFiles = getOwnedCompanyFiles(company);
      return true;
    });
  }

  let companyDirectory = loadCompanyDirectory();

  function saveCompany(company) {
    if (!company || !company.code || company.isDemo === true || company.code === "HDJM-8K3F") return;
    const code = String(company.code).trim().toUpperCase();
    company.code = code;
    company.libraryFiles = getOwnedCompanyFiles(company);
    companyDirectory = companyDirectory.filter((item) => item.code !== code).concat(company);
    writeLocal("zadocs_registered_companies", JSON.stringify(companyDirectory));
  }

  function generateCompanyCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let body = "";
    for (let index = 0; index < 4; index += 1) {
      body += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return "QY-" + body + "-26";
  }

  function findCompanyByCode(value) {
    const code = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!code) return null;
    return companyDirectory.find((company) => company.code.toUpperCase() === code) || null;
  }

  function findCompanyByAccount(value) {
    const account = normalizeAccount(value);
    if (!account) return null;
    return companyDirectory.find((company) => normalizeAccount(company.account) === account) || null;
  }

  function resetCompanyVerification() {
    verifiedCompany = null;
    companyVerifyResult.hidden = true;
    personalRegisterSubmit.disabled = true;
    personalGateNote.classList.remove("verified");
    const noteText = personalGateNote.querySelector("span");
    if (noteText) noteText.textContent = "请先验证企业协同码，验证通过后“提交注册申请”才会启用。";
  }

  function verifyPersonalCompany(showMessage = true) {
    const company = findCompanyByCode(personalCompanyCode.value);
    clearFormError(personalRegisterError);
    resetCompanyVerification();
    if (!company) {
      if (showMessage) showFormError(personalRegisterError, "企业协同码无效或不存在。个人账号必须绑定有效企业后才能注册。");
      return false;
    }
    verifiedCompany = company;
    verifiedCompanyName.textContent = company.name;
    const companyIndustry = company.industry || "资料待完善";
    const companyRegion = company.region || "地区待完善";
    const companyCredit = company.creditCode ? "信用代码 " + company.creditCode.slice(0, 6) + "******" : "信用代码待识别";
    verifiedCompanyMeta.textContent = companyIndustry + " · " + companyRegion + " · " + companyCredit;
    companyVerifyResult.hidden = false;
    personalRegisterSubmit.disabled = false;
    personalGateNote.classList.add("verified");
    const noteText = personalGateNote.querySelector("span");
    if (noteText) noteText.textContent = "企业归属已验证，可以提交注册申请。提交后仍需企业管理员审核。";
    return true;
  }

  userMenuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    setAccountMenu(accountMenu.hidden);
  });

  sidebarUser.addEventListener("click", (event) => {
    event.stopPropagation();
    setAccountMenu(accountMenu.hidden);
  });

  logoutButton.addEventListener("click", () => showLoginScreen(true));

  accountMenu.addEventListener("click", (event) => {
    const item = event.target.closest("[role='menuitem']");
    if (item && item !== logoutButton) setAccountMenu(false);
  });

  document.addEventListener("click", (event) => {
    if (!accountMenu.hidden && !accountArea.contains(event.target) && !event.target.closest("#sidebarUser")) {
      setAccountMenu(false);
    }
  });

  authTabs.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-auth-tab]");
    if (!tab) return;
    setAuthView(tab.dataset.authTab === "login" ? "login" : "register", true);
  });

  loginScreen.addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-auth-view]");
    if (viewButton) {
      setAuthView(viewButton.dataset.authView, true);
      return;
    }
    const passwordButton = event.target.closest(".password-toggle");
    if (passwordButton) {
      const target = document.getElementById(passwordButton.dataset.passwordTarget || "loginPassword");
      if (!target) return;
      const reveal = target.type === "password";
      target.type = reveal ? "text" : "password";
      passwordButton.setAttribute("aria-label", reveal ? "隐藏密码" : "显示密码");
      target.focus();
      return;
    }
    const upload = event.target.closest("[data-demo-upload]");
    if (upload) {
      const isUploaded = upload.classList.toggle("uploaded");
      const small = upload.querySelector("small");
      if (small) {
        small.textContent = isUploaded
          ? "已选择：" + upload.dataset.demoUpload + ".xlsx（演示）"
          : (upload.classList.contains("compact") ? "点击选择文件" : "支持 Excel / CSV，演示环境不上传真实文件");
      }
    }
  });

  loginPassword.addEventListener("input", () => { loginError.hidden = true; });
  loginAccount.addEventListener("input", () => { loginError.hidden = true; });

  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (loggingIn) return;
    const account = loginAccount.value.trim();
    const password = loginPassword.value;
    if (!account || !password) {
      loginError.textContent = "请输入账号和密码后再登录。";
      loginError.hidden = false;
      return;
    }

    const company = findCompanyByAccount(account);
    if (!company) {
      loginError.textContent = "该企业账号不存在，请先注册企业账号。";
      loginError.hidden = false;
      loginAccount.focus();
      return;
    }
    if (company.passwordDigest && company.passwordDigest !== buildPasswordDigest(company.account, password)) {
      loginError.textContent = "登录密码不正确，请重新输入。";
      loginError.hidden = false;
      loginPassword.focus();
      return;
    }
    if (!company.passwordDigest) {
      // Migrate accounts created by the earlier local preview, which did not persist a password.
      company.passwordDigest = buildPasswordDigest(company.account, password);
      saveCompany(company);
    }
    loggingIn = true;
    loginSubmit.disabled = true;
    loginSubmit.textContent = "正在加载企业空间...";
    setTimeout(() => {
      loggingIn = false;
      activateEnterprise(company);
      setView(resolveViewFromHash(), false);
      loginSubmit.disabled = false;
      loginSubmit.innerHTML = loginSubmitMarkup;
      showToast("已加载企业账号 " + company.account + " 的独立资料空间。", "登录成功");
    }, 650);
  });

  // Enterprise registration enters the workspace immediately; profile data is supplied by file import.
  const enterpriseRegisterMarkup = enterpriseRegisterSubmit.innerHTML;
  const enterpriseImportModal = $("#enterpriseImportModal");
  const enterpriseImportClose = $("#enterpriseImportClose");
  const enterpriseImportCancel = $("#enterpriseImportCancel");
  const enterpriseImportSubmit = $("#enterpriseImportSubmit");
  const enterpriseImportTitle = $("#enterpriseImportTitle");
  const enterpriseImportValidation = $("#enterpriseImportValidation");
  const enterpriseReplacementBanner = $("#enterpriseReplacementBanner");
  const enterpriseReplacementName = $("#enterpriseReplacementName");
  const enterpriseFileQueue = $("#enterpriseFileQueue");
  const enterpriseFileCount = $("#enterpriseFileCount");
  const enterpriseFileList = $("#enterpriseFileList");
  const enterpriseImportSummary = $("#enterpriseImportSummary");
  const enterpriseImportBanner = $("#enterpriseImportBanner");
  const enterpriseFileInputs = $$("[data-import-category] input[type='file']");
  const importCategoryLabels = {
    company: "企业主体资料",
    employees: "员工与人员名册",
    positions: "岗位与危害因素",
    systems: "制度与补充资料"
  };
  const REQUIRED_IMPORT_CATEGORIES = ["company", "employees", "positions"];
  let selectedImportFiles = [];
  let importingEnterpriseFiles = false;
  let replacementTargetFileId = null;

  function classifyImportFile(fileName) {
    const name = String(fileName || "").toLowerCase();
    if (/(营业执照|证照|资质)/.test(name)) return "company";
    if (/(员工|人员|名册|花名册|体检登记|体检名单|监护|职工|人力资源|预约体检)/.test(name)) return "employees";
    if (/(岗位|危害|检测|职业病危害因素|工作场所|环境检测)/.test(name)) return "positions";
    if (/(企业信息|信息采集|单位信息|工商|信用代码|法人|企业主体)/.test(name)) return "company";
    if (/(企业|公司)/.test(name)) return "company";
    if (/(制度|预案|规程|补充|培训|防护用品|管理)/.test(name)) return "systems";
    return "company";
  }

  function appendImportFiles(fileList, forcedCategory) {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;
    if (replacementTargetFileId) {
      const target = getOwnedCompanyFiles(currentEnterprise).find((file) => file.id === replacementTargetFileId);
      selectedImportFiles = [{
        id: makeLibraryFileId(),
        name: files[0].name,
        size: files[0].size,
        lastModified: files[0].lastModified,
        category: target ? target.category : classifyImportFile(files[0].name),
        sourceFile: files[0],
        importState: "pending"
      }];
      renderImportQueue();
      return;
    }
    files.forEach((file) => {
      const category = importCategoryLabels[forcedCategory] ? forcedCategory : classifyImportFile(file.name);
      const duplicateIndex = selectedImportFiles.findIndex((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified);
      const record = {
        id: makeLibraryFileId(),
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        category: category,
        sourceFile: file,
        importState: "pending"
      };
      if (duplicateIndex >= 0) selectedImportFiles.splice(duplicateIndex, 1, record);
      else selectedImportFiles.push(record);
    });
    renderImportQueue();
  }

  function getImportQueueValidation() {
    const counts = getFileCategoryCounts(selectedImportFiles);
    const missing = REQUIRED_IMPORT_CATEGORIES.filter((category) => counts[category] === 0);
    return { counts, missing, valid: replacementTargetFileId ? selectedImportFiles.length === 1 : missing.length === 0 };
  }

  function renderImportValidation() {
    if (!enterpriseImportValidation) return;
    const validation = getImportQueueValidation();
    if (replacementTargetFileId) {
      enterpriseImportValidation.hidden = selectedImportFiles.length === 0;
      enterpriseImportValidation.innerHTML = selectedImportFiles.length
        ? '<span class="validation-ok"><svg class="icon tiny"><use href="#i-refresh"></use></svg>替换文件已选择，提交后将覆盖当前资料并重新解析。</span>'
        : '<span class="validation-warn"><svg class="icon tiny"><use href="#i-alert"></use></svg>请选择一份替换文件。</span>';
      return;
    }
    if (!selectedImportFiles.length) {
      enterpriseImportValidation.hidden = false;
      enterpriseImportValidation.innerHTML = '<span class="validation-warn"><svg class="icon tiny"><use href="#i-alert"></use></svg>必选：企业主体资料、员工与人员名册、岗位与危害因素；制度与补充资料可选。</span>';
      return;
    }
    enterpriseImportValidation.hidden = false;
    const groupLabels = importCategoryLabels;
    const summary = Object.keys(groupLabels).map((key) => groupLabels[key] + ' ' + validation.counts[key] + ' 份').join(' · ');
    enterpriseImportValidation.innerHTML = validation.missing.length
      ? '<span class="validation-warn"><svg class="icon tiny"><use href="#i-alert"></use></svg>' + escapeHtml(summary) + '；尚缺 ' + escapeHtml(validation.missing.map((key) => groupLabels[key]).join('、')) + '，补齐后才能提交。</span>'
      : '<span class="validation-ok"><svg class="icon tiny"><use href="#i-check"></use></svg>' + escapeHtml(summary) + '；三类必选资料已齐备，可以提交解析。</span>';
  }

  function getFileCategoryCounts(files) {
    return (Array.isArray(files) ? files : []).reduce((counts, file) => {
      if (file && importCategoryLabels[file.category]) counts[file.category] += 1;
      return counts;
    }, { company: 0, employees: 0, positions: 0, systems: 0 });
  }

  function setElementText(selector, value) {
    const element = $(selector);
    if (element) element.textContent = value;
  }

  function formatFileSize(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
    if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  }

  const MAX_STORED_TEXT = 60000;
  const MAX_SHEET_ROWS = 80;
  const MAX_SHEET_COLS = 30;
  const MAX_PREVIEW_SHEETS = 6;
  const MAX_PARSE_FILE_SIZE = 40 * 1024 * 1024;

  function getFileExtension(name) {
    const parts = String(name || "").split(".");
    return parts.length > 1 ? parts.pop().toLowerCase() : "";
  }

  function makeLibraryFileId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return "file-" + window.crypto.randomUUID();
    }
    return "file-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function createEmptyParseResult(kind, label, parser, error) {
    return {
      kind: kind || "unknown",
      label: label || "未知格式",
      parser: parser || "local",
      error: error || "",
      parsedAt: new Date().toISOString()
    };
  }

  function limitExtractedText(value, limit = MAX_STORED_TEXT) {
    const normalized = String(value || "")
      .replace(/\u0000/g, "")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim();
    return {
      text: normalized.slice(0, limit),
      characters: normalized.length,
      truncated: normalized.length > limit
    };
  }

  function decodeTextBuffer(buffer) {
    let text = new TextDecoder("utf-8").decode(buffer);
    const replacementCount = (text.match(/\uFFFD/g) || []).length;
    if (replacementCount > Math.max(3, text.length * 0.005)) {
      try {
        const gbText = new TextDecoder("gb18030").decode(buffer);
        if ((gbText.match(/\uFFFD/g) || []).length < replacementCount) text = gbText;
      } catch (error) {
        // UTF-8 remains the fallback when GB18030 decoding is unavailable.
      }
    }
    return text.replace(/^\uFEFF/, "");
  }

  function parseDelimitedRows(text) {
    const source = String(text || "").replace(/^\uFEFF/, "");
    const sample = source.slice(0, 20000);
    const delimiter = (sample.split("\t").length > sample.split(",").length) ? "\t" : ",";
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;

    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];
      if (quoted) {
        if (character === '"' && source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else if (character === '"') {
          quoted = false;
        } else {
          cell += character;
        }
      } else if (character === '"') {
        quoted = true;
      } else if (character === delimiter) {
        row.push(cell);
        cell = "";
      } else if (character === "\n" || character === "\r") {
        if (character === "\r" && source[index + 1] === "\n") index += 1;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += character;
      }
    }
    if (cell.length || row.length) {
      row.push(cell);
      rows.push(row);
    }
    return rows;
  }

  function compactTableRows(rows) {
    const allRows = Array.isArray(rows) ? rows : [];
    const columnCount = allRows.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
    const visibleRows = allRows.slice(0, MAX_SHEET_ROWS).map((row) => {
      const values = Array.isArray(row) ? row : [];
      const compact = [];
      for (let index = 0; index < Math.min(columnCount, MAX_SHEET_COLS); index += 1) {
        const raw = values[index] == null ? "" : String(values[index]);
        compact.push(raw.length > 500 ? raw.slice(0, 500) + "..." : raw);
      }
      return compact;
    });
    const text = visibleRows.map((row) => row.join("\t")).join("\n");
    return {
      rows: visibleRows,
      rowCount: allRows.length,
      columnCount,
      truncated: allRows.length > MAX_SHEET_ROWS || columnCount > MAX_SHEET_COLS,
      textCharacters: text.length
    };
  }

  function extractWordParagraphs(xml) {
    const documentXml = new DOMParser().parseFromString(xml, "application/xml");
    const parserError = documentXml.querySelector("parsererror");
    if (parserError) throw new Error("Word 文档 XML 结构损坏，无法读取正文。");
    const paragraphs = Array.from(documentXml.getElementsByTagNameNS("*", "p"));
    const lines = [];
    paragraphs.forEach((paragraph) => {
      let line = "";
      const walk = (node) => {
        if (node.nodeType === 3) {
          line += node.nodeValue || "";
          return;
        }
        if (node.nodeType !== 1) return;
        const localName = node.localName;
        if (localName === "t") {
          line += node.textContent || "";
          return;
        }
        if (localName === "tab") {
          line += "\t";
          return;
        }
        if (localName === "br" || localName === "cr") {
          line += "\n";
          return;
        }
        Array.from(node.childNodes || []).forEach(walk);
      };
      walk(paragraph);
      const normalized = line.replace(/[ \t]+/g, " ").trim();
      if (normalized) lines.push(normalized);
    });
    return lines.join("\n");
  }

  async function parsePdfFile(file) {
    if (!window.pdfjsLib) throw new Error("PDF 解析组件未加载，请确认 vendor/pdf.min.js 存在。");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("vendor/pdf.worker.min.js", document.baseURI).href;
    const buffer = await file.arrayBuffer();
    const loadingTask = window.pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      useSystemFonts: true
    });
    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;
    const pages = [];
    let characterCount = 0;
    let truncated = false;
    try {
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        let pageText = "";
        content.items.forEach((item) => {
          pageText += item.str || "";
          pageText += item.hasEOL ? "\n" : " ";
        });
        pageText = pageText.replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
        characterCount += pageText.length;
        if (characterCount <= MAX_STORED_TEXT) {
          pages.push({ page: pageNumber, text: pageText });
        } else {
          truncated = true;
        }
        page.cleanup();
        if (characterCount > MAX_STORED_TEXT * 1.2) break;
      }
    } finally {
      await pdf.destroy();
    }

    const result = createEmptyParseResult("pdf", "PDF 文档", "PDF.js");
    result.pageCount = pageCount;
    result.pages = pages;
    result.characters = characterCount;
    result.truncated = truncated || pages.length < pageCount;
    if (!pages.some((page) => page.text.trim())) {
      result.kind = "pdf";
      result.label = "扫描版 PDF";
      result.error = "未提取到可复制文字，文件可能是扫描件或图片型 PDF。当前本地预览未启用 OCR。";
      return { parseStatus: "ocr-required", parseResult: result };
    }
    return { parseStatus: "parsed", parseResult: result };
  }

  async function parseWordFile(file) {
    if (!window.JSZip) throw new Error("Word 解析组件未加载，请确认 vendor/jszip.min.js 存在。");
    const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
    const documentEntry = zip.file("word/document.xml");
    if (!documentEntry) throw new Error("该 Word 文件缺少正文结构，可能不是标准 DOCX 文件。");
    const xml = await documentEntry.async("string");
    const extracted = limitExtractedText(extractWordParagraphs(xml));
    const result = createEmptyParseResult("docx", "Word 文档", "JSZip");
    result.text = extracted.text;
    result.characters = extracted.characters;
    result.truncated = extracted.truncated;
    if (!extracted.text) {
      result.error = "Word 文档正文为空，未提取到文字。";
      return { parseStatus: "failed", parseResult: result };
    }
    return { parseStatus: "parsed", parseResult: result };
  }

  async function parseWorkbookFile(file, extension) {
    if (!window.XLSX) throw new Error("Excel 解析组件未加载，请确认 vendor/xlsx.full.min.js 存在。");
    const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const sheetNames = workbook.SheetNames || [];
    const sheets = sheetNames.slice(0, MAX_PREVIEW_SHEETS).map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
      const compact = compactTableRows(rows);
      return Object.assign({ name: sheetName }, compact);
    });
    const result = createEmptyParseResult(extension === "csv" ? "csv" : "xlsx", extension === "csv" ? "CSV 表格" : "Excel 工作簿", "SheetJS");
    result.sheets = sheets;
    result.sheetCount = sheetNames.length;
    result.totalRows = sheets.reduce((total, sheet) => total + sheet.rowCount, 0);
    if (!sheets.length) {
      result.error = "工作簿中没有可读取的工作表。";
      return { parseStatus: "failed", parseResult: result };
    }
    return { parseStatus: "parsed", parseResult: result };
  }

  async function parseCsvFile(file) {
    const text = decodeTextBuffer(await file.arrayBuffer());
    const compact = compactTableRows(parseDelimitedRows(text));
    const result = createEmptyParseResult("csv", "CSV 表格", "内置 CSV 解析");
    result.sheets = [Object.assign({ name: "数据表" }, compact)];
    result.sheetCount = 1;
    result.totalRows = compact.rowCount;
    if (!compact.rowCount) {
      result.error = "CSV 文件中没有可读取的数据行。";
      return { parseStatus: "failed", parseResult: result };
    }
    return { parseStatus: "parsed", parseResult: result };
  }

  function parseOcrJson(value) {
    const source = String(value || "").trim();
    if (!source.startsWith("{")) return null;
    try {
      const parsed = JSON.parse(source);
      if (!parsed || typeof parsed !== "object") return null;
      const ocrFields = parsed.ocrFields || parsed;
      if (!ocrFields || (!ocrFields.report && !Array.isArray(ocrFields.results))) return null;
      return ocrFields;
    } catch (error) {
      return null;
    }
  }

  async function parseTextFile(file) {
    const rawText = decodeTextBuffer(await file.arrayBuffer());
    const extracted = limitExtractedText(rawText);
    const result = createEmptyParseResult("txt", "文本文件", "内置文本解析");
    result.text = extracted.text;
    result.characters = extracted.characters;
    result.truncated = extracted.truncated;
    result.lineCount = extracted.text ? extracted.text.split(/\n/).length : 0;
    const ocrFields = parseOcrJson(extracted.text);
    if (ocrFields) {
      result.kind = "ocr-json";
      result.label = "OCR 结构化 JSON";
      result.parser = "OCR JSON";
      result.ocrFields = ocrFields;
      const report = ocrFields.report || {};
      const lines = [];
      if (report.reportNumber) lines.push("报告编号：" + report.reportNumber);
      if (report.employerNameOnReport) lines.push("用人单位：" + report.employerNameOnReport);
      if (report.position) lines.push("岗位：" + report.position);
      if (report.workplace) lines.push("工作场所：" + report.workplace);
      if (report.occupationalDiseaseRiskCategory) lines.push("风险分类：" + report.occupationalDiseaseRiskCategory);
      (ocrFields.results || []).forEach((item) => {
        if (!item) return;
        lines.push([item.factor, item.metric, item.result, item.unit, "标准 " + (item.standard || ""), item.judgement].filter(Boolean).join(" "));
      });
      if (lines.length) result.text = (result.text ? result.text + "\n\n" : "") + lines.join("\n");
    }
    const pageMatches = [...extracted.text.matchAll(/(?:^|\n)={3,}\s*page[-_ ]?0*(\d+)\s*={3,}(?:\n|$)/gi)];
    if (pageMatches.length) {
      result.kind = "pdf";
      result.label = "OCR 文本（PDF 扫描件）";
      result.parser = "本地 OCR 文本";
      result.pages = extracted.text.split(/(?:^|\n)={3,}\s*page[-_ ]?0*\d+\s*={3,}(?:\n|$)/gi)
        .slice(1)
        .map((text, index) => ({ page: index + 1, text: text.trim() }));
      result.pageCount = result.pages.length;
      result.characters = result.pages.reduce((total, page) => total + page.text.length, 0);
    }
    if (!extracted.text) {
      result.error = "文本文件中没有可读取的内容。";
      return { parseStatus: "failed", parseResult: result };
    }
    return { parseStatus: "parsed", parseResult: result };
  }

  async function parseUploadedFile(fileRecord) {
    const file = fileRecord.sourceFile;
    if (!(file instanceof File)) throw new Error("未找到原始文件，请重新选择后上传。");
    if (file.size > MAX_PARSE_FILE_SIZE) {
      throw new Error("文件超过 40 MB，本地预览暂不解析。请拆分文件后重新上传。");
    }
    const extension = getFileExtension(file.name);
    if (extension === "pdf") return parsePdfFile(file);
    if (extension === "docx") return parseWordFile(file);
    if (extension === "xlsx" || extension === "xls") return parseWorkbookFile(file, extension);
    if (extension === "csv") return parseCsvFile(file);
    if (extension === "txt" || extension === "json") return parseTextFile(file);
    if (extension === "doc") {
      throw new Error("旧版 DOC 二进制格式暂不支持解析，请另存为 DOCX 后重新上传。");
    }
    throw new Error("暂不支持 ." + (extension || "未知") + " 格式，请使用 PDF、DOCX、XLSX、XLS、CSV 或 TXT。");
  }

  function getParseSummary(file) {
    const result = file && file.parseResult;
    if (!result) return "尚未解析";
    if (file.parseStatus === "ocr-required") return "扫描版 PDF · 需要 OCR";
    if (file.parseStatus === "failed") return result.error || "解析失败";
    if (result.kind === "pdf") {
      return "PDF · " + result.pageCount + " 页 · " + Number(result.characters || 0).toLocaleString("zh-CN") + " 字";
    }
    if (result.kind === "xlsx" || result.kind === "csv") {
      return result.label + " · " + result.sheetCount + " 个工作表 · " + Number(result.totalRows || 0).toLocaleString("zh-CN") + " 行";
    }
    if (result.kind === "docx" || result.kind === "txt" || result.kind === "ocr-json" || result.kind === "pdf") {
      return result.label + " · " + Number(result.characters || 0).toLocaleString("zh-CN") + " 字";
    }
    return result.label || "已解析";
  }

  function getLibraryStatus(file) {
    if (file && file.reviewedAt && file.parseStatus === "parsed") {
      return { label: "已核查", tone: "verified", action: "查看解析" };
    }
    if (!file || !file.parseStatus || file.parseStatus === "pending") {
      return { label: "待解析", tone: "pending", action: "核查" };
    }
    if (file.parseStatus === "parsed") return { label: "待核查", tone: "pending", action: "核查" };
    if (file.parseStatus === "ocr-required") return { label: "需 OCR", tone: "pending", action: "查看原因" };
    if (file.parseStatus === "legacy") return { label: "需重新上传", tone: "pending", action: "查看原因" };
    return { label: "解析失败", tone: "blocked", action: "查看原因" };
  }

  function ensureLibraryFileMetadata(company) {
    if (!company) return;
    const files = getOwnedCompanyFiles(company);
    let changed = false;
    files.forEach((file) => {
      if (!file.id) {
        file.id = makeLibraryFileId();
        changed = true;
      }
      if (!file.parseStatus) {
        file.parseStatus = "legacy";
        changed = true;
      }
    });
    company.libraryFiles = files;
    if (changed) saveCompany(company);
  }

  const archiveStatusMeta = {
    draft: { label: "草稿", tone: "draft", iconTone: "blue" },
    review: { label: "待审核", tone: "review", iconTone: "amber" },
    signed: { label: "已签发", tone: "signed", iconTone: "green" },
    archived: { label: "已归档", tone: "archived", iconTone: "slate" }
  };

  function getArchiveStatusMeta(status) {
    return archiveStatusMeta[status] || archiveStatusMeta.draft;
  }

  function makeArchiveDocumentId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return "archive-" + window.crypto.randomUUID();
    }
    return "archive-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function getNextArchiveSequence(documents) {
    const year = String(new Date().getFullYear());
    const highest = (Array.isArray(documents) ? documents : []).reduce((max, document) => {
      const match = /^DA-(\d{4})-(\d+)$/.exec(String(document && document.documentNumber || ""));
      if (!match || match[1] !== year) return max;
      return Math.max(max, Number(match[2]) || 0);
    }, 0);
    return highest + 1;
  }

  function ensureArchiveDocuments(company) {
    if (!company) return [];
    const ownCode = String(company.code || "").trim().toUpperCase();
    if (!ownCode) return [];
    const source = Array.isArray(company.archiveDocuments) ? company.archiveDocuments : [];
    const ownDocuments = [];
    const now = new Date().toISOString();
    let changed = !Array.isArray(company.archiveDocuments);

    source.forEach((document) => {
      if (!document || typeof document !== "object") {
        changed = true;
        return;
      }
      const documentCode = String(document.accountCode || "").trim().toUpperCase();
      if (!documentCode || documentCode !== ownCode) {
        changed = true;
        return;
      }
      if (document.accountCode !== ownCode) {
        document.accountCode = ownCode;
        changed = true;
      }
      if (!document.id) {
        document.id = makeArchiveDocumentId();
        changed = true;
      }
      const status = archiveStatusMeta[document.status] ? document.status : "draft";
      if (document.status !== status) {
        document.status = status;
        changed = true;
      }
      const meta = getArchiveStatusMeta(status);
      if (!document.name) {
        document.name = "未命名档案";
        changed = true;
      }
      if (!document.documentNumber) {
        document.documentNumber = "DA-" + new Date().getFullYear() + "-" + String(getNextArchiveSequence(ownDocuments)).padStart(4, "0");
        changed = true;
      }
      if (!document.version) {
        document.version = "V1.0";
        changed = true;
      }
      if (!Object.prototype.hasOwnProperty.call(document, "signer")) {
        document.signer = "";
        changed = true;
      }
      if (!Object.prototype.hasOwnProperty.call(document, "signedAt")) {
        document.signedAt = "";
        changed = true;
      }
      if (!document.retention) {
        document.retention = "30 年";
        changed = true;
      }
      if (!document.createdAt) {
        document.createdAt = now;
        changed = true;
      }
      if (!document.iconTone) {
        document.iconTone = meta.iconTone;
        changed = true;
      }
      if (!document.iconLetter) {
        document.iconLetter = String(document.name).trim().charAt(0).toUpperCase() || "D";
        changed = true;
      }
      ownDocuments.push(document);
    });

    company.archiveDocuments = ownDocuments;
    if (changed) saveCompany(company);
    return ownDocuments;
  }

  function setProfileCompleteness(value, hint) {
    setElementText("#profileCompletenessValue", value + "%");
    setElementText("#profileCompletenessHint", hint);
    const bar = $("#profileCompletenessBar");
    if (bar) bar.style.width = Math.max(0, Math.min(100, value)) + "%";
  }

  function setCompanyStatus(label, tone = "pending") {
    const status = $("#currentCompanyStatus");
    if (!status) return;
    status.className = "status-badge " + tone;
    status.innerHTML = '<svg class="icon tiny"><use href="' + (tone === "verified" ? "#i-check" : "#i-alert") + '"></use></svg>' + escapeHtml(label);
  }

  function resetPositionTable(message) {
    const body = $("#positionTableBody");
    if (!body) return;
    body.innerHTML = '<tr><td class="enterprise-empty-cell" colspan="7">' + escapeHtml(message) + '</td></tr>';
  }

  function resetEmployeeImportPanel(title, copy) {
    setElementText("#employeeImportTitle", title);
    setElementText("#employeeImportCopy", copy);
  }

  function calculateEnterpriseCompleteness(fileState) {
    if (!fileState) return 0;
    const completed = REQUIRED_IMPORT_CATEGORIES.filter((category) => {
      const state = fileState.categoryStates[category];
      return state && state.key === "reviewed" && state.files.length > 0;
    }).length;
    return Math.round(completed / REQUIRED_IMPORT_CATEGORIES.length * 100);
  }

  function getEnterpriseFileState(company) {
    const allCategories = Object.keys(importCategoryLabels);
    const files = getOwnedCompanyFiles(company);
    const categories = Array.from(new Set(files.map((file) => file.category).filter((category) => allCategories.includes(category))));
    const parsedFiles = files.filter((file) => file.parseStatus === "parsed");
    const reviewedFiles = parsedFiles.filter((file) => file.reviewedAt);
    const pendingReview = parsedFiles.filter((file) => !file.reviewedAt);
    const issueFiles = files.filter((file) => ["failed", "ocr-required", "legacy", "pending"].includes(file.parseStatus));
    const categoryStates = allCategories.reduce((states, category) => {
      const categoryFiles = files.filter((file) => file.category === category);
      const parsedInCategory = categoryFiles.filter((file) => file.parseStatus === "parsed");
      const pendingInCategory = parsedInCategory.filter((file) => !file.reviewedAt);
      const issuesInCategory = categoryFiles.filter((file) => ["failed", "ocr-required", "legacy", "pending"].includes(file.parseStatus));
      if (!categoryFiles.length) states[category] = { key: "missing", label: category === "systems" ? "可选未上传" : "待上传", files: categoryFiles };
      else if (issuesInCategory.length || !parsedInCategory.length) states[category] = { key: "issue", label: "待处理", files: categoryFiles };
      else if (pendingInCategory.length) states[category] = { key: "review", label: "待核查", files: categoryFiles };
      else states[category] = { key: "reviewed", label: "文件已核查", files: categoryFiles };
      return states;
    }, {});
    const missingCategories = REQUIRED_IMPORT_CATEGORIES.filter((category) => !categories.includes(category));
    const optionalMissingCategories = allCategories.filter((category) => !REQUIRED_IMPORT_CATEGORIES.includes(category) && !categories.includes(category));
    const result = { allCategories, categories, files, parsedFiles, reviewedFiles, pendingReview, issueFiles, missingCategories, optionalMissingCategories, categoryStates };
    result.completeness = calculateEnterpriseCompleteness(result);
    result.requiredComplete = REQUIRED_IMPORT_CATEGORIES.every((category) => result.categoryStates[category].key === "reviewed");
    return result;
  }

  function getProfileFieldLabel(state) {
    if (!state || state.key === "missing") return "待上传";
    if (state.key === "issue") return "待处理";
    if (state.key === "review") return "待核查";
    return "待字段映射";
  }

  function getShortProfileFieldLabel(state) {
    if (!state || state.key === "missing") return "0";
    if (state.key === "issue") return "待处理";
    if (state.key === "review") return "待核查";
    return "待映射";
  }

  function setEmployeeFieldChecks(state) {
    const element = $("#employeeFieldChecks");
    if (!element) return;
    let label = "需至少包含 6 个字段，导入后再进行映射";
    if (state && state.key === "issue") label = "文件存在异常，暂不能进行字段映射";
    else if (state && state.key === "review") label = "文件待核查，6 个员工字段尚未映射";
    else if (state && state.key === "reviewed") label = "姓名、部门、岗位、接害因素、入职时间、体检状态待映射";
    element.innerHTML = '<span class="missing">' + escapeHtml(label) + '</span>';
  }

  const ENTERPRISE_MAPPING_VERSION = "1";

  function getEnterpriseMappingSignature(company) {
    const reviewedFiles = getOwnedCompanyFiles(company)
      .filter((file) => file && file.parseStatus === "parsed" && file.reviewedAt)
      .map((file) => [
        file.id || "",
        file.reviewedAt || "",
        file.parseStatus || "",
        file.category || "",
        file.name || ""
      ].join("|"))
      .sort();
    return "mapper-" + ENTERPRISE_MAPPING_VERSION + "::" + reviewedFiles.join("::");
  }

  function ensureEnterpriseMapping(company) {
    if (!company) return null;
    ensureLibraryFileMetadata(company);
    const signature = getEnterpriseMappingSignature(company);
    const hasReviewedFiles = signature !== "mapper-" + ENTERPRISE_MAPPING_VERSION + "::";
    if (!hasReviewedFiles) {
      if (company.enterpriseMapping) {
        delete company.enterpriseMapping;
        saveCompany(company);
      }
      return null;
    }
    const existing = company.enterpriseMapping;
    if (existing && existing.version === 1 && existing.signature === signature) return existing;
    if (!window.EnterpriseMapper || typeof window.EnterpriseMapper.build !== "function") return null;
    try {
      const mapping = window.EnterpriseMapper.build(company);
      mapping.signature = signature;
      company.enterpriseMapping = mapping;
      saveCompany(company);
      return mapping;
    } catch (error) {
      console.error("Enterprise mapping failed", error);
      return existing && existing.signature === signature ? existing : null;
    }
  }

  function invalidateEnterpriseMapping(company) {
    if (!company) return;
    if (Object.prototype.hasOwnProperty.call(company, "enterpriseMapping")) delete company.enterpriseMapping;
  }

  function appendFileStateHint(hint, state) {
    if (state && state.key === "issue") return hint + " · 另有文件待处理";
    if (state && state.key === "review") return hint + " · 另有文件待核查";
    return hint;
  }

  function getRiskTagClass(riskLevel) {
    if (riskLevel === "高风险" || riskLevel === "严重") return "high";
    if (riskLevel === "中风险" || riskLevel === "较重") return "mid";
    if (riskLevel === "低风险" || riskLevel === "一般") return "low";
    return "mid";
  }

  function renderMappingWarnings(mapping) {
    const element = $("#enterpriseMappingWarnings");
    if (!element) return;
    const warnings = mapping && Array.isArray(mapping.warnings) ? mapping.warnings : [];
    element.hidden = warnings.length === 0;
    element.innerHTML = warnings.map((warning) => '<div class="enterprise-mapping-warning">' +
      '<span><svg class="icon"><use href="#i-alert"></use></svg></span>' +
      '<div><strong>' + escapeHtml(warning.title || "来源信息存在差异") + '</strong><p>' + escapeHtml(warning.message || "") + '</p></div>' +
      '</div>').join("");
  }

  function renderMappedPositions(mapping) {
    const body = $("#positionTableBody");
    if (!body || !mapping) return 0;
    const positions = Array.isArray(mapping.positions) ? mapping.positions : [];
    if (!positions.length) {
      resetPositionTable("已核查文件暂未识别到岗位、部门或危害因素字段。");
      return 0;
    }
    const dotClasses = ["blue", "amber", "green", "violet", "slate", "red"];
    body.innerHTML = positions.map((position, index) => {
      const hazards = Array.isArray(position.hazards) ? position.hazards : [];
      const tags = hazards.length
        ? hazards.map((hazard) => '<span>' + escapeHtml(hazard) + '</span>').join("")
        : '<span>未识别</span>';
      const completeness = Math.max(0, Math.min(100, Number(position.completeness) || 0));
      return '<tr>' +
        '<td><div class="position-cell"><span class="dept-dot ' + dotClasses[index % dotClasses.length] + '"></span><div><strong>' + escapeHtml(position.name || "未命名岗位") + '</strong><small>' + escapeHtml(position.department || "资料未提供") + '</small></div></div></td>' +
        '<td><div class="tag-list">' + tags + '</div></td>' +
        '<td><span class="risk-tag ' + getRiskTagClass(position.riskLevel) + '">' + escapeHtml(position.riskLevel || "待评估") + '</span></td>' +
        '<td>' + escapeHtml(String(Number(position.relatedCount) || 0)) + '</td>' +
        '<td><div class="cell-progress"><span><i style="width:' + completeness + '%"></i></span><b>' + completeness + '%</b></div></td>' +
        '<td>' + escapeHtml(position.documents || "待生成") + '</td>' +
        '<td><span class="status-badge ' + (position.source === "检测报告" ? "verified" : "draft") + '">' + escapeHtml(position.source || "已映射") + '</span></td>' +
        '</tr>';
    }).join("");
    return positions.length;
  }

  function renderMappedDetectionPoints(mapping) {
    const element = $("#detectionPointList");
    if (!element) return 0;
    const points = mapping && Array.isArray(mapping.detectionPoints) ? mapping.detectionPoints : [];
    if (!points.length) {
      element.hidden = true;
      element.innerHTML = "";
      return 0;
    }
    const uniqueNames = new Set(points.map((point) => String(point.name || "").trim()).filter(Boolean));
    const report = mapping.report || {};
    const meta = [report.reportNo ? "报告编号 " + report.reportNo : "", report.reportDate ? "检测日期 " + report.reportDate : ""].filter(Boolean).join(" · ");
    element.hidden = false;
    element.innerHTML = '<div class="detection-point-head"><div><strong>检测结果</strong><span>' + escapeHtml(meta || "检测报告已自动映射") + '</span></div><b>' + uniqueNames.size + ' 个点位 · ' + points.length + ' 条结果</b></div>' +
      '<div class="detection-point-rows">' + points.map((point) => {
        const judgement = String(point.judgement || "待确认");
        const judgementClass = judgement === "合格" ? "pass" : judgement === "不合格" ? "fail" : "neutral";
        return '<div class="detection-point-row">' +
          '<div class="detection-point-name"><strong>' + escapeHtml(point.name || "未命名点位") + '</strong><small>' + escapeHtml((point.hazard || "危害因素待确认") + (point.reportDate ? " · " + point.reportDate : "")) + '</small></div>' +
          '<div class="detection-reading"><strong>' + escapeHtml(point.result || "—") + '</strong><small>限值 ' + escapeHtml(point.standard || "—") + '</small></div>' +
          '<span class="detection-judgement ' + judgementClass + '">' + escapeHtml(judgement) + '</span>' +
          '</div>';
      }).join("") + '</div>';
    return uniqueNames.size;
  }

  function maskIdNumber(value) {
    const text = String(value || "").trim();
    if (text.length < 8) return text || "—";
    return text.slice(0, 6) + "********" + text.slice(-4);
  }

  function renderMappedEmployees(mapping) {
    const element = $("#employeeMappingList");
    const employees = mapping && Array.isArray(mapping.employees) ? mapping.employees : [];
    if (!element) return employees.length;
    if (!employees.length) {
      element.hidden = true;
      element.innerHTML = "";
      return 0;
    }
    element.hidden = false;
    element.innerHTML = '<div class="mapped-employee-head"><strong>员工自动映射结果</strong><span>' + employees.length + ' 人 · 已关联岗位与接害因素</span></div>' +
      '<div class="mapped-employee-row mapped-employee-row-head"><span>员工</span><span>岗位</span><span>危害因素</span><span>体检类别</span></div>' +
      employees.map((employee) => {
        const hazards = Array.isArray(employee.hazards) && employee.hazards.length ? employee.hazards.join("、") : "未识别";
        return '<div class="mapped-employee-row">' +
          '<div><strong>' + escapeHtml(employee.name || "未命名") + '</strong><small>' + escapeHtml(maskIdNumber(employee.idNumber)) + '</small></div>' +
          '<span>' + escapeHtml(employee.position || "岗位待补充") + '</span>' +
          '<span>' + escapeHtml(hazards) + '</span>' +
          '<span>' + escapeHtml(employee.examType || "待确认") + '</span>' +
          '</div>';
      }).join("");
    return employees.length;
  }

  function renderMappedEnterpriseProfile(company, mapping, fileState) {
    const profile = mapping.profile || {};
    const mappedProfileFields = Array.isArray(mapping.profileFields) ? mapping.profileFields : [];
    const hasProfile = mappedProfileFields.length > 0;
    if (!hasProfile) return;
    const companyState = fileState.categoryStates.company;
    if (profile.companyName) {
      setElementText("#currentCompanyTitle", profile.companyName);
      setElementText("#currentCompanyLogo", profile.companyName.slice(0, 1) || "企");
    }
    setElementText("#currentCompanyCredit", profile.creditCode
      ? "统一社会信用代码：" + profile.creditCode
      : companyState.key === "reviewed" ? "统一社会信用代码：未识别" : "统一社会信用代码：待核查识别结果");
    setElementText("#enterpriseIndustry", profile.industry || (companyState.key === "reviewed" ? "未识别" : getProfileFieldLabel(companyState)));
    setElementText("#enterpriseScale", profile.scale || (companyState.key === "reviewed" ? "未识别" : getProfileFieldLabel(companyState)));
    const exposedCount = profile.exposedCount || String((mapping.employees || []).length || "");
    setElementText("#enterpriseExposed", exposedCount ? exposedCount + " 人" : "未识别");
    const workplaces = Array.from(new Set((mapping.detectionPoints || []).map((point) => String(point.name || "").trim()).filter(Boolean)));
    const location = mapping.report && mapping.report.workplace ? mapping.report.workplace : (profile.address || (workplaces.length ? workplaces.join("、") : "未识别"));
    setElementText("#enterpriseLocations", location);
    if (profile.year) setElementText("#enterpriseYear", profile.year + " 年");
    renderMappingWarnings(mapping);
  }

  function showEnterpriseProfile(company) {
    ensureLibraryFileMetadata(company);
    showNewEnterpriseProfile(company);
    const mapping = ensureEnterpriseMapping(company);
    const fileState = getEnterpriseFileState(company);
    const categories = fileState.categories;
    const files = fileState.files;
    const parsedFiles = fileState.parsedFiles;
    const reviewedFiles = fileState.reviewedFiles;
    const pendingReview = fileState.pendingReview;
    const issueFiles = fileState.issueFiles;
    const missing = fileState.missingCategories;
    const companyState = fileState.categoryStates.company;
    const positionState = fileState.categoryStates.positions;
    const employeeState = fileState.categoryStates.employees;
    const systemState = fileState.categoryStates.systems;
    const completeness = fileState.completeness;
    const created = company.createdAt ? new Date(company.createdAt) : null;
    if (created && !Number.isNaN(created.getTime())) setElementText("#enterpriseYear", created.getFullYear() + " 年");

    if (mapping) {
      renderMappedEnterpriseProfile(company, mapping, fileState);
    } else {
      renderMappingWarnings(null);
      setElementText("#enterpriseIndustry", getProfileFieldLabel(companyState));
      setElementText("#enterpriseScale", getProfileFieldLabel(companyState));
      setElementText("#enterpriseLocations", getProfileFieldLabel(companyState));
      setElementText("#enterpriseExposed", getShortProfileFieldLabel(employeeState));
      setElementText("#currentCompanyCredit", companyState.key === "reviewed"
        ? "统一社会信用代码：已核查，未识别"
        : companyState.key === "review"
          ? "统一社会信用代码：待核查识别结果"
          : companyState.key === "issue"
            ? "统一社会信用代码：文件待处理"
            : "统一社会信用代码：待上传营业执照后识别");
    }

    const positions = mapping && Array.isArray(mapping.positions) ? mapping.positions : [];
    if (positions.length) {
      setElementText("#positionStatValue", String(positions.length));
      setElementText("#positionStatHint", appendFileStateHint("危害因素与关联人数已映射", positionState));
      setElementText("#positionMapBadge", positions.length + " 个岗位");
      renderMappedPositions(mapping);
    } else if (positionState.key === "missing") {
      setElementText("#positionStatValue", "0");
      setElementText("#positionStatHint", "尚未导入岗位资料");
      setElementText("#positionMapBadge", "0 个岗位");
      resetPositionTable("尚未导入岗位与危害因素资料。上传并核查文件后，系统会自动映射。");
    } else if (positionState.key === "issue") {
      setElementText("#positionStatValue", "待处理");
      setElementText("#positionStatHint", "岗位文件存在解析异常");
      setElementText("#positionMapBadge", "待处理");
      resetPositionTable("岗位文件存在解析异常，请先在资料中心处理后再自动映射。");
    } else if (positionState.key === "review") {
      setElementText("#positionStatValue", "待核查");
      setElementText("#positionStatHint", "岗位文件已解析，等待核查");
      setElementText("#positionMapBadge", "待核查");
      resetPositionTable("岗位文件已解析，请先在工作台核查文件内容，核查后会自动映射。");
    } else {
      setElementText("#positionStatValue", "0");
      setElementText("#positionStatHint", "已核查，未识别岗位字段");
      setElementText("#positionMapBadge", "0 个岗位");
      renderMappedPositions(mapping);
    }

    const employees = mapping && Array.isArray(mapping.employees) ? mapping.employees : [];
    const mappedEmployeeCount = renderMappedEmployees(mapping);
    if (mappedEmployeeCount) {
      setElementText("#employeeStatValue", String(mappedEmployeeCount));
      setElementText("#employeeStatHint", appendFileStateHint("员工字段已自动映射", employeeState));
      setElementText("#employeeImportVisualCount", String(mappedEmployeeCount));
      setElementText("#employeeImportTitle", mappedEmployeeCount + " 名员工已完成自动映射");
      setElementText("#employeeImportCopy", "已关联岗位、接害因素和体检类别，可直接用于个人监护档案与检查通知。");
      setElementText("#employeeImpactCount", mappedEmployeeCount + " 人");
      setElementText("#employeeImpactHint", employeeState.key === "issue" ? "另有文件待处理" : "人员关联已生成");
      const fieldCheck = $("#employeeFieldChecks");
      if (fieldCheck) {
        const fields = Array.isArray(mapping.employeeFields) && mapping.employeeFields.length
          ? mapping.employeeFields.join("、")
          : "姓名、岗位、接害因素、体检类别";
        fieldCheck.innerHTML = '<span>已映射：' + escapeHtml(fields) + '</span>';
      }
    } else if (employeeState.key === "missing") {
      setElementText("#employeeStatValue", "0");
      setElementText("#employeeStatHint", "员工名册尚未导入");
      setElementText("#employeeImportVisualCount", "0");
      resetEmployeeImportPanel("尚未导入员工名册", "需至少包含姓名、部门、岗位、接害因素、入职时间和体检状态 6 个字段。");
      setEmployeeFieldChecks(employeeState);
    } else if (employeeState.key === "issue") {
      setElementText("#employeeStatValue", "待处理");
      setElementText("#employeeStatHint", "员工名册存在解析异常");
      setElementText("#employeeImportVisualCount", "0");
      resetEmployeeImportPanel("员工名册文件存在异常", "请先在资料中心处理文件问题；处理完成后会自动映射。");
      setEmployeeFieldChecks(employeeState);
    } else if (employeeState.key === "review") {
      setElementText("#employeeStatValue", "待核查");
      setElementText("#employeeStatHint", "员工名册已解析，等待核查");
      setElementText("#employeeImportVisualCount", "0");
      resetEmployeeImportPanel("员工名册已解析，等待工作台核查", "请先核查文件解析内容，核查后会自动生成人员关联。");
      setEmployeeFieldChecks(employeeState);
    } else {
      setElementText("#employeeStatValue", "0");
      setElementText("#employeeStatHint", "已核查，未识别员工字段");
      setElementText("#employeeImportVisualCount", "0");
      resetEmployeeImportPanel("员工名册已核查，未识别员工字段", "请确认名册中包含姓名、岗位、接害因素和体检类别等可识别字段。");
      setEmployeeFieldChecks(employeeState);
    }

    const detectionPointCount = renderMappedDetectionPoints(mapping);
    if (detectionPointCount) {
      setElementText("#pointStatValue", String(detectionPointCount));
      const pointCount = mapping.detectionPoints.length;
      setElementText("#pointStatHint", appendFileStateHint(pointCount + " 条检测结果已映射", positionState));
    } else {
      setElementText("#pointStatValue", "0");
      setElementText("#pointStatHint", positionState.key === "issue" ? "检测文件存在解析异常" : positionState.key === "review" ? "检测文件待核查" : "已核查，未识别检测点位");
    }

    const systems = mapping && Array.isArray(mapping.systems) ? mapping.systems : [];
    if (systems.length) {
      setElementText("#systemStatValue", String(systems.length));
      setElementText("#systemStatHint", appendFileStateHint("制度文件已自动映射", systemState));
    } else if (systemState.key === "missing") {
      setElementText("#systemStatValue", "0");
      setElementText("#systemStatHint", "管理制度尚未导入");
    } else if (systemState.key === "issue") {
      setElementText("#systemStatValue", "待处理");
      setElementText("#systemStatHint", "制度文件存在解析异常");
    } else if (systemState.key === "review") {
      setElementText("#systemStatValue", "待核查");
      setElementText("#systemStatHint", "制度文件已解析，等待核查");
    } else {
      setElementText("#systemStatValue", "0");
      setElementText("#systemStatHint", "已核查，未识别制度字段");
    }

    const mappedItemCount = mapping ? Number(mapping.mappedItemCount) || 0 : 0;
    let hint = "";
    if (missing.length) hint = "还需补充：" + missing.map((category) => importCategoryLabels[category]).join("、");
    else if (issueFiles.length) hint = issueFiles.length + " 份文件存在解析异常，请先处理";
    else if (pendingReview.length) hint = pendingReview.length + " 份文件待工作台核查，核查后自动映射";
    else if (mappedItemCount) hint = "已从 " + reviewedFiles.length + " 份已核查文件映射 " + mappedItemCount + " 条业务数据";
    else hint = "文件已核查，暂无可映射业务数据";
    setProfileCompleteness(completeness, hint);

    if (issueFiles.length) setCompanyStatus(mappedItemCount ? "字段已映射 · 文件待处理" : "存在解析异常", "pending");
    else if (pendingReview.length) setCompanyStatus(mappedItemCount ? "字段已映射 · 待核查" : "已解析，待工作台核查", "pending");
    else if (missing.length) setCompanyStatus(mappedItemCount ? "字段已映射 · 待补充" : "文件已核查，待补充", "pending");
    else if (mappedItemCount) setCompanyStatus("字段已自动映射", "verified");
    else if (reviewedFiles.length) setCompanyStatus("文件已核查", "verified");
    else setCompanyStatus("资料待完善", "pending");

    setElementText("#enterpriseUpdated", company.updatedAt
      ? new Date(company.updatedAt).toLocaleString("zh-CN", { hour12: false })
      : "已导入资料");

    enterpriseImportBanner.hidden = false;
    let bannerTitle = "资料待解析";
    let bannerCopy = "当前企业账号已归集 " + files.length + " 份资料，请等待解析完成。";
    if (issueFiles.length) {
      bannerTitle = mappedItemCount ? "已核查文件已自动映射，部分文件待处理" : "资料已解析，部分文件需要处理";
      bannerCopy = "当前账号已归集 " + files.length + " 份资料，其中 " + reviewedFiles.length + " 份已核查、" + pendingReview.length + " 份待核查、" + issueFiles.length + " 份存在解析异常。" + (mappedItemCount ? " 已自动映射 " + mappedItemCount + " 条业务数据。" : "");
    } else if (pendingReview.length) {
      bannerTitle = mappedItemCount ? "字段已自动映射，仍有文件待核查" : "资料已解析，等待工作台核查";
      bannerCopy = "当前账号已归集 " + files.length + " 份资料，其中 " + reviewedFiles.length + " 份已核查、" + pendingReview.length + " 份待工作台核查。" + (mappedItemCount ? " 已自动映射 " + mappedItemCount + " 条业务数据。" : "");
    } else if (mappedItemCount && missing.length) {
      bannerTitle = "已核查文件已自动映射，还需补充资料";
      bannerCopy = "已从 " + reviewedFiles.length + " 份已核查文件映射 " + mappedItemCount + " 条业务数据；尚缺 " + missing.map((category) => importCategoryLabels[category]).join("、") + "。";
    } else if (mappedItemCount) {
      bannerTitle = "文件已核查，字段已自动映射";
      bannerCopy = "已从 " + reviewedFiles.length + " 份已核查文件自动映射 " + mappedItemCount + " 条业务数据，企业档案、岗位、检测点位和员工关系已同步更新。";
    } else if (reviewedFiles.length && missing.length) {
      bannerTitle = "文件已核查，还需补充资料";
      bannerCopy = "当前账号已核查 " + reviewedFiles.length + " 份文件；尚缺 " + missing.map((category) => importCategoryLabels[category]).join("、") + "。";
    } else if (reviewedFiles.length) {
      bannerTitle = "文件已核查，暂无可映射数据";
      bannerCopy = "当前账号已核查 " + reviewedFiles.length + " 份文件，但暂未识别到可写入企业档案的业务字段。";
    }
    setElementText("#enterpriseImportBannerTitle", bannerTitle);
    setElementText("#enterpriseImportBannerText", bannerCopy);
    const reviewButton = $("#bannerReviewButton");
    if (reviewButton) reviewButton.hidden = pendingReview.length === 0;

    renderLibrary(company);
    renderDashboard(company);
    renderEnterpriseChecklist(company);
    renderGenerationAccountData(company);
    renderArchiveAccountData(company);
  }

  function showNewEnterpriseProfile(company) {
    $("#enterpriseDemoNotice").hidden = true;
    enterpriseImportBanner.hidden = false;
    const reviewButton = $("#bannerReviewButton");
    if (reviewButton) reviewButton.hidden = true;
    setElementText("#enterpriseImportBannerTitle", "完善当前账号企业资料");
    setElementText("#enterpriseImportBannerText", "当前账号尚未上传任何资料。上传后，文件只会归档到账号 " + company.account + "。");
    setElementText("#newCompanyCode", company.code);
    setElementText("#currentCompanyTitle", company.name);
    setElementText("#currentCompanyLogo", company.name.slice(0, 1) || "企");
    setElementText("#currentCompanyCredit", "统一社会信用代码：待上传营业执照后识别");
    setCompanyStatus("待完善", "pending");
    setProfileCompleteness(0, "请上传企业主体、岗位、员工和制度资料");
    setElementText("#enterpriseIndustry", "待识别");
    setElementText("#enterpriseScale", "待识别");
    setElementText("#enterpriseExposed", "待识别");
    setElementText("#enterpriseLocations", "待识别");
    setElementText("#enterpriseYear", new Date().getFullYear() + " 年");
    setElementText("#enterpriseUpdated", "尚未导入资料");
    setElementText("#positionStatValue", "0");
    setElementText("#positionStatHint", "尚未导入岗位资料");
    setElementText("#pointStatValue", "0");
    setElementText("#pointStatHint", "尚未导入检测资料");
    setElementText("#employeeStatValue", "0");
    setElementText("#employeeStatHint", "员工名册尚未导入");
    setElementText("#systemStatValue", "0");
    setElementText("#systemStatHint", "管理制度尚未导入");
    setElementText("#positionMapBadge", "0 个岗位");
    resetPositionTable("尚未导入岗位与危害因素资料。上传后，系统将在这里生成岗位映射待核清单。");
    resetEmployeeImportPanel("尚未导入员工名册", "需至少包含姓名、部门、岗位、接害因素、入职时间和体检状态 6 个字段。");
    renderLibrary(company);
    renderDashboard(company);
    renderEnterpriseChecklist(company);
    renderGenerationAccountData(company);
    renderArchiveAccountData(company);
  }

  function renderImportQueue() {
    const count = selectedImportFiles.length;
    const validation = getImportQueueValidation();
    enterpriseFileCount.textContent = count + " 份";
    enterpriseFileQueue.hidden = count === 0;
    enterpriseImportSummary.textContent = count
      ? "已选择 " + count + " 份文件，覆盖 " + new Set(selectedImportFiles.map((file) => file.category)).size + " 类资料"
      : "尚未选择文件";
    enterpriseImportSubmit.disabled = count === 0 || importingEnterpriseFiles || !validation.valid;

    enterpriseFileList.innerHTML = selectedImportFiles.map((file, index) => {
      const extension = getFileExtension(file.name).toUpperCase() || "FILE";
      let statusText = "待解析";
      let statusClass = "";
      if (file.importState === "parsing") {
        statusText = "解析中";
        statusClass = " parsing";
      } else if (file.importState === "done") {
        statusText = "已解析";
        statusClass = " parsed";
      } else if (file.importState === "issue") {
        statusText = file.parseStatus === "ocr-required" ? "需 OCR" : "解析失败";
        statusClass = " failed";
      }
      const categorySelect = '<select class="file-import-category" data-import-category-select="' + index + '" aria-label="文件分类"' + (importingEnterpriseFiles || Boolean(replacementTargetFileId) ? " disabled" : "") + '>' +
        Object.keys(importCategoryLabels).map((key) => '<option value="' + key + '"' + (file.category === key ? " selected" : "") + '>' + escapeHtml(importCategoryLabels[key]) + '</option>').join('') +
        '</select>';
      return '<div class="file-import-row" data-import-index="' + index + '">' +
        '<span class="file-import-type">' + escapeHtml(extension) + '</span>' +
        '<div><strong>' + escapeHtml(file.name) + '</strong><small>' + escapeHtml(importCategoryLabels[file.category]) + ' · ' + formatFileSize(file.size) + (file.importState === "issue" && file.parseResult && file.parseResult.error ? ' · ' + escapeHtml(file.parseResult.error) : '') + '</small></div>' +
        categorySelect +
        '<span class="file-import-status' + statusClass + '">' + escapeHtml(statusText) + '</span>' +
        '<button class="file-import-remove" type="button" aria-label="移除文件" data-remove-import="' + index + '"' + (importingEnterpriseFiles ? " disabled" : "") + '><svg class="icon"><use href="#i-x"></use></svg></button>' +
      '</div>';
    }).join("");

    $$(".file-import-card").forEach((card) => {
      const category = card.dataset.importCategory;
      const categoryCount = selectedImportFiles.filter((file) => file.category === category).length;
      const note = card.querySelector("small");
      card.classList.toggle("has-files", categoryCount > 0);
      if (note) note.textContent = categoryCount ? "已选择 " + categoryCount + " 份文件" : "点击选择文件";
    });
    renderImportValidation();
  }

  const libraryCategoryMeta = [
    { key: "company", target: 16, tone: "blue" },
    { key: "positions", target: 15, tone: "indigo" },
    { key: "employees", target: 18, tone: "amber" },
    { key: "systems", target: 12, tone: "green" }
  ];

  function renderEnterpriseChecklist(company) {
    if (!company) return;
    const fileState = getEnterpriseFileState(company);
    const files = fileState.files;
    const pendingFiles = fileState.pendingReview;
    const issueFiles = fileState.issueFiles;
    const missingCategories = fileState.missingCategories;
    const badge = $("#enterpriseCheckBadge");
    const list = $("#enterpriseCheckList");
    const impactCount = $("#employeeImpactCount");
    const impactHint = $("#employeeImpactHint");
    const employeeFiles = files.filter((file) => file.category === "employees");
    const employeePending = employeeFiles.filter((file) => file.parseStatus === "parsed" && !file.reviewedAt);
    const employeeIssues = employeeFiles.filter((file) => ["failed", "ocr-required", "legacy", "pending"].includes(file.parseStatus));
    if (impactCount) impactCount.textContent = !employeeFiles.length ? "待上传" : employeePending.length ? employeePending.length + " 份待核查" : employeeIssues.length ? employeeIssues.length + " 份异常" : employeeFiles.length + " 份已核查";
    if (impactHint) impactHint.textContent = !employeeFiles.length ? "上传后识别影响范围" : employeePending.length ? "核查完成后进行字段映射" : employeeIssues.length ? "处理后才能进入字段映射" : "文件已核查，人员字段已参与自动映射";
    if (!list || !badge) return;
    if (!files.length) {
      badge.className = "status-badge pending";
      badge.textContent = "待上传";
      list.innerHTML = '<div><span class="check-icon ok"><svg class="icon tiny"><use href="#i-upload"></use></svg></span><p><strong>当前账号尚未上传企业资料</strong><small>检查项只根据本账号真实文件生成，不显示其他企业的数据。</small></p><button class="text-link" type="button" data-dashboard-upload>上传资料</button></div>';
      return;
    }
    const items = [];
    if (issueFiles.length) items.push({ icon: "bad", title: issueFiles.length + " 份文件解析异常", copy: "包含解析失败、需 OCR 或需重新上传的文件", action: 'data-go="library"', actionLabel: "去处理" });
    if (pendingFiles.length) items.push({ icon: "bad", title: pendingFiles.length + " 份文件待核查", copy: "请在工作台逐份打开，或使用一键核查完成确认", action: "data-dashboard-review", actionLabel: "去核查" });
    missingCategories.slice(0, 2).forEach((category) => items.push({ icon: "bad", title: importCategoryLabels[category] + "尚未上传", copy: "这是必选资料，会阻断依赖该类别的文档生成", action: "data-dashboard-upload", actionLabel: "去补充" }));
    if (!items.length) items.push({ icon: "ok", title: "三类必选资料已核查并完成映射", copy: fileState.optionalMissingCategories.length ? "制度与补充资料可选；系统可依据三份必选文件生成补充说明" : "企业、人员、岗位和检测数据已写入当前企业档案", action: 'data-go="generate"', actionLabel: "去生成文档" });
    badge.className = "status-badge " + (issueFiles.length ? "blocked" : pendingFiles.length || missingCategories.length ? "pending" : "verified");
    badge.textContent = issueFiles.length ? issueFiles.length + " 项待处理" : pendingFiles.length ? pendingFiles.length + " 份待核查" : missingCategories.length ? missingCategories.length + " 类必选待补充" : "必选资料已核查";
    list.innerHTML = items.slice(0, 3).map((item) => '<div><span class="check-icon ' + item.icon + '">' + (item.icon === "ok" ? '<svg class="icon tiny"><use href="#i-check"></use></svg>' : "!") + '</span><p><strong>' + escapeHtml(item.title) + '</strong><small>' + escapeHtml(item.copy) + '</small></p><button class="text-link" type="button" ' + item.action + '>' + escapeHtml(item.actionLabel) + '</button></div>').join("");
  }

  function getDocumentGenerationContext(company) {
    const mapping = ensureEnterpriseMapping(company);
    return {
      company: company,
      mapping: mapping,
      profile: mapping && mapping.profile || Object.assign({}, company.profileOverrides || {}),
      employees: mapping && Array.isArray(mapping.employees) ? mapping.employees : [],
      positions: mapping && Array.isArray(mapping.positions) ? mapping.positions : [],
      detectionPoints: mapping && Array.isArray(mapping.detectionPoints) ? mapping.detectionPoints : [],
      report: mapping && mapping.report || {}
    };
  }

  function getTemplateReadiness(definition, context) {
    const profile = context && context.profile || {};
    const company = context && context.company || {};
    const positions = Array.isArray(context && context.positions) ? context.positions : [];
    const employees = Array.isArray(context && context.employees) ? context.employees : [];
    const points = Array.isArray(context && context.detectionPoints) ? context.detectionPoints : [];
    const report = context && context.report || {};
    const companyName = String(profile.companyName || company.name || "").trim();
    const profileReady = Boolean(companyName) && !/的企业空间$/.test(companyName);
    const positionReady = positions.length > 0;
    const employeeReady = employees.length > 0;
    const detectionReady = points.length > 0 || Boolean(report.reportNo || report.reportDate);
    const hazardsReady = positions.some((position) => Array.isArray(position.hazards) && position.hazards.length > 0);
    const missing = [];
    const warnings = [];
    if (!profileReady) missing.push("企业基本信息");

    if (definition.id === "hazard-notice" || definition.id === "ppe-plan") {
      if (!positionReady) missing.push("岗位映射");
      if (!hazardsReady) missing.push("岗位危害因素");
    } else if (definition.id === "health-record") {
      if (!employeeReady) missing.push("员工名册");
    }

    if (definition.id === "annual-assessment" && profileReady && !detectionReady) {
      warnings.push("检测明细待补充，将生成标注免责声明的待补充稿");
    }
    if (definition.id === "facility-maintenance" && profileReady && !positionReady) {
      warnings.push("岗位映射待补充，将按企业共用设施生成待完善稿");
    }
    if (definition.id === "emergency-plan" && profileReady && (!positionReady || !hazardsReady)) {
      warnings.push("岗位危害因素待补充，预案中的岗位处置卡将留待完善");
    }

    let targets = [];
    if (!missing.length) {
      try {
        targets = window.DocumentTemplates && typeof window.DocumentTemplates.buildTargets === "function"
          ? window.DocumentTemplates.buildTargets(definition, context)
          : [];
      } catch (error) {
        console.error("Template target build failed: " + definition.id, error);
        missing.push("模板目标构建失败");
      }
    }
    if (!missing.length && !targets.length) missing.push("可生成的业务对象");
    return {
      ready: missing.length === 0,
      missing: missing,
      warnings: warnings,
      targets: missing.length ? [] : targets,
      targetCount: missing.length ? 0 : targets.length,
      draft: warnings.length > 0
    };
  }

  function renderGenerationAccountData(company) {
    if (!company) return;
    const tableBody = $("#generationTableBody");
    if (!tableBody) return;
    const definitions = window.DocumentTemplates && Array.isArray(window.DocumentTemplates.definitions)
      ? window.DocumentTemplates.definitions
      : [];
    let context = getDocumentGenerationContext(company);
    const select = $("#generateCompanySelect");
    if (select && select.options.length) {
      select.options[0].textContent = company.name;
      select.options[0].value = company.code;
      if (select.options[1]) select.options[1].textContent = "当前账号";
    }

    if (!definitions.length) {
      tableBody.innerHTML = '<tr data-template-render-error="true"><td colspan="6"><div class="dashboard-task-empty"><span><svg class="icon"><use href="#i-alert"></use></svg></span><div><strong>模板引擎未就绪</strong><p>页面脚本可能未完整加载，请刷新本地预览后重试。</p></div></div></td></tr>';
      setElementText("#generationReadySummary", "0 份可生成");
      setElementText("#generationBlockedSummary", "模板未加载");
      const total = $("#footerTotal");
      if (total) total.textContent = "0";
      refreshSelectionState();
      return;
    }

    let readyCount = 0;
    let warningCount = 0;
    let blockedCount = 0;
    tableBody.innerHTML = definitions.map((definition) => {
      let readiness;
      try {
        readiness = getTemplateReadiness(definition, context);
      } catch (error) {
        console.error("Template readiness failed: " + (definition && definition.id), error);
        readiness = { ready: false, missing: ["模板条件检查异常"], warnings: [], targets: [], targetCount: 0, draft: false };
      }
      if (readiness.ready) readyCount += 1;
      else blockedCount += 1;
      if (readiness.warnings.length) warningCount += 1;
      const hasWarning = readiness.warnings.length > 0;
      const condition = readiness.ready
        ? hasWarning ? "需补充：" + readiness.warnings.join("；") : "企业档案与映射数据已就绪"
        : "缺少" + readiness.missing.join("、");
      const statusLabel = readiness.ready ? hasWarning ? "可生成 · 草稿" : "可生成" : "待补充";
      const statusTone = readiness.ready ? hasWarning ? "draft" : "ready" : "blocked";
      const targetCopy = readiness.ready
        ? "预计生成 " + readiness.targetCount + " 份"
        : (definition.scope === "employee" ? "需员工名册" : definition.scope === "position" ? "需岗位映射" : "需企业档案");
      return '<tr data-template-row="' + escapeHtml(definition.id) + '" class="' + (readiness.ready ? "selectable-row" : "blocked-row") + '">' +
        '<td class="check-column"><label class="checkbox-label"><input class="doc-check" type="checkbox" data-template-id="' + escapeHtml(definition.id) + '" data-doc="' + escapeHtml(definition.name) + '"' + (readiness.ready ? "" : " disabled") + '><span class="custom-check"></span></label></td>' +
        '<td><div class="doc-cell"><span class="file-icon ' + escapeHtml(definition.iconTone || "blue") + '">' + escapeHtml(definition.iconLetter || "文") + '</span><div><strong>' + escapeHtml(definition.name) + '</strong><small>' + escapeHtml((definition.shortName || definition.name) + " · " + targetCopy) + '</small></div></div></td>' +
        '<td><span class="scope-label">' + escapeHtml(definition.scopeLabel || "企业级") + '</span><small class="table-cell-note">' + escapeHtml(definition.cycleLabel || "每企业 1 份") + '</small></td>' +
        '<td><strong class="template-code">' + escapeHtml(definition.templateCode || "—") + '</strong><small class="table-cell-note">版本 V' + escapeHtml(definition.version || "1.0") + '</small></td>' +
        '<td><span class="dependency ' + (readiness.ready && !hasWarning ? "ok" : "warn") + '"><svg class="icon tiny"><use href="#i-' + (readiness.ready && !hasWarning ? "check" : "alert") + '"></use></svg>' + escapeHtml(condition) + '</span></td>' +
        '<td><span class="status-badge ' + statusTone + ' doc-status">' + escapeHtml(statusLabel) + '</span></td></tr>';
    }).join("");

    const readySummary = $("#generationReadySummary");
    const blockedSummary = $("#generationBlockedSummary");
    if (readySummary) readySummary.textContent = readyCount + " 份可生成" + (warningCount ? " · " + warningCount + " 份含提示" : "");
    if (blockedSummary) blockedSummary.textContent = blockedCount + " 份待补充";
    const total = $("#footerTotal");
    if (total) total.textContent = String(definitions.length);
    const panelCopy = $("#view-generate .generation-panel .panel-head p");
    if (panelCopy) panelCopy.textContent = "已按当前企业档案、岗位、员工与检测数据完成条件检查";
    const blockedTitle = $("#generationBlockedTitle");
    const blockedText = $("#generationBlockedText");
    if (blockedTitle) blockedTitle.textContent = blockedCount ? "为什么还有 " + blockedCount + " 份文档待补充？" : readyCount ? "当前可生成文档已按真实档案数据校验" : "当前尚未识别可生成文档";
    if (blockedText) blockedText.textContent = blockedCount
      ? "缺少企业基本信息、岗位映射、岗位危害因素或员工名册时，对应模板会保持不可选。检测明细等待补充的企业级报告仍可生成待补充稿。"
      : "企业档案、岗位、员工与检测数据已就绪。标记为“草稿”的模板含待补充提示，生成后会写入档案库并保留版本记录。";
    refreshSelectionState();
  }
  function renderArchiveAccountData(company) {
    if (!company) return;
    const documents = ensureArchiveDocuments(company);
    const counts = documents.reduce((result, document) => {
      result.total += 1;
      if (Object.prototype.hasOwnProperty.call(result, document.status)) result[document.status] += 1;
      return result;
    }, { total: 0, draft: 0, review: 0, signed: 0, archived: 0 });

    const scopeMeta = ["企业码 " + company.code];
    if (company.account) scopeMeta.push("管理员账号 " + company.account);
    scopeMeta.push("其他企业不可见");
    setElementText("#archiveScopeName", company.name + " · 独立档案库");
    setElementText("#archiveScopeMeta", scopeMeta.join(" · "));
    setElementText("#archiveStatTotal", String(counts.total));
    setElementText("#archiveStatTotalHint", counts.total ? "均属于当前企业档案库" : "当前企业暂无档案");
    setElementText("#archiveStatSigned", String(counts.signed));
    setElementText("#archiveStatSignedHint", counts.total ? "签发率 " + Math.round(counts.signed / counts.total * 100) + "%" : "暂无已签发文档");
    setElementText("#archiveStatPending", String(counts.review));
    setElementText("#archiveStatPendingHint", counts.review ? "等待审核或签发" : "暂无待审核文档");
    setElementText("#archiveStatExpiring", "0");
    setElementText("#archiveStatExpiringHint", "未接入到期规则");
    $$(".status-tabs button").forEach((button) => {
      const count = button.dataset.status === "all" ? counts.total : counts[button.dataset.status] || 0;
      const countElement = button.querySelector("span");
      if (countElement) countElement.textContent = String(count);
    });
    renderArchiveRows(company);
    renderArchiveEntities(company);
  }

  function renderArchiveEntities(company) {
    const mapping = ensureEnterpriseMapping(company);
    const employees = mapping && Array.isArray(mapping.employees) ? mapping.employees : [];
    const peopleBody = $("#archivePeopleBody");
    const peopleCount = $("#archivePeopleCount");
    if (peopleCount) peopleCount.textContent = employees.length + " 人";
    if (peopleBody) {
      peopleBody.innerHTML = employees.length ? employees.map((employee) => {
        const hazards = Array.isArray(employee.hazards) && employee.hazards.length ? employee.hazards.join("、") : "待补充";
        return '<tr><td><strong>' + escapeHtml(employee.name || "未命名人员") + '</strong><small class="table-cell-note">' + escapeHtml(employee.phone || "联系电话待补充") + '</small></td>' +
          '<td>' + escapeHtml(employee.department || "资料未提供") + '</td>' +
          '<td>' + escapeHtml(employee.position || "资料未提供") + '</td>' +
          '<td><div class="tag-list"><span>' + escapeHtml(hazards) + '</span></div></td>' +
          '<td>' + escapeHtml(employee.examType || employee.examStatus || "待补充") + '</td></tr>';
      }).join("") : '<tr><td colspan="5" style="padding:28px;text-align:center;color:var(--muted);">尚未映射到人员名册，请上传并核查员工资料。</td></tr>';
    }

    const files = getOwnedCompanyFiles(company);
    const sourceBody = $("#archiveSourceBody");
    const sourceCount = $("#archiveSourceCount");
    if (sourceCount) sourceCount.textContent = files.length + " 份";
    if (sourceBody) {
      sourceBody.innerHTML = files.length ? files.map((file) => {
        const status = getLibraryStatus(file);
        return '<tr><td><strong>' + escapeHtml(file.name) + '</strong><small class="table-cell-note">' + escapeHtml(formatLibraryDate(file.uploadedAt)) + '</small></td>' +
          '<td>' + escapeHtml(importCategoryLabels[file.category] || file.category || "未分类") + '</td>' +
          '<td>' + escapeHtml(getParseSummary(file)) + '</td>' +
          '<td><span class="status-badge ' + status.tone + '">' + escapeHtml(status.label) + '</span></td>' +
          '<td><button class="row-action" type="button" data-doc-id="' + escapeHtml(file.id) + '">查看</button></td></tr>';
      }).join("") : '<tr><td colspan="5" style="padding:28px;text-align:center;color:var(--muted);">当前企业尚未上传原始资料。</td></tr>';
    }
  }

  function formatLibraryDate(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return "刚刚";
    return date.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  }

  function getStatusBadgeMarkup(file) {
    const status = getLibraryStatus(file);
    const icon = status.tone === "verified" ? '<svg class="icon tiny"><use href="#i-check"></use></svg>' : "";
    return '<span class="status-badge ' + status.tone + '">' + icon + escapeHtml(status.label) + '</span>';
  }

  function renderLibrary(company) {
    if (!company) return;
    ensureLibraryFileMetadata(company);

    const files = getOwnedCompanyFiles(company);
    const total = files.length;
    const parsedFiles = files.filter((file) => file.parseStatus === "parsed");
    const reviewedFiles = parsedFiles.filter((file) => file.reviewedAt);
    const pendingReviewFiles = parsedFiles.filter((file) => !file.reviewedAt);
    const issueFiles = files.filter((file) => ["failed", "ocr-required", "legacy", "pending"].includes(file.parseStatus));
    const counts = libraryCategoryMeta.reduce((result, item) => {
      result[item.key] = files.filter((file) => file.category === item.key).length;
      return result;
    }, {});
    const navCount = $('.nav-item[data-view="library"] .nav-count');
    if (navCount) navCount.textContent = String(total);

    const summary = $("#view-library .library-summary");
    if (summary) {
      const metricValues = $$(".summary-metric strong", summary);
      const metricLabels = $$(".summary-metric span:last-child", summary);
      setElementText("#libraryTotalCount", String(total));
      const totalLabel = $(".library-summary-copy strong", summary);
      if (totalLabel) totalLabel.textContent = String(total);
      if (metricValues[0]) metricValues[0].textContent = String(parsedFiles.length);
      if (metricValues[1]) metricValues[1].textContent = String(pendingReviewFiles.length);
      if (metricValues[2]) metricValues[2].textContent = String(issueFiles.length);
      if (metricLabels[0]) metricLabels[0].textContent = "已解析";
      if (metricLabels[1]) metricLabels[1].textContent = "待核查";
      if (metricLabels[2]) metricLabels[2].textContent = "解析异常";

      const completeness = getEnterpriseFileState(company).completeness;
      const summaryAction = $(".summary-action", summary);
      if (summaryAction) {
        const label = $("span", summaryAction);
        const progress = $(".summary-progress i", summaryAction);
        const percent = $("b", summaryAction);
        if (label) label.textContent = "三类必选资料完整度";
        if (progress) progress.style.width = completeness + "%";
        if (percent) percent.textContent = completeness + "%";
      }
    }

    $$("#view-library .category-card").forEach((card, index) => {
      const meta = libraryCategoryMeta[index];
      if (!meta) return;
      const categoryFiles = files.filter((file) => file.category === meta.key);
      const count = categoryFiles.length;
      const parsedCount = categoryFiles.filter((file) => file.parseStatus === "parsed").length;
      const reviewedCount = categoryFiles.filter((file) => file.parseStatus === "parsed" && file.reviewedAt).length;
      const issueCount = categoryFiles.filter((file) => ["failed", "ocr-required", "legacy", "pending"].includes(file.parseStatus)).length;
      const pendingCount = Math.max(0, count - reviewedCount);
      const progressValue = count ? Math.max(1, Math.min(100, Math.round((count / meta.target) * 100))) : 0;
      const countLabel = $(".category-count strong", card);
      const totalLabel = $(".category-count span", card);
      const health = $(".category-count b", card);
      const progress = $(".progress-track span", card);
      const footItems = $$(".category-foot > span", card);

      if (countLabel) countLabel.textContent = String(count);
      if (totalLabel) totalLabel.textContent = "/ " + meta.target + " 份";
      if (health) {
        health.textContent = !count ? "待上传" : issueCount ? issueCount + " 份异常" : reviewedCount === count ? "已核查" : "待核查";
        health.className = "health " + (!count ? "low" : issueCount ? "low" : reviewedCount === count ? "good" : "mid");
      }
      if (progress) progress.style.width = progressValue + "%";
      if (footItems[0]) {
        footItems[0].innerHTML = '<svg class="icon tiny"><use href="#i-check"></use></svg>' + (parsedCount ? parsedCount + " 已解析" : "0 已解析");
      }
      if (footItems[1]) {
        footItems[1].textContent = count ? (issueCount ? issueCount + " 份异常" : pendingCount + " 待核查") : "暂无资料";
        footItems[1].className = issueCount ? "danger-text" : pendingCount ? "warning-text" : count ? "complete-text" : "danger-text";
      }
    });

    const tableBody = $("#view-library .file-table tbody");
    if (tableBody) {
      if (!total) {
        tableBody.innerHTML = '<tr><td colspan="6"><div class="library-empty-state">' +
          '<span class="library-empty-icon"><svg class="icon"><use href="#i-folder"></use></svg></span>' +
          '<strong>尚未上传任何资料</strong>' +
          '<p>新企业空间从 0 份资料开始。上传营业执照、岗位清单、员工名册或制度文件后，系统会在本地解析文件内容。</p>' +
          '<button class="button button-primary button-sm" type="button" data-library-upload>上传第一份资料</button>' +
          '</div></td></tr>';
      } else {
        const tone = { company: "red", positions: "indigo", employees: "amber", systems: "green" };
        tableBody.innerHTML = files.map((file) => {
          const extension = getFileExtension(file.name).toUpperCase() || "FILE";
          const category = importCategoryLabels[file.category] || "其他资料";
          const status = getLibraryStatus(file);
          return '<tr><td><div class="doc-cell"><span class="file-icon ' + (tone[file.category] || "blue") + '">' + escapeHtml(extension.slice(0, 1)) + '</span><div><strong>' + escapeHtml(file.name) + '</strong><small>' + escapeHtml(getParseSummary(file)) + '</small></div></div></td>' +
            '<td>' + escapeHtml(category) + '</td><td>' + formatFileSize(file.size) + '</td>' +
            '<td>' + getStatusBadgeMarkup(file) + '</td><td>' + escapeHtml(formatLibraryDate(file.uploadedAt)) + '</td>' +
            '<td><button class="row-action" type="button" data-doc-id="' + escapeHtml(file.id) + '">' + escapeHtml(status.action) + '</button></td></tr>';
        }).join("");
      }
    }

    const viewAllButton = $("#view-library .panel-head .button-quiet");
    if (viewAllButton) {
      viewAllButton.innerHTML = "查看全部 " + total + " 份资料<svg class=\"icon\"><use href=\"#i-arrow\"></use></svg>";
      viewAllButton.dataset.toast = total ? "当前企业空间共有 " + total + " 份资料" : "当前企业空间暂无资料";
    }

    const validationPanel = $("#view-library .validation-panel");
    if (validationPanel) {
      const countBadge = $(".count-badge", validationPanel);
      const validationList = $(".validation-list", validationPanel);
      const recheckButton = $(":scope > .button", validationPanel);
      if (countBadge) countBadge.textContent = String(issueFiles.length);
      if (validationList) {
        if (issueFiles.length) {
          validationList.innerHTML = issueFiles.slice(0, 5).map((file) => {
            const status = getLibraryStatus(file);
            const isBlocked = status.tone === "blocked";
            const message = file.parseStatus === "legacy"
              ? "旧版上传记录未保存文件内容，请重新上传后解析。"
              : file.parseStatus === "ocr-required"
                ? "PDF 未提取到文字，需要 OCR 或可复制文字的版本。"
                : file.parseStatus === "pending"
                  ? "文件尚未完成解析。"
                  : file.parseResult && file.parseResult.error || "文件解析失败。";
            return '<button class="validation-item" type="button" data-doc-id="' + escapeHtml(file.id) + '"><span class="validation-kind ' + (isBlocked ? "red" : "amber") + '">' + escapeHtml(status.label) + '</span><strong>' + escapeHtml(file.name) + '</strong><small>' + escapeHtml(message) + '</small></button>';
          }).join("");
        } else {
          validationList.innerHTML = '<div class="validation-empty-state"><span><svg class="icon"><use href="#i-check"></use></svg></span><strong>' +
            (total ? "文件解析检查已完成" : "暂无导入校验问题") + '</strong><p>' +
            (total ? pendingReviewFiles.length ? "所有已上传文件均已成功提取内容，仍有 " + pendingReviewFiles.length + " 份待工作台核查。" : "所有已上传文件均已完成内容核查，业务字段映射尚未开始。" : "上传资料后，这里会显示解析失败、需 OCR 或旧版记录问题。") +
            '</p></div>';
        }
      }
      if (recheckButton) {
        recheckButton.disabled = total === 0;
        recheckButton.textContent = issueFiles.length ? "重新上传问题文件" : total ? pendingReviewFiles.length ? "全部文件已解析" : "全部文件已核查" : "上传资料后可校验";
        if (issueFiles.length) recheckButton.setAttribute("data-library-upload", "");
        else recheckButton.removeAttribute("data-library-upload");
      }
    }
    renderGeneratedDocumentsTable(company);
  }

  function renderGeneratedDocumentsTable(company) {
    const tableBody = $("#generatedDocsTableBody");
    if (!tableBody) return;
    const documents = ensureArchiveDocuments(company).filter((document) => Boolean(document.templateId));
    const count = $("#generatedDocsCount");
    if (count) count.textContent = documents.length + " 份";
    if (!documents.length) {
      tableBody.innerHTML = '<tr><td colspan="6"><div class="library-empty-state"><span class="library-empty-icon"><svg class="icon"><use href="#i-doc-plus"></use></svg></span><strong>尚未生成受控文档</strong><p>前往“文档生成”，勾选可用模板并生成草稿。</p><button class="button button-primary button-sm" type="button" data-go="generate">去生成文档</button></div></td></tr>';
      return;
    }
    tableBody.innerHTML = documents.map((document) => {
      const meta = getArchiveStatusMeta(document.status);
      return '<tr><td><div class="doc-cell"><span class="file-icon ' + escapeHtml(document.iconTone || meta.iconTone) + '">' + escapeHtml(document.iconLetter || "文") + '</span><div><strong>' + escapeHtml(document.name) + '</strong><small>' + escapeHtml(document.documentNumber + " · " + meta.label + " · " + (document.templateCode || "模板")) + '</small></div></div></td>' +
        '<td><strong>' + escapeHtml(document.scopeText || document.targetName || "—") + '</strong><small class="table-cell-note">' + escapeHtml(document.scopeLabel || "企业级") + '</small></td>' +
        '<td><span class="source-cell">' + escapeHtml(document.sourceName || "当前企业档案") + '</span></td>' +
        '<td><strong>' + escapeHtml(document.version || "V1.0") + '</strong><small class="table-cell-note">' + escapeHtml("模板 V" + (document.templateVersion || "1.0")) + '</small></td>' +
        '<td>' + escapeHtml(formatArchiveDate(document.updatedAt || document.createdAt)) + '</td>' +
        '<td><div class="table-actions"><button class="row-action" type="button" data-archive-doc-id="' + escapeHtml(document.id) + '">查看 / 编辑</button><button class="row-action" type="button" data-generated-download="' + escapeHtml(document.id) + '">下载</button><button class="row-action" type="button" data-generated-replace="' + escapeHtml(document.id) + '">重新上传</button></div></td></tr>';
    }).join("");
  }

  function setDashboardNumber(selector, value, unit) {
    const element = $(selector);
    if (!element) return;
    element.innerHTML = escapeHtml(String(value)) + (unit ? '<small>' + escapeHtml(unit) + '</small>' : "");
  }

  function dashboardWorkflowStep(number, title, copy, state) {
    const dot = state === "done"
      ? '<svg class="icon"><use href="#i-check"></use></svg>'
      : String(number);
    return '<div class="workflow-step ' + state + '"><div class="step-dot">' + dot + '</div><strong>' + escapeHtml(title) + '</strong><span>' + escapeHtml(copy) + '</span></div>';
  }

  function renderDashboard(company) {
    if (!company) return;
    ensureLibraryFileMetadata(company);
    const files = getOwnedCompanyFiles(company);
    const parsedFiles = files.filter((file) => file.parseStatus === "parsed");
    const reviewedFiles = parsedFiles.filter((file) => file.reviewedAt);
    const pendingReviewFiles = parsedFiles.filter((file) => !file.reviewedAt);
    const issueFiles = files.filter((file) => ["failed", "ocr-required", "legacy", "pending"].includes(file.parseStatus));
    const fileState = getEnterpriseFileState(company);
    const completeness = fileState.completeness;
    const importedCategories = fileState.categories;
    const missingCategories = fileState.missingCategories;

    setElementText("#dashboardCompletenessLabel", "三类必选资料完整度");
    setDashboardNumber("#dashboardCompletenessValue", completeness, "%");
    const ring = $("#dashboardCompletenessRing");
    if (ring) {
      ring.style.setProperty("--value", String(completeness));
      const ringCount = $("#dashboardCompletenessCount");
      if (ringCount) ringCount.textContent = String(files.length);
    }
    setElementText("#dashboardCompletenessHint", "已归集 " + files.length + " 份资料 · 三类必选已完成 " + Math.round(completeness / 100 * REQUIRED_IMPORT_CATEGORIES.length) + "/3 类");
    setElementText("#dashboardReviewLabel", "待工作台核查");
    setDashboardNumber("#dashboardReviewCount", pendingReviewFiles.length, " 份");
    setElementText("#dashboardReviewHint", pendingReviewFiles.length ? "打开文件核对解析内容后确认核查" : "暂无待核查文件");
    setElementText("#dashboardParsedLabel", "已解析文件");
    setDashboardNumber("#dashboardParsedCount", parsedFiles.length, " 份");
    setElementText("#dashboardParsedHint", reviewedFiles.length + " 份已完成核查");
    setElementText("#dashboardIssueLabel", "解析异常 / 缺口");
    setDashboardNumber("#dashboardIssueCount", issueFiles.length + missingCategories.length, " 项");
    setElementText("#dashboardIssueHint", issueFiles.length ? "有文件解析失败、需 OCR 或需重新上传" : missingCategories.length ? "还需补充 " + missingCategories.map((item) => importCategoryLabels[item]).join("、") : "三类必选资料已完成解析与核查");

    let workflowProgress = 8;
    if (files.length) workflowProgress = 36;
    if (parsedFiles.length) workflowProgress = 52;
    if (!pendingReviewFiles.length && reviewedFiles.length) workflowProgress = 64;
    if (!issueFiles.length && !missingCategories.length && reviewedFiles.length === files.length && files.length) workflowProgress = 72;
    setElementText("#dashboardWorkflowPercent", workflowProgress + "%");
    const workflowBar = $("#dashboardWorkflowBar");
    if (workflowBar) workflowBar.style.width = workflowProgress + "%";
    setElementText("#dashboardWorkflowTitle", "企业资料处理进度");
    setElementText("#dashboardWorkflowSubtitle", "从资料上传、本地解析到工作台核查");

    const steps = $("#dashboardWorkflowSteps");
    if (steps) {
      const collectState = !files.length ? "active" : "done";
      const collectCopy = files.length ? files.length + " 份资料已归集" : "等待上传第一份资料";
      const parseState = !files.length ? "" : parsedFiles.length === files.length ? "done" : "active";
      const parseCopy = !files.length ? "上传后自动提取内容" : parsedFiles.length + "/" + files.length + " 份已完成解析";
      const reviewState = parsedFiles.length ? (pendingReviewFiles.length ? "active" : "done") : "";
      const reviewCopy = reviewedFiles.length ? reviewedFiles.length + "/" + parsedFiles.length + " 份已核查" : "解析后在当前工作台核查";
      steps.innerHTML =
        dashboardWorkflowStep(1, "企业空间", "账号 " + company.account, "done") +
        dashboardWorkflowStep(2, "资料归集", collectCopy, collectState) +
        dashboardWorkflowStep(3, "文件解析", parseCopy, parseState) +
        dashboardWorkflowStep(4, "工作台核查", reviewCopy, reviewState) +
        dashboardWorkflowStep(5, "规则匹配", "核查完成后进入字段校验", "") +
        dashboardWorkflowStep(6, "文档生成", "等待资料核查完成", "");
    }

    const workflowNote = $("#dashboardWorkflowNote");
    if (workflowNote) {
      let message = "";
      let action = "";
      let actionType = "";
      if (!files.length) {
        message = "当前账号还没有文档资料，请先上传企业主体、岗位、员工或制度文件。";
        action = "上传资料";
        actionType = "data-dashboard-upload";
      } else if (issueFiles.length) {
        message = "有 " + issueFiles.length + " 份文件未能完成解析，请查看原因并重新上传。";
        action = "查看异常";
        actionType = "data-go=\"library\"";
      } else if (pendingReviewFiles.length) {
        message = "有 " + pendingReviewFiles.length + " 份文件已解析，正在等待工作台逐份核查。";
        action = "开始核查";
        actionType = "data-dashboard-review";
      } else {
        message = "已上传文件均已完成解析和核查，可以继续补充资料或进入后续规则匹配。";
        action = "继续上传";
        actionType = "data-dashboard-upload";
      }
      workflowNote.innerHTML = '<svg class="icon"><use href="#i-alert"></use></svg><span>' + escapeHtml(message) + '</span><button class="text-link" type="button" ' + actionType + '>' + escapeHtml(action) + '</button>';
    }

    const reviewPanel = $("#dashboardReviewPanel");
    if (reviewPanel) reviewPanel.hidden = false;
    setElementText("#dashboardReviewSummary", pendingReviewFiles.length + " 份待核查 · " + reviewedFiles.length + " 份已核查");
    setElementText("#dashboardReviewCopy", "逐份打开上传文件，确认解析内容后标记已核查。核查与文件内容只属于当前企业账号 " + company.account + "。");
    const reviewList = $("#dashboardReviewList");
    if (reviewList) {
      if (!files.length) {
        reviewList.innerHTML = '<div class="dashboard-review-empty"><span><svg class="icon"><use href="#i-upload"></use></svg></span><strong>尚未上传资料</strong><p>上传文件后会自动解析，并在这里逐份核查。</p><button class="button button-primary button-sm" type="button" data-dashboard-upload>上传第一份资料</button></div>';
      } else {
        const tone = { company: "red", positions: "indigo", employees: "amber", systems: "green" };
        reviewList.innerHTML = files.map((file) => {
          const extension = getFileExtension(file.name).toUpperCase() || "FILE";
          const status = getLibraryStatus(file);
          const issueClass = status.tone === "blocked" ? " has-error" : "";
          return '<div class="dashboard-review-item' + issueClass + '">' +
            '<span class="file-icon ' + (tone[file.category] || "blue") + '">' + escapeHtml(extension.slice(0, 1)) + '</span>' +
            '<div class="review-item-copy"><strong>' + escapeHtml(file.name) + '</strong><small>' + escapeHtml((importCategoryLabels[file.category] || "其他资料") + " · " + formatFileSize(file.size) + " · " + getParseSummary(file)) + '</small></div>' +
            getStatusBadgeMarkup(file) +
            '<span class="review-item-time">' + escapeHtml(formatLibraryDate(file.uploadedAt)) + '</span>' +
            '<div class="review-item-actions">' +
              '<button class="button button-secondary button-sm" type="button" data-doc-id="' + escapeHtml(file.id) + '">' + escapeHtml(status.action) + '</button>' +
              '<button class="button button-danger-quiet button-sm" type="button" data-delete-doc-id="' + escapeHtml(file.id) + '">删除</button>' +
            '</div>' +
            '</div>';
        }).join("");
      }
    }

    const todoList = $("#dashboardTodoList");
    if (todoList) {
      const tasks = [];
      if (!files.length) {
        tasks.push({ priority: "高", title: "上传企业资料", copy: "当前账号尚未归集任何文件", action: 'data-dashboard-upload' });
      } else if (pendingReviewFiles.length) {
        tasks.push({ priority: "高", title: "核查 " + pendingReviewFiles.length + " 份已解析资料", copy: "在文件工作台确认内容并标记已核查", action: 'data-dashboard-review' });
      }
      if (issueFiles.length) {
        tasks.push({ priority: "高", title: "处理 " + issueFiles.length + " 份解析异常", copy: "需重新上传或补充可复制文字版本", action: 'data-go="library"' });
      }
      if (missingCategories.length) {
        tasks.push({ priority: "中", title: "补充 " + missingCategories.length + " 类资料", copy: missingCategories.map((item) => importCategoryLabels[item]).join("、"), action: 'data-dashboard-upload' });
      }
      if (!tasks.length) {
        tasks.push({ priority: "中", title: "资料已解析并核查", copy: "可以继续补充资料或进入文档生成", action: 'data-go="generate"' });
      }
      todoList.innerHTML = tasks.slice(0, 3).map((task) => '<button class="todo-item" type="button" ' + task.action + '><span class="todo-priority ' + (task.priority === "高" ? "high" : "mid") + '">' + task.priority + '</span><span class="todo-copy"><strong>' + escapeHtml(task.title) + '</strong><small>' + escapeHtml(task.copy) + '</small></span><svg class="icon small"><use href="#i-chevron"></use></svg></button>').join("");
    }

    const todoProgress = $("#dashboardTodoProgress");
    if (todoProgress) {
      const totalTasks = Math.max(1, files.length + missingCategories.length);
      const doneTasks = Math.min(totalTasks, reviewedFiles.length + (files.length ? 0 : 0));
      const percent = Math.round((doneTasks / totalTasks) * 100);
      todoProgress.innerHTML = '<div><span>资料处理进度</span><strong>' + doneTasks + ' / ' + totalTasks + '</strong></div><div class="segmented-progress">' +
        Array.from({ length: 6 }).map((item, index) => '<i class="' + (index < Math.round(percent / 100 * 6) ? "on" : "") + '"></i>').join("") + '</div>';
    }

    const generatedTasks = ensureArchiveDocuments(company).filter((item) => item && item.templateId);
    setElementText("#dashboardTaskTitle", "文档生成任务");
    setElementText("#dashboardTaskHint", generatedTasks.length ? "已生成 " + generatedTasks.length + " 份文档，可进入档案库查看正文和版本" : "需完成资料核查后，系统才会按实际企业数据创建生成任务");
    const taskBody = $("#dashboardTaskBody");
    if (taskBody) {
      taskBody.innerHTML = generatedTasks.length ? generatedTasks.slice(0, 3).map((item) => {
        const meta = getArchiveStatusMeta(item.status);
        return '<tr><td><div class="doc-cell"><span class="file-icon ' + escapeHtml(item.iconTone || meta.iconTone) + '">' + escapeHtml(item.iconLetter || "文") + '</span><div><strong>' + escapeHtml(item.name) + '</strong><small>' + escapeHtml((item.templateCode || "模板") + " · " + item.version) + '</small></div></div></td>' +
          '<td>' + escapeHtml(item.scopeText || item.targetName || "当前企业") + '</td>' +
          '<td><span class="dependency ok"><svg class="icon tiny"><use href="#i-check"></use></svg>已生成</span></td>' +
          '<td><span class="status-badge ' + meta.tone + '">' + escapeHtml(meta.label) + '</span></td>' +
          '<td>' + escapeHtml(formatArchiveDate(item.updatedAt || item.createdAt)) + '</td>' +
          '<td><button class="row-action" type="button" data-archive-doc-id="' + escapeHtml(item.id) + '">查看</button></td></tr>';
      }).join("") : '<tr><td colspan="6"><div class="dashboard-task-empty"><span><svg class="icon"><use href="#i-doc-plus"></use></svg></span><div><strong>尚未创建文档生成任务</strong><p>请先完成上传文件的工作台核查，再前往文档生成。</p></div><button class="button button-secondary button-sm" type="button" data-go="generate">去生成文档</button></div></td></tr>';
    }
  }

  function openEnterpriseImportModal() {
    if (!currentEnterprise) {
      showToast("请先登录企业账号后再上传资料。", "尚未登录");
      return;
    }
    if (importingEnterpriseFiles) return;
    enterpriseImportModal.hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(() => enterpriseImportClose.focus(), 60);
  }

  function closeEnterpriseImportModal(resetQueue = false) {
    if (!enterpriseImportModal) return;
    enterpriseImportModal.hidden = true;
    enterpriseImportModal.removeAttribute("aria-busy");
    if (document.body.classList.contains("login-open") === false) document.body.style.overflow = "";
    if (resetQueue) {
      selectedImportFiles = [];
      enterpriseFileInputs.forEach((input) => { input.value = ""; });
      const globalInput = $("#enterpriseGlobalFileInput");
      if (globalInput) globalInput.value = "";
      if (replacementTargetFileId) {
        replacementTargetFileId = null;
        enterpriseReplacementBanner.hidden = true;
        enterpriseReplacementName.textContent = "";
        enterpriseImportTitle.textContent = "上传企业资料";
        enterpriseImportSubmit.innerHTML = '<svg class="icon"><use href="#i-refresh"></use></svg>开始解析并更新档案';
      }
      renderImportQueue();
    }
  }

  function updateProfileAfterImport(newCategories, importedFiles) {
    if (!currentEnterprise) return { completeness: 0, parsedCount: 0, issueCount: 0, pendingReview: 0 };
    const allCategories = Object.keys(importCategoryLabels);
    const existingCategories = Array.isArray(currentEnterprise.importedCategories) ? currentEnterprise.importedCategories : [];
    const categories = Array.from(new Set(existingCategories.concat(newCategories)))
      .filter((category) => allCategories.includes(category));
    const completeness = Math.min(100, categories.length * 25);
    const uploadedAt = new Date().toISOString();
    const existingFiles = getOwnedCompanyFiles(currentEnterprise);
    const mergedFiles = new Map(existingFiles.map((file) => [file.category + "|" + file.name + "|" + file.size, file]));

    importedFiles.forEach((file) => {
      const key = file.category + "|" + file.name + "|" + file.size;
      const existing = mergedFiles.get(key);
      mergedFiles.set(key, {
        id: existing && existing.id || file.id || makeLibraryFileId(),
        accountCode: currentEnterprise.code,
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        category: file.category,
        uploadedAt: uploadedAt,
        parseStatus: file.parseStatus || "failed",
        parseResult: file.parseResult || createEmptyParseResult("unknown", "未知格式", "local", "文件未完成解析。"),
        reviewedAt: null
      });
    });

    currentEnterprise.libraryFiles = Array.from(mergedFiles.values());
    currentEnterprise.importedCategories = categories;
    currentEnterprise.completeness = completeness;
    currentEnterprise.updatedAt = uploadedAt;
    currentEnterprise.accountScope = "enterprise:" + normalizeAccount(currentEnterprise.account);
    invalidateEnterpriseMapping(currentEnterprise);
    appendAuditLog(currentEnterprise, "资料导入", "导入或更新 " + importedFiles.length + " 份资料，覆盖 " + categories.length + " 类。");
    saveCompany(currentEnterprise);
    showEnterpriseProfile(currentEnterprise);

    const fileState = getEnterpriseFileState(currentEnterprise);
    return {
      completeness: completeness,
      parsedCount: fileState.parsedFiles.length,
      issueCount: fileState.issueFiles.length,
      pendingReview: fileState.pendingReview.length
    };
  }
  function fileStem(name) {
    return String(name || "").replace(/\.[^.]+$/, "").replace(/[（(]\d+[）)]$/g, "").replace(/\s+/g, "").toLowerCase();
  }

  function findOcrCompanion(record, queue) {
    if (!record || getFileExtension(record.name) !== "pdf" || record.parseStatus !== "ocr-required") return null;
    const stem = fileStem(record.name);
    return queue.find((candidate) => {
      if (!candidate || candidate === record || candidate.parseStatus !== "parsed") return false;
      if (!["txt", "json"].includes(getFileExtension(candidate.name))) return false;
      const candidateStem = fileStem(candidate.name);
      return candidateStem === stem || candidateStem.includes(stem) || stem.includes(candidateStem) || /ocr/i.test(candidate.name);
    }) || null;
  }

  function setReplacementMode(fileId) {
    const target = currentEnterprise && getOwnedCompanyFiles(currentEnterprise).find((file) => file.id === fileId);
    if (!target) return;
    replacementTargetFileId = target.id;
    selectedImportFiles = [];
    enterpriseReplacementBanner.hidden = false;
    enterpriseReplacementName.textContent = (importCategoryLabels[target.category] || "资料") + " · " + target.name;
    enterpriseImportTitle.textContent = "替换企业资料";
    enterpriseImportSubmit.innerHTML = '<svg class="icon"><use href="#i-refresh"></use></svg>替换并重新解析';
    renderImportQueue();
  }

  function clearReplacementMode() {
    replacementTargetFileId = null;
    enterpriseReplacementBanner.hidden = true;
    enterpriseReplacementName.textContent = "";
    enterpriseImportTitle.textContent = "上传企业资料";
    enterpriseImportSubmit.innerHTML = '<svg class="icon"><use href="#i-refresh"></use></svg>开始解析并更新档案';
  }

  async function startEnterpriseImport() {
    if (!currentEnterprise || importingEnterpriseFiles || selectedImportFiles.length === 0) return;
    const validation = getImportQueueValidation();
    if (!validation.valid) {
      renderImportValidation();
      showToast("三类必选资料尚未齐备，请检查待识别文件的分类后再提交。", "无法提交");
      return;
    }
    const targetEnterprise = currentEnterprise;
    const replacementTarget = replacementTargetFileId
      ? getOwnedCompanyFiles(currentEnterprise).find((file) => file.id === replacementTargetFileId) || null
      : null;
    if (replacementTargetFileId && !replacementTarget) {
      showToast("未找到要替换的资料，请关闭后重新操作。", "替换失败");
      return;
    }
    const queue = selectedImportFiles.slice();
    importingEnterpriseFiles = true;
    enterpriseImportModal.setAttribute("aria-busy", "true");
    enterpriseImportSubmit.disabled = true;
    enterpriseImportSubmit.textContent = "正在读取文件...";
    enterpriseImportSummary.textContent = "准备解析 " + queue.length + " 份文件，请稍候...";
    renderImportQueue();

    let completed = 0;
    for (let index = 0; index < queue.length; index += 1) {
      if (currentEnterprise !== targetEnterprise) break;
      const fileRecord = queue[index];
      fileRecord.importState = "parsing";
      enterpriseImportSummary.textContent = "正在解析第 " + (index + 1) + " / " + queue.length + " 份：" + fileRecord.name;
      enterpriseImportSubmit.textContent = "正在解析 " + (index + 1) + " / " + queue.length;
      renderImportQueue();
      try {
        const parsed = await parseUploadedFile(fileRecord);
        fileRecord.parseStatus = parsed.parseStatus;
        fileRecord.parseResult = parsed.parseResult;
        fileRecord.importState = parsed.parseStatus === "parsed" ? "done" : "issue";
      } catch (error) {
        fileRecord.parseStatus = "failed";
        fileRecord.parseResult = createEmptyParseResult("unknown", "解析失败", "local", error && error.message ? error.message : "文件解析失败。");
        fileRecord.importState = "issue";
      }
      completed += 1;
      renderImportQueue();
    }

    queue.forEach((record) => {
      const companion = findOcrCompanion(record, queue);
      if (!companion) return;
      record.parseStatus = "parsed";
      record.parseResult = Object.assign({}, companion.parseResult, { ocrSourceName: companion.name });
      record.importState = "done";
    });
    renderImportQueue();

    if (currentEnterprise !== targetEnterprise) {
      importingEnterpriseFiles = false;
      enterpriseImportModal.removeAttribute("aria-busy");
      clearReplacementMode();
      closeEnterpriseImportModal(true);
      return;
    }

    const uploadedAt = new Date().toISOString();
    let actionTitle = "文件解析完成";
    let actionMessage = "";
    if (replacementTarget) {
      const replacement = queue[0];
      Object.assign(replacementTarget, {
        name: replacement.name,
        size: replacement.size,
        lastModified: replacement.lastModified,
        uploadedAt: uploadedAt,
        parseStatus: replacement.parseStatus,
        parseResult: replacement.parseResult,
        reviewedAt: null,
        replacedAt: uploadedAt,
        replacementCount: (Number(replacementTarget.replacementCount) || 0) + 1
      });
      const validCategories = Object.keys(importCategoryLabels);
      currentEnterprise.importedCategories = Array.from(new Set(getOwnedCompanyFiles(currentEnterprise)
        .map((file) => file.category)
        .filter((category) => validCategories.includes(category))));
      currentEnterprise.updatedAt = uploadedAt;
      invalidateEnterpriseMapping(currentEnterprise);
      appendAuditLog(currentEnterprise, "资料替换", "替换资料“" + replacementTarget.name + "”，原文件版本已保留在操作日志中。");
      saveCompany(currentEnterprise);
      showEnterpriseProfile(currentEnterprise);
      actionMessage = replacement.parseStatus === "parsed"
        ? "资料已替换并重新解析，请在工作台再次核查。"
        : "资料已替换，但解析未完成，请在资料中心查看原因。";
      actionTitle = "替换完成";
    } else {
      const parsedCategories = Array.from(new Set(queue
        .filter((file) => file.parseStatus === "parsed")
        .map((file) => file.category)));
      const result = updateProfileAfterImport(parsedCategories, queue);
      actionMessage = "已解析 " + result.parsedCount + " 份文件，" + result.pendingReview + " 份待工作台核查，" + result.issueCount + " 份需要处理。";
    }
    importingEnterpriseFiles = false;
    enterpriseImportModal.removeAttribute("aria-busy");
    enterpriseImportSubmit.disabled = false;
    clearReplacementMode();
    enterpriseImportSummary.textContent = "已完成 " + completed + " 份文件的本地解析";
    showToast(actionMessage, actionTitle);
    closeEnterpriseImportModal(true);
    setView("dashboard");
    renderDashboard(currentEnterprise);
    setTimeout(() => {
      const reviewPanel = $("#dashboardReviewPanel");
      if (reviewPanel && !reviewPanel.hidden) reviewPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }

  $("#enterpriseAccount").addEventListener("input", () => clearFormError(enterpriseRegisterError));
  $("#enterprisePassword").addEventListener("input", () => clearFormError(enterpriseRegisterError));

  enterpriseRegisterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    clearFormError(enterpriseRegisterError);
    const account = $("#enterpriseAccount").value.trim();
    const password = $("#enterprisePassword").value;
    if (!account) {
      showFormError(enterpriseRegisterError, "请输入企业登录账号。");
      $("#enterpriseAccount").focus();
      return;
    }
    if (password.length < 6) {
      showFormError(enterpriseRegisterError, "登录密码至少需要 6 位。");
      $("#enterprisePassword").focus();
      return;
    }
    if (findCompanyByAccount(account)) {
      showFormError(enterpriseRegisterError, "该企业登录账号已存在，请更换账号或直接登录。");
      $("#enterpriseAccount").focus();
      return;
    }

    enterpriseRegisterSubmit.disabled = true;
    enterpriseRegisterSubmit.textContent = "正在创建企业空间...";
    setTimeout(() => {
      let code = generateCompanyCode();
      while (findCompanyByCode(code)) code = generateCompanyCode();
      const company = {
        code: code,
        name: account + " 的企业空间",
        creditCode: "",
        industry: "",
        region: "",
        account: account,
        passwordDigest: buildPasswordDigest(account, password),
        accountScope: "enterprise:" + normalizeAccount(account),
        inviteCode: code,
        createdAt: new Date().toISOString(),
        completeness: 0,
        importedCategories: [],
        libraryFiles: [],
        archiveDocuments: []
      };
      activateEnterprise(company);
      setView("enterprise");
      enterpriseRegisterSubmit.disabled = false;
      enterpriseRegisterSubmit.innerHTML = enterpriseRegisterMarkup;
      showToast("企业空间已创建，请上传资料完善档案。", "注册成功");
      setTimeout(openEnterpriseImportModal, 320);
    }, 650);
  });

  enterpriseFileInputs.forEach((input) => {
    input.addEventListener("change", () => {
      const card = input.closest("[data-import-category]");
      appendImportFiles(input.files, card ? card.dataset.importCategory : "");
      input.value = "";
    });
  });
  $("#enterpriseGlobalFileInput").addEventListener("change", (event) => {
    appendImportFiles(event.target.files);
    event.target.value = "";
  });
  $("#enterpriseGlobalUploadButton").addEventListener("click", () => $("#enterpriseGlobalFileInput").click());

  enterpriseFileList.addEventListener("click", (event) => {
    const remove = event.target.closest("[data-remove-import]");
    if (!remove || importingEnterpriseFiles) return;
    selectedImportFiles.splice(Number(remove.dataset.removeImport), 1);
    renderImportQueue();
  });
  enterpriseFileList.addEventListener("change", (event) => {
    const select = event.target.closest("[data-import-category-select]");
    if (!select || importingEnterpriseFiles) return;
    const file = selectedImportFiles[Number(select.dataset.importCategorySelect)];
    if (file && importCategoryLabels[select.value]) file.category = select.value;
    renderImportQueue();
  });
  $("#cancelReplacement").addEventListener("click", () => {
    if (importingEnterpriseFiles) return;
    selectedImportFiles = [];
    clearReplacementMode();
    renderImportQueue();
  });

  $("#openEnterpriseImport").addEventListener("click", openEnterpriseImportModal);
  $("#libraryUploadButton").addEventListener("click", openEnterpriseImportModal);
  $("#dashboardUploadButton").addEventListener("click", openEnterpriseImportModal);
  $("#view-library").addEventListener("click", (event) => {
    if (event.target.closest("[data-library-upload]")) openEnterpriseImportModal();
  });
  $("#bannerImportButton").addEventListener("click", openEnterpriseImportModal);
  $("#bannerReviewButton").addEventListener("click", () => {
    setView("dashboard");
    const reviewPanel = $("#dashboardReviewPanel");
    if (reviewPanel) setTimeout(() => reviewPanel.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  });
  document.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-delete-doc-id]");
    if (deleteButton) {
      event.preventDefault();
      deleteLibraryFile(deleteButton.dataset.deleteDocId);
      return;
    }
    if (event.target.closest("[data-dashboard-upload]")) {
      openEnterpriseImportModal();
      return;
    }
    if (event.target.closest("[data-dashboard-review]")) {
      setView("dashboard");
      const reviewPanel = $("#dashboardReviewPanel");
      if (reviewPanel) reviewPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
  $("#dismissImportBanner").addEventListener("click", () => { enterpriseImportBanner.hidden = true; });
  enterpriseImportClose.addEventListener("click", () => closeEnterpriseImportModal());
  enterpriseImportCancel.addEventListener("click", () => closeEnterpriseImportModal());
  enterpriseImportSubmit.addEventListener("click", startEnterpriseImport);
  enterpriseImportModal.addEventListener("click", (event) => {
    if (event.target === enterpriseImportModal) closeEnterpriseImportModal();
  });
  $("#copyNewCompanyCode").addEventListener("click", () => {
    const code = $("#newCompanyCode").textContent.trim();
    copyText(code).then(() => showToast("企业协同码 " + code + " 已复制，可发给个人账号注册使用。", "复制成功"));
  });

  // Personal registration requires a verified enterprise code.
  personalCompanyCode.addEventListener("input", () => {
    resetCompanyVerification();
    clearFormError(personalRegisterError);
    personalCompanyCode.value = personalCompanyCode.value.toUpperCase();
  });
  personalCompanyCode.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      verifyPersonalCompany();
    }
  });
  verifyCompanyCodeButton.addEventListener("click", () => verifyPersonalCompany());

  personalRegisterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    clearFormError(personalRegisterError);
    if (!verifiedCompany && !verifyPersonalCompany(false)) {
      showFormError(personalRegisterError, "企业协同码为必填项，且必须验证通过后才能注册个人账号。");
      return;
    }
    const name = $("#personalName").value.trim();
    const phone = $("#personalPhone").value.trim();
    const department = $("#personalDepartment").value;
    const position = $("#personalPosition").value.trim();
    const account = $("#personalAccount").value.trim();
    const inviteCode = $("#personalInviteCode").value.trim().toUpperCase();
    const password = $("#personalPassword").value;
    const passwordConfirm = $("#personalPasswordConfirm").value;
    if (!name || !phone || !department || !position || !account || !password) {
      showFormError(personalRegisterError, "请完整填写个人注册信息。");
      return;
    }
    if (!isValidPhone(phone)) {
      showFormError(personalRegisterError, "请输入有效的 11 位手机号。");
      return;
    }
    if (verifiedCompany.inviteCode && inviteCode && inviteCode !== verifiedCompany.inviteCode) {
      showFormError(personalRegisterError, "企业邀请码不正确，请向企业管理员确认。");
      return;
    }
    if (password.length < 6) {
      showFormError(personalRegisterError, "登录密码至少需要 6 位。");
      return;
    }
    if (password !== passwordConfirm) {
      showFormError(personalRegisterError, "两次输入的密码不一致。");
      return;
    }
    if (!$("#personalAgreement").checked) {
      showFormError(personalRegisterError, "请先阅读并同意个人服务协议和隐私政策。");
      return;
    }
    currentPersonal = {
      name: name,
      phone: phone,
      department: department,
      position: position,
      account: account,
      company: verifiedCompany
    };
    $("#pendingCompanyName").textContent = verifiedCompany.name;
    $("#pendingPersonName").textContent = name;
    $("#pendingCompanyCode").textContent = verifiedCompany.code;
    $("#pendingDepartment").textContent = department + " / " + position;
    setAuthView("personalPending");
    showToast("注册申请已提交，等待企业管理员审核。", "提交成功");
  });

  $("#pendingLoginButton").addEventListener("click", () => setAuthView("login", true));


  function setView(viewName, updateHash = true) {
    const targetView = document.getElementById("view-" + viewName);
    if (!targetView) return;

    $$(".view").forEach((view) => view.classList.toggle("active", view === targetView));
    $$(".nav-item[data-view]").forEach((item) => {
      item.classList.toggle("active", item.dataset.view === viewName);
    });

    currentPageLabel.textContent = viewNames[viewName] || targetView.dataset.title || "工作台";
    document.title = (viewNames[viewName] || "工作台") + " · 职安文档云";
    if (updateHash && window.location.hash !== "#" + viewName) {
      history.replaceState(null, "", "#" + viewName);
    }
    closeMobileNav();
    if (currentEnterprise) {
      if (viewName === "generate") renderGenerationAccountData(currentEnterprise);
      else if (viewName === "archive") renderArchiveAccountData(currentEnterprise);
      else if (viewName === "library") renderLibrary(currentEnterprise);
      else if (viewName === "dashboard") renderDashboard(currentEnterprise);
      else if (viewName === "enterprise") showEnterpriseProfile(currentEnterprise);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resolveViewFromHash() {
    const hash = window.location.hash.replace("#", "");
    return viewNames[hash] ? hash : "dashboard";
  }

  $$(".nav-item[data-view]").forEach((item) => {
    item.addEventListener("click", () => setView(item.dataset.view));
  });

  document.addEventListener("click", (event) => {
    const goButton = event.target.closest("[data-go]");
    if (goButton) {
      setView(goButton.dataset.go);
      return;
    }

    const toastButton = event.target.closest("[data-toast]");
    if (toastButton) {
      showToast(toastButton.dataset.toast);
    }
  });

  mobileMenu.addEventListener("click", () => {
    const isOpen = sidebar.classList.toggle("mobile-open");
    mobileScrim.hidden = !isOpen;
  });
  mobileScrim.addEventListener("click", closeMobileNav);

  $("#toastClose").addEventListener("click", () => toast.classList.remove("show"));

  // Global search: route archive searches to the archive list.
  const globalSearch = $("#globalSearch");
  globalSearch.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const query = globalSearch.value.trim();
    if (!query) return;
    setView("archive");
    $("#archiveSearch").value = query;
    currentArchiveStatus = "all";
    currentArchivePage = 1;
    $$(".status-tabs button").forEach((button) => button.classList.toggle("active", button.dataset.status === "all"));
    filterArchiveTable();
    showToast("已在档案库中搜索：“" + query + "”", "全局搜索");
  });

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      globalSearch.focus();
    }
    if (event.key === "Escape") {
      closeModal();
      closeEnterpriseImportModal();
      closeMobileNav();
      setAccountMenu(false);
    }
  });

  // Document selection and simulated generation.
  function getDocChecks() {
    return $$("#generationTableBody .doc-check");
  }
  const selectAll = $("#selectAllDocs");
  const clearSelection = $("#clearSelection");
  const selectionCount = $("#selectionCount");
  const footerCount = $("#footerCount");
  const footerSelectedLabel = $("#footerSelectedLabel");
  const generateButton = $("#generateDocs");
  const validateButton = $("#validateDocs");
  const generationProgress = $("#generationProgress");
  const generationProgressBar = $("#generationProgressBar");
  const generationProgressText = $("#generationProgressText");
  const generationProgressNote = $("#generationProgressNote");

  function availableDocChecks() {
    return getDocChecks().filter((checkbox) => !checkbox.disabled);
  }

  function selectedDocs() {
    return availableDocChecks().filter((checkbox) => checkbox.checked);
  }

  function refreshSelectionState() {
    const available = availableDocChecks();
    const selected = selectedDocs();
    const count = selected.length;
    selectionCount.textContent = "已选择 " + count + " 份";
    footerCount.textContent = String(count);
    footerSelectedLabel.textContent = count + " 份";
    generateButton.disabled = count === 0;
    selectAll.disabled = available.length === 0;
    selectAll.checked = available.length > 0 && count === available.length;
    selectAll.indeterminate = count > 0 && count < available.length;
    getDocChecks().forEach((checkbox) => {
      const row = checkbox.closest("tr");
      if (row) row.classList.toggle("checked", checkbox.checked);
    });
  }

  $("#generationTableBody").addEventListener("change", (event) => {
    if (event.target.matches(".doc-check")) refreshSelectionState();
  });

  selectAll.addEventListener("change", () => {
    availableDocChecks().forEach((checkbox) => { checkbox.checked = selectAll.checked; });
    refreshSelectionState();
  });

  clearSelection.addEventListener("click", () => {
    getDocChecks().forEach((checkbox) => { checkbox.checked = false; });
    refreshSelectionState();
  });

  validateButton.addEventListener("click", () => {
    const selected = selectedDocs();
    if (selected.length === 0) {
      showToast("请先勾选至少一份可生成文档。", "无法校验");
      return;
    }
    validateButton.disabled = true;
    validateButton.textContent = "校验中...";
    setTimeout(() => {
      selected.forEach((checkbox) => {
        const row = checkbox.closest("tr");
        const status = $(".doc-status", row);
        if (status) status.textContent = "校验通过";
      });
      validateButton.disabled = false;
      validateButton.innerHTML = '<svg class="icon"><use href="#i-shield"></use></svg>开始校验';
      showToast(selected.length + " 份文档的档案、资料与模板条件均已通过。", "校验完成");
    }, 900);
  });

  let generating = false;
  generateButton.addEventListener("click", () => {
    const selected = selectedDocs();
    if (selected.length === 0 || generating) return;

    generating = true;
    const templateIds = selected.map((checkbox) => checkbox.dataset.templateId).filter(Boolean);
    generateButton.disabled = true;
    validateButton.disabled = true;
    generationProgress.hidden = false;
    generationProgressBar.style.width = "0%";
    generationProgressText.textContent = "0%";
    generationProgressNote.textContent = "正在加载模板与字段映射";

    const steps = [
      { progress: 24, note: "正在校验企业档案与岗位规则" },
      { progress: 52, note: "正在填充模板字段与条件段落" },
      { progress: 78, note: "正在生成文档并写入版本记录" },
      { progress: 100, note: "生成完成，等待审核" }
    ];
    let stepIndex = 0;

    const timer = setInterval(() => {
      const step = steps[stepIndex];
      generationProgressBar.style.width = step.progress + "%";
      generationProgressText.textContent = step.progress + "%";
      generationProgressNote.textContent = step.note;
      stepIndex += 1;

      if (stepIndex >= steps.length) {
        clearInterval(timer);
        setTimeout(() => {
          const generatedCount = appendGeneratedDrafts(templateIds);
          getDocChecks().forEach((checkbox) => { checkbox.checked = false; });
          refreshSelectionState();
          generating = false;
          validateButton.disabled = false;
          if (generatedCount) {
            showToast("已生成 " + generatedCount + " 份文档草稿并加入档案库，下一步可提交审核。", "生成完成");
          }
          setTimeout(() => { generationProgress.hidden = true; }, 1200);
        }, 520);
      }
    }, 720);
  });

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[character]);
  }

  function appendGeneratedDrafts(templateIds) {
    if (!currentEnterprise) {
      showToast("生成结果未写入档案库，请先登录企业账号。", "尚未登录");
      return 0;
    }
    if (!window.DocumentTemplates || !Array.isArray(window.DocumentTemplates.definitions)) {
      showToast("模板引擎未加载，暂时无法生成文档。", "生成失败");
      return 0;
    }
    const requestedIds = Array.isArray(templateIds) ? templateIds : [];
    const context = getDocumentGenerationContext(currentEnterprise);
    const sourceFileNames = getOwnedCompanyFiles(currentEnterprise)
      .filter((file) => file && context.mapping && Array.isArray(context.mapping.sourceFileIds) && context.mapping.sourceFileIds.includes(file.id))
      .map((file) => file.name);
    const sourceName = sourceFileNames.length ? sourceFileNames.join("、") : "当前企业档案";
    const documents = ensureArchiveDocuments(currentEnterprise);
    const createdAt = new Date().toISOString();
    let nextSequence = getNextArchiveSequence(documents);
    const generatedDocuments = [];

    requestedIds.forEach((templateId) => {
      const definition = window.DocumentTemplates.definitions.find((item) => item.id === templateId);
      if (!definition) return;
      const readiness = getTemplateReadiness(definition, context);
      if (!readiness.ready || !readiness.targets.length) return;
      readiness.targets.forEach((target) => {
        const body = window.DocumentTemplates.render(definition, target, context);
        const documentNumber = "DA-" + new Date().getFullYear() + "-" + String(nextSequence).padStart(4, "0");
        nextSequence += 1;
        generatedDocuments.push({
          id: makeArchiveDocumentId(),
          accountCode: currentEnterprise.code,
          documentNumber: documentNumber,
          name: target.documentName || definition.name,
          version: "V1.0",
          status: "draft",
          templateId: definition.id,
          templateName: definition.name,
          templateCode: definition.templateCode,
          templateVersion: definition.version,
          scope: definition.scope,
          scopeLabel: definition.scopeLabel,
          sourceType: "generated",
          sourceId: context.mapping && Array.isArray(context.mapping.sourceFileIds) ? context.mapping.sourceFileIds.join(",") : "",
          sourceName: sourceName,
          targetType: target.targetType,
          targetId: target.targetId,
          targetName: target.targetName,
          scopeText: target.scopeText,
          body: body,
          versions: [{
            version: "V1.0",
            body: body,
            createdAt: createdAt,
            note: "首次生成"
          }],
          dataSnapshot: {
            companyName: context.profile.companyName || currentEnterprise.name,
            creditCode: context.profile.creditCode || "",
            employeeCount: context.employees.length,
            positionCount: context.positions.length,
            detectionPointCount: context.detectionPoints.length
          },
          generatedAt: createdAt,
          updatedAt: createdAt,
          signer: "",
          signedAt: "",
          retention: "30 年",
          iconTone: definition.iconTone || getArchiveStatusMeta("draft").iconTone,
          iconLetter: definition.iconLetter || "文"
        });
      });
    });

    if (!generatedDocuments.length) {
      showToast("所选模板缺少可生成的业务对象，请先补充企业档案、岗位或员工数据。", "未生成文档");
      return 0;
    }

    currentEnterprise.archiveDocuments = generatedDocuments.concat(documents);
    currentEnterprise.updatedAt = createdAt;
    appendAuditLog(currentEnterprise, "生成文档", "按 " + requestedIds.length + " 个模板生成 " + generatedDocuments.length + " 份草稿");
    saveCompany(currentEnterprise);

    currentArchiveStatus = "all";
    currentArchivePage = 1;
    archiveSearch.value = "";
    statusTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.status === "all"));
    renderLibrary(currentEnterprise);
    renderArchiveAccountData(currentEnterprise);
    return generatedDocuments.length;
  }
  // Archive filters, pagination and per-enterprise rendering.
  let currentArchiveStatus = "all";
  let currentArchivePage = 1;
  const ARCHIVE_PAGE_SIZE = 6;
  const archiveSearch = $("#archiveSearch");
  const statusTabs = $$(".status-tabs button");

  function formatArchiveDate(value) {
    const text = String(value || "").trim();
    if (!text) return "—";
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
    if (match) return match[1] + "-" + match[2] + "-" + match[3];
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return text;
    return date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
  }

  function setArchiveTabState() {
    statusTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.status === currentArchiveStatus));
  }

  function resetArchiveViewState() {
    currentArchiveStatus = "all";
    currentArchivePage = 1;
    archiveSearch.value = "";
    setArchiveTabState();
    activeArchiveDocumentId = null;
  }

  function getArchiveFilteredDocuments(documents) {
    const query = archiveSearch.value.trim().toLowerCase();
    const people = currentEnterprise && currentEnterprise.enterpriseMapping && Array.isArray(currentEnterprise.enterpriseMapping.employees)
      ? currentEnterprise.enterpriseMapping.employees.map((employee) => [employee.name, employee.position, employee.department, employee.idNumber].filter(Boolean).join(" "))
      : [];
    const sourceFiles = currentEnterprise ? getOwnedCompanyFiles(currentEnterprise).map((file) => [file.name, importCategoryLabels[file.category] || file.category, getParseSummary(file)].filter(Boolean).join(" ")) : [];
    return documents.filter((document) => {
      const matchesStatus = currentArchiveStatus === "all" || document.status === currentArchiveStatus;
      const versions = Array.isArray(document.versions) ? document.versions.map((version) => version.version + " " + version.note + " " + version.body).join(" ") : "";
      const haystack = [document.name, document.documentNumber, document.signer, document.body, document.sourceName, document.targetName, document.scopeText, document.templateName, document.templateCode, versions].concat(people, sourceFiles).join(" ").toLowerCase();
      return matchesStatus && (!query || haystack.includes(query));
    });
  }

  function archivePageNumbers(totalPages) {
    const start = Math.max(1, Math.min(currentArchivePage - 2, totalPages - 4));
    const end = Math.min(totalPages, start + 4);
    const pages = [];
    for (let page = start; page <= end; page += 1) pages.push(page);
    return pages;
  }

  function renderArchiveRows(company) {
    const tbody = $("#archiveTableBody");
    if (!tbody || !company) return;
    const documents = ensureArchiveDocuments(company);
    const filteredDocuments = getArchiveFilteredDocuments(documents);
    const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / ARCHIVE_PAGE_SIZE));
    currentArchivePage = Math.min(Math.max(1, currentArchivePage), totalPages);
    const startIndex = (currentArchivePage - 1) * ARCHIVE_PAGE_SIZE;
    const pageDocuments = filteredDocuments.slice(startIndex, startIndex + ARCHIVE_PAGE_SIZE);

    if (!pageDocuments.length) {
      const message = documents.length
        ? "没有找到符合当前筛选条件的档案"
        : "当前企业账号尚未生成任何文档档案。完成资料核查后，可从文档生成页创建草稿。";
      tbody.innerHTML = '<tr id="archiveEmptyRow"><td colspan="7" style="padding:42px;text-align:center;color:var(--muted);">' + message + '</td></tr>';
    } else {
      tbody.innerHTML = pageDocuments.map((document) => {
        const meta = getArchiveStatusMeta(document.status);
        return '<tr data-status="' + escapeHtml(document.status) + '" data-account-code="' + escapeHtml(company.code) + '" data-document-id="' + escapeHtml(document.id) + '">' +
          '<td><div class="doc-cell"><span class="file-icon ' + escapeHtml(document.iconTone || meta.iconTone) + '">' + escapeHtml(document.iconLetter || "D") + '</span><div><strong>' + escapeHtml(document.name) + '</strong><small>' + escapeHtml(document.documentNumber) + '</small></div></div></td>' +
          '<td><span class="version-tag">' + escapeHtml(document.version) + '</span></td>' +
          '<td><span class="status-badge ' + escapeHtml(meta.tone) + '">' + escapeHtml(meta.label) + '</span></td>' +
          '<td>' + escapeHtml(document.signer || "—") + '</td>' +
          '<td>' + escapeHtml(formatArchiveDate(document.signedAt)) + '</td>' +
          '<td>' + escapeHtml(document.retention) + '</td>' +
          '<td><button class="row-action" type="button" data-archive-doc-id="' + escapeHtml(document.id) + '">查看</button></td></tr>';
      }).join("");
    }

    const label = $("#archivePaginationLabel");
    if (label) {
      if (!documents.length) {
        label.textContent = "当前企业暂无文档档案";
      } else if (!filteredDocuments.length) {
        label.textContent = "没有符合当前筛选条件的文档";
      } else {
        const first = startIndex + 1;
        const last = Math.min(startIndex + pageDocuments.length, filteredDocuments.length);
        label.textContent = "显示 " + first + "–" + last + " 条，共 " + filteredDocuments.length + " 条";
      }
    }

    const pager = $("#archivePager");
    if (pager) {
      const previousDisabled = currentArchivePage <= 1 ? " disabled" : "";
      const nextDisabled = currentArchivePage >= totalPages ? " disabled" : "";
      const pageButtons = filteredDocuments.length
        ? archivePageNumbers(totalPages).map((page) => '<button class="' + (page === currentArchivePage ? "active" : "") + '" type="button" data-archive-page="' + page + '"' + (page === currentArchivePage ? ' aria-current="page"' : "") + '>' + page + '</button>').join("")
        : '<button class="active" type="button" disabled>1</button>';
      pager.innerHTML = '<button type="button" data-archive-page="' + Math.max(1, currentArchivePage - 1) + '"' + previousDisabled + '>上一页</button>' +
        pageButtons +
        '<button type="button" data-archive-page="' + Math.min(totalPages, currentArchivePage + 1) + '"' + nextDisabled + '>下一页</button>';
    }
  }

  function filterArchiveTable() {
    if (currentEnterprise) {
      renderArchiveRows(currentEnterprise);
      return;
    }
    const tbody = $("#archiveTableBody");
    if (tbody) {
      tbody.innerHTML = '<tr id="archiveEmptyRow"><td colspan="7" style="padding:42px;text-align:center;color:var(--muted);">请先登录企业账号后查看档案库。</td></tr>';
    }
    setElementText("#archivePaginationLabel", "请先登录企业账号");
    const pager = $("#archivePager");
    if (pager) pager.innerHTML = '<button type="button" disabled>上一页</button><button class="active" type="button" disabled>1</button><button type="button" disabled>下一页</button>';
  }

  statusTabs.forEach((button) => {
    button.addEventListener("click", () => {
      currentArchiveStatus = button.dataset.status;
      currentArchivePage = 1;
      setArchiveTabState();
      filterArchiveTable();
    });
  });
  archiveSearch.addEventListener("input", () => {
    currentArchivePage = 1;
    filterArchiveTable();
  });
  $("#archivePager").addEventListener("click", (event) => {
    const button = event.target.closest("[data-archive-page]");
    if (!button || button.disabled) return;
    const page = Number(button.dataset.archivePage);
    if (!Number.isFinite(page)) return;
    currentArchivePage = page;
    filterArchiveTable();
  });

  // Gap priority filter.
  $$("#gapFilters button").forEach((button) => {
    button.addEventListener("click", () => {
      const priority = button.dataset.priority;
      $$("#gapFilters button").forEach((item) => item.classList.toggle("active", item === button));
      $$(".gap-item").forEach((item) => {
        item.hidden = priority !== "all" && item.dataset.priority !== priority;
      });
    });
  });

  // Document preview modal.
  const docModal = $("#docModal");
  const modalTitle = $("#modalTitle");
  const modalDocName = $("#modalDocName");

  const modalPreviewBody = $("#modalPreviewBody");
  const modalDocMeta = $("#modalDocMeta");
  const modalFileIcon = $("#modalFileIcon");
  const modalDocStatus = $("#modalDocStatus");
  const modalFooterNote = $("#modalFooterNote");
  const modalDownload = $("#modalDownload");
  const modalConfirmReview = $("#modalConfirmReview");
  const modalReplaceFile = $("#modalReplaceFile");
  const modalEditDocument = $("#modalEditDocument");
  const modalSaveVersion = $("#modalSaveVersion");
  const modalImportOcr = $("#modalImportOcr");
  const modalReplaceFileInput = $("#modalReplaceFileInput");
  let activeLibraryFileId = null;
  let activeArchiveDocumentId = null;

  function setModalStatus(label, tone, withCheck = false) {
    modalDocStatus.className = "status-badge " + tone;
    modalDocStatus.innerHTML = (withCheck ? '<svg class="icon tiny"><use href="#i-check"></use></svg>' : "") + escapeHtml(label);
  }

  function previewIssueState(tone, title, copy) {
    const icon = tone === "blocked" ? "#i-alert" : "#i-folder";
    return '<div class="parsed-state ' + tone + '"><span><svg class="icon"><use href="' + icon + '"></use></svg></span><div><strong>' +
      escapeHtml(title) + '</strong><p>' + escapeHtml(copy) + '</p></div></div>';
  }

  function renderPreviewPdf(result) {
    const pages = Array.isArray(result.pages) ? result.pages : [];
    const pageSource = /ocr/i.test(String(result.parser || "")) ? "本地 OCR 文本" : "PDF 文本层";
    const pageHtml = pages.map((page) => {
      const copy = String(page.text || "").trim();
      return '<article class="parsed-page"><header><span>第 ' + Number(page.page || 0) + ' 页</span><small>' + pageSource + '</small></header>' +
        (copy ? '<pre class="parsed-text">' + escapeHtml(copy) + '</pre>' : '<p class="parsed-page-empty">本页未提取到可复制文字</p>') +
        '</article>';
    }).join("");
    return '<div class="parsed-preview-summary"><strong>' + escapeHtml(result.label || "PDF 文本预览") + '</strong><span>共 ' + Number(result.pageCount || pages.length) + ' 页 · ' +
      Number(result.characters || 0).toLocaleString("zh-CN") + ' 字</span></div>' + pageHtml +
      (result.truncated ? '<p class="parsed-limit-note">本地预览仅保留前 60,000 字，完整内容请在正式系统中处理。</p>' : "");
  }

  function renderPreviewSheets(result) {
    const sheets = Array.isArray(result.sheets) ? result.sheets : [];
    const sheetHtml = sheets.map((sheet) => {
      const rows = Array.isArray(sheet.rows) ? sheet.rows : [];
      const headerRow = rows.length > 1 ? rows[0] : null;
      const bodyRows = headerRow ? rows.slice(1) : rows;
      const headerHtml = headerRow
        ? '<thead><tr>' + headerRow.map((cell) => '<th>' + escapeHtml(cell) + '</th>').join("") + '</tr></thead>'
        : "";
      const bodyHtml = bodyRows.map((row) => '<tr>' + row.map((cell) => '<td>' + escapeHtml(cell) + '</td>').join("") + '</tr>').join("");
      return '<section class="parsed-sheet"><header><strong>' + escapeHtml(sheet.name || "工作表") + '</strong><span>' +
        Number(sheet.rowCount || rows.length) + ' 行 · ' + Number(sheet.columnCount || (rows[0] || []).length) + ' 列</span></header>' +
        '<div class="parsed-table-wrap"><table class="parsed-table">' + headerHtml + '<tbody>' + bodyHtml + '</tbody></table></div>' +
        (sheet.truncated ? '<p class="parsed-limit-note">仅展示前 80 行、前 30 列。</p>' : "") + '</section>';
    }).join("");
    return '<div class="parsed-preview-summary"><strong>' + escapeHtml(result.label || "表格预览") + '</strong><span>' +
      Number(result.sheetCount || sheets.length) + ' 个工作表 · ' + Number(result.totalRows || 0).toLocaleString("zh-CN") + ' 行</span></div>' + sheetHtml;
  }

  function renderPreviewText(result) {
    return '<div class="parsed-preview-summary"><strong>' + escapeHtml(result.label || "文本预览") + '</strong><span>' +
      Number(result.characters || 0).toLocaleString("zh-CN") + ' 字</span></div>' +
      '<pre class="parsed-text parsed-document-text">' + escapeHtml(result.text || "") + '</pre>' +
      (result.truncated ? '<p class="parsed-limit-note">本地预览仅保留前 60,000 字。</p>' : "");
  }

  function renderLibraryFilePreview(file) {
    if (!file) return;
    const status = getLibraryStatus(file);
    const parseResult = file.parseResult || {};
    const extension = getFileExtension(file.name).toUpperCase() || "FILE";
    const tone = { company: "red", positions: "indigo", employees: "amber", systems: "green" };
    modalTitle.textContent = file.parseStatus === "parsed" ? "上传资料核查" : "文件处理详情";
    modalDocName.textContent = file.name;
    modalDocMeta.textContent = (importCategoryLabels[file.category] || "其他资料") + " · " + formatFileSize(file.size) + " · " + getParseSummary(file) + " · 账号 " + currentEnterprise.account + " 独立资料";
    modalFileIcon.className = "file-icon " + (tone[file.category] || "blue");
    modalFileIcon.textContent = extension.slice(0, 1);
    setModalStatus(status.label, status.tone, status.tone === "verified");
    modalReplaceFile.hidden = true;
    modalImportOcr.hidden = true;
    modalEditDocument.hidden = true;
    modalSaveVersion.hidden = true;
    modalDownload.hidden = true;
    modalConfirmReview.hidden = file.parseStatus !== "parsed";
    modalConfirmReview.disabled = false;
    modalConfirmReview.innerHTML = '<svg class="icon"><use href="#i-check"></use></svg>确认已核查';
    modalFooterNote.textContent = file.reviewedAt
      ? "已于 " + new Date(file.reviewedAt).toLocaleString("zh-CN", { hour12: false }) + " 完成核查"
      : file.parseStatus === "parsed"
        ? "请核对解析内容；确认后将记录当前企业账号的核查时间"
        : "原始文件未持久化到本地预览，请根据提示处理";

    if (file.parseStatus === "ocr-required") {
      modalPreviewBody.innerHTML = previewIssueState("pending", "扫描版 PDF 尚未提取文字", (parseResult.error || "当前文件是需要 OCR 的扫描件。") + " 本地原型未启用 OCR，因此不会显示或编造任何正文。");
      return;
    }
    if (file.parseStatus === "legacy") {
      modalPreviewBody.innerHTML = previewIssueState("pending", "旧版上传记录无法预览", "该记录由早期版本创建，没有保存原始文件或解析结果。请返回资料中心重新上传该文件。");
      return;
    }
    if (file.parseStatus === "pending") {
      modalPreviewBody.innerHTML = previewIssueState("pending", "文件尚未完成解析", "请关闭后重新选择该文件，系统会在本机完成文本提取。");
      return;
    }
    if (file.parseStatus === "failed") {
      modalPreviewBody.innerHTML = previewIssueState("blocked", "文件解析失败", parseResult.error || "未能读取该文件，请检查格式或重新上传。");
      return;
    }
    if (!file.parseStatus || file.parseStatus !== "parsed" || !file.parseResult) {
      modalPreviewBody.innerHTML = previewIssueState("blocked", "暂无可预览内容", "当前文件没有可用的解析结果。");
      return;
    }
    if (parseResult.kind === "pdf") {
      modalPreviewBody.innerHTML = renderPreviewPdf(parseResult);
    } else if (parseResult.kind === "xlsx" || parseResult.kind === "csv") {
      modalPreviewBody.innerHTML = renderPreviewSheets(parseResult);
    } else if (parseResult.kind === "docx" || parseResult.kind === "txt") {
      modalPreviewBody.innerHTML = renderPreviewText(parseResult);
    } else {
      modalPreviewBody.innerHTML = previewIssueState("pending", "已解析文件", "该格式暂无可视化预览，但解析摘要已记录。");
    }
    if (file.reviewedAt) {
      modalConfirmReview.hidden = true;
      modalFooterNote.textContent = "已于 " + new Date(file.reviewedAt).toLocaleString("zh-CN", { hour12: false }) + " 完成核查";
    }
  }

  function findActiveLibraryFile() {
    if (!activeLibraryFileId || !currentEnterprise) return null;
    const files = getOwnedCompanyFiles(currentEnterprise);
    return files.find((file) => file.id === activeLibraryFileId) || null;
  }

  function deleteLibraryFile(fileId) {
    if (!currentEnterprise) {
      showToast("请先登录企业账号后管理上传资料。", "尚未登录");
      return;
    }
    const files = getOwnedCompanyFiles(currentEnterprise);
    const file = files.find((item) => item.id === fileId);
    if (!file) {
      showToast("当前企业账号中未找到该文件，请刷新后重试。", "文件不存在");
      return;
    }
    if (!window.confirm("确定删除资料“" + file.name + "”吗？删除后需要重新上传才能恢复。")) return;

    currentEnterprise.libraryFiles = files.filter((item) => item.id !== fileId);
    const validCategories = Object.keys(importCategoryLabels);
    currentEnterprise.importedCategories = Array.from(new Set(
      currentEnterprise.libraryFiles
        .map((item) => item.category)
        .filter((category) => validCategories.includes(category))
    ));
    currentEnterprise.completeness = Math.min(100, currentEnterprise.importedCategories.length * 25);
    currentEnterprise.updatedAt = new Date().toISOString();
    saveCompany(currentEnterprise);
    if (activeLibraryFileId === fileId) closeModal();
    showEnterpriseProfile(currentEnterprise);
    showToast("已删除资料“" + file.name + "”。", "删除成功");
  }

  function openLibraryFilePreview(fileId) {
    if (!currentEnterprise) {
      showToast("请先登录企业账号后查看上传资料。", "尚未登录");
      return;
    }
    const files = getOwnedCompanyFiles(currentEnterprise);
    const file = files.find((item) => item.id === fileId);
    if (!file) {
      showToast("当前企业账号中未找到该文件，请刷新后重试。", "文件不存在");
      return;
    }
    activeLibraryFileId = file.id;
    activeArchiveDocumentId = null;
    renderLibraryFilePreview(file);
    docModal.hidden = false;
    document.body.style.overflow = "hidden";
    $("#modalClose").focus();
  }

  function openModal(name) {
    activeLibraryFileId = null;
    activeArchiveDocumentId = null;
    modalTitle.textContent = name || "文档详情";
    modalDocName.textContent = name || "文档名称";
    modalDocMeta.textContent = currentEnterprise ? "当前企业账号文档 · 本地原型" : "请先登录企业账号";
    modalFileIcon.className = "file-icon blue";
    modalFileIcon.textContent = "D";
    setModalStatus("预览", "draft");
    modalReplaceFile.hidden = true;
    modalImportOcr.hidden = true;
    modalEditDocument.hidden = true;
    modalSaveVersion.hidden = true;
    modalDownload.hidden = true;
    modalConfirmReview.hidden = true;
    modalFooterNote.textContent = currentEnterprise ? "正式文档正文将在生成服务接入后显示" : "请先登录企业账号";
    modalPreviewBody.innerHTML = previewIssueState("pending", "文档草稿", "当前记录仅包含生成任务元数据，正文尚未接入正式文档生成服务。");
    docModal.hidden = false;
    document.body.style.overflow = "hidden";
    $("#modalClose").focus();
  }

  function getActiveArchiveDocument() {
    if (!activeArchiveDocumentId || !currentEnterprise) return null;
    return ensureArchiveDocuments(currentEnterprise).find((item) => item.id === activeArchiveDocumentId) || null;
  }

  function nextDocumentVersion(value) {
    const match = /^V?(\d+)\.(\d+)$/i.exec(String(value || "").trim());
    if (!match) return "V1.1";
    return "V" + match[1] + "." + (Number(match[2]) + 1);
  }

  function getArchiveDocumentBody(archiveDocument) {
    const text = String(archiveDocument && archiveDocument.body || "").trim();
    const lines = text.split(/\r?\n/);
    while (lines.length && !lines[0].trim()) lines.shift();
    const heading = lines.length ? lines[0].trim() : "";
    const name = String(archiveDocument && archiveDocument.name || "").trim();
    if (heading && (heading === name || name.endsWith(heading) || heading === String(archiveDocument.templateName || "").trim())) {
      lines.shift();
      while (lines.length && !lines[0].trim()) lines.shift();
    }
    return lines.join("\n").trim() || text;
  }

  function renderArchiveDocumentPreview(archiveDocument, editing = false) {
    if (!archiveDocument) return;
    if (editing) {
      modalPreviewBody.innerHTML = '<div class="archive-editor-wrap"><div class="archive-editor-head"><div><strong>编辑文档正文</strong><span>保存后生成新版本，不覆盖历史版本。</span></div><span class="version-tag">' + escapeHtml(archiveDocument.version) + '</span></div>' +
        '<textarea class="archive-document-editor" id="archiveDocumentEditor" aria-label="编辑文档正文">' + escapeHtml(archiveDocument.body || "") + '</textarea></div>';
      return;
    }
    const body = getArchiveDocumentBody(archiveDocument) || "该文档尚未生成正文内容。";
    const versions = Array.isArray(archiveDocument.versions) ? archiveDocument.versions.slice().reverse() : [];
    const versionHistory = versions.length
      ? '<details class="archive-version-history"><summary>版本记录 <b>' + versions.length + '</b> 个 · 当前 ' + escapeHtml(archiveDocument.version) + '</summary><div>' +
        versions.map((version) => '<span><b>' + escapeHtml(version.version || "—") + '</b><em>' + escapeHtml(version.note || "版本更新") + '</em><small>' + escapeHtml(formatArchiveDate(version.createdAt)) + '</small></span>').join("") +
        '</div></details>'
      : "";
    modalPreviewBody.innerHTML = '<div class="paper-preview archive-document-preview"><div class="paper-header"><span>职安文档云</span><small>企业独立档案库 · ' + escapeHtml(archiveDocument.documentNumber || "未编号") + '</small></div>' +
      '<div class="paper-title">' + escapeHtml(archiveDocument.name) + '</div>' +
      '<div class="archive-document-meta"><span>版本 ' + escapeHtml(archiveDocument.version) + '</span><span>' + escapeHtml(archiveDocument.scopeText || archiveDocument.targetName || "当前企业") + '</span><span>' + escapeHtml(archiveDocument.templateCode || "生成文档") + '</span></div>' +
      '<pre class="archive-document-body">' + escapeHtml(body) + '</pre>' +
      versionHistory +
      '<div class="paper-sign-row"><span>来源：' + escapeHtml(archiveDocument.sourceName || "当前企业档案") + '</span><span>更新：' + escapeHtml(formatArchiveDate(archiveDocument.updatedAt || archiveDocument.createdAt)) + '</span></div></div>';
  }

  function downloadArchiveDocument(archiveDocument) {
    if (!archiveDocument) return;
    const safeName = String(archiveDocument.name || "生成文档").replace(/[\\/:*?"<>|]+/g, "_");
    const paragraphs = getArchiveDocumentBody(archiveDocument).split(/\r?\n/).map((line) => line.trim()
      ? '<p>' + escapeHtml(line) + '</p>'
      : '<p>&nbsp;</p>').join("");
    const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + escapeHtml(archiveDocument.name) + '</title>' +
      '<style>body{font-family:"Microsoft YaHei","SimSun",serif;font-size:12pt;line-height:1.7;color:#111}h1{font-size:18pt;text-align:center;margin:24pt 0}p{margin:0 0 6pt}.meta{text-align:center;color:#555;font-size:9pt;margin-bottom:18pt}</style></head><body>' +
      '<h1>' + escapeHtml(archiveDocument.name) + '</h1><div class="meta">' + escapeHtml(archiveDocument.documentNumber + " · " + archiveDocument.version) + '</div>' + paragraphs + '</body></html>';
    const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = safeName + ".doc";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function showArchiveDocumentEditor() {
    const archiveDocument = getActiveArchiveDocument();
    if (!archiveDocument) return;
    if (archiveDocument.status === "signed" || archiveDocument.status === "archived") {
      showToast("已签发或归档文档不允许直接修改，请先创建修订版本。", "当前不可编辑");
      return;
    }
    renderArchiveDocumentPreview(archiveDocument, true);
    modalEditDocument.hidden = true;
    modalSaveVersion.hidden = false;
    modalDownload.hidden = true;
    modalFooterNote.textContent = "编辑内容保存后会生成新版本，原版本保留在版本记录中。";
    const editor = $("#archiveDocumentEditor");
    if (editor) editor.focus();
  }

  function saveArchiveDocumentVersion() {
    const archiveDocument = getActiveArchiveDocument();
    const editor = $("#archiveDocumentEditor");
    if (!archiveDocument || !editor) return;
    const body = String(editor.value || "").trim();
    if (!body) {
      showToast("文档正文不能为空。", "无法保存");
      editor.focus();
      return;
    }
    if (body === String(archiveDocument.body || "").trim()) {
      showToast("正文没有变化，未创建新版本。", "无需保存");
      return;
    }
    const now = new Date().toISOString();
    const version = nextDocumentVersion(archiveDocument.version);
    if (!Array.isArray(archiveDocument.versions)) archiveDocument.versions = [];
    archiveDocument.versions.push({ version: version, body: body, createdAt: now, note: "人工编辑保存" });
    archiveDocument.body = body;
    archiveDocument.version = version;
    archiveDocument.status = "draft";
    archiveDocument.updatedAt = now;
    currentEnterprise.updatedAt = now;
    appendAuditLog(currentEnterprise, "编辑文档正文", "生成新版本 " + version + "：" + archiveDocument.name);
    saveCompany(currentEnterprise);
    renderLibrary(currentEnterprise);
    renderArchiveAccountData(currentEnterprise);
    renderArchiveDocumentPreview(archiveDocument);
    modalEditDocument.hidden = false;
    modalSaveVersion.hidden = true;
    modalDownload.hidden = false;
    modalFooterNote.textContent = "已保存新版本 " + version + "，当前文档状态为草稿。";
    showToast("已保存 " + version + "，历史版本仍保留。", "保存成功");
  }

  function selectDocumentForReplacement(documentId) {
    if (!currentEnterprise) return;
    const archiveDocument = ensureArchiveDocuments(currentEnterprise).find((item) => item.id === documentId);
    if (!archiveDocument) {
      showToast("未找到要重新上传的文档。", "文件不存在");
      return;
    }
    activeLibraryFileId = null;
    activeArchiveDocumentId = archiveDocument.id;
    modalReplaceFileInput.value = "";
    modalReplaceFileInput.click();
  }

  async function replaceArchiveDocumentFromFile(file) {
    const archiveDocument = getActiveArchiveDocument();
    if (!archiveDocument || !file) return;
    try {
      if (!window.LocalParsers || typeof window.LocalParsers.parse !== "function") {
        throw new Error("本地文件解析组件未加载。");
      }
      modalFooterNote.textContent = "正在解析重新上传的文件…";
      const parsed = await window.LocalParsers.parse(file);
      const replacementText = window.LocalParsers.asText(parsed).trim();
      if (parsed.parseStatus !== "parsed" || !replacementText) {
        throw new Error((parsed.parseResult && parsed.parseResult.error) || "文件未提取到可用正文。");
      }
      const now = new Date().toISOString();
      const version = nextDocumentVersion(archiveDocument.version);
      if (!Array.isArray(archiveDocument.versions)) archiveDocument.versions = [];
      archiveDocument.versions.push({ version: version, body: replacementText, createdAt: now, note: "重新上传：" + file.name });
      archiveDocument.body = replacementText;
      archiveDocument.version = version;
      archiveDocument.status = "draft";
      archiveDocument.replacementName = file.name;
      archiveDocument.updatedAt = now;
      currentEnterprise.updatedAt = now;
      appendAuditLog(currentEnterprise, "重新上传文档", "重新上传 " + file.name + "，生成版本 " + version + "：" + archiveDocument.name);
      saveCompany(currentEnterprise);
      renderLibrary(currentEnterprise);
      renderArchiveAccountData(currentEnterprise);
      openArchiveDocument(archiveDocument.id);
      showToast("已用“" + file.name + "”替换正文并生成新版本 " + version + "。", "重新上传成功");
    } catch (error) {
      modalFooterNote.textContent = "重新上传失败，原文档未被修改。";
      showToast(error && error.message || "文件解析失败，请重新选择。", "重新上传失败");
    } finally {
      modalReplaceFileInput.value = "";
    }
  }

  function openArchiveDocument(documentId) {
    if (!currentEnterprise) {
      showToast("请先登录企业账号后查看档案。", "尚未登录");
      return;
    }
    const archiveDocument = ensureArchiveDocuments(currentEnterprise).find((item) => item.id === documentId);
    if (!archiveDocument) {
      showToast("当前企业账号中未找到该档案，其他企业的档案不会在此显示。", "档案不存在");
      return;
    }
    const meta = getArchiveStatusMeta(archiveDocument.status);
    activeLibraryFileId = null;
    activeArchiveDocumentId = archiveDocument.id;
    modalTitle.textContent = "生成文档";
    modalDocName.textContent = archiveDocument.name;
    modalDocMeta.textContent = archiveDocument.documentNumber + " · " + meta.label + " · 企业码 " + currentEnterprise.code;
    modalFileIcon.className = "file-icon " + (archiveDocument.iconTone || meta.iconTone);
    modalFileIcon.textContent = archiveDocument.iconLetter || "D";
    setModalStatus(meta.label, meta.tone, archiveDocument.status === "signed");
    modalReplaceFile.hidden = false;
    modalImportOcr.hidden = true;
    modalEditDocument.hidden = false;
    modalSaveVersion.hidden = true;
    modalDownload.hidden = false;
    modalConfirmReview.hidden = true;
    modalFooterNote.textContent = "企业码 " + currentEnterprise.code + " 独立档案 · 支持编辑新版本、下载与重新上传";
    renderArchiveDocumentPreview(archiveDocument);
    docModal.hidden = false;
    document.body.style.overflow = "hidden";
    $("#modalClose").focus();
  }

  function closeModal() {
    if (docModal.hidden) return;
    docModal.hidden = true;
    document.body.style.overflow = "";
    activeLibraryFileId = null;
    activeArchiveDocumentId = null;
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest("input[type='checkbox'], label")) return;
    const generatedDownload = event.target.closest("[data-generated-download]");
    if (generatedDownload) {
      event.preventDefault();
      const archiveDocument = ensureArchiveDocuments(currentEnterprise || {}).find((item) => item.id === generatedDownload.dataset.generatedDownload);
      if (archiveDocument) downloadArchiveDocument(archiveDocument);
      return;
    }
    const generatedReplace = event.target.closest("[data-generated-replace]");
    if (generatedReplace) {
      event.preventDefault();
      selectDocumentForReplacement(generatedReplace.dataset.generatedReplace);
      return;
    }
    const archiveButton = event.target.closest("[data-archive-doc-id]");
    if (archiveButton) {
      event.preventDefault();
      openArchiveDocument(archiveButton.dataset.archiveDocId);
      return;
    }
    const docButton = event.target.closest("[data-doc]");
    if (docButton) openModal(docButton.dataset.doc);
    const libraryButton = event.target.closest("[data-doc-id]");
    if (!libraryButton) return;
    event.preventDefault();
    const inDashboard = Boolean(libraryButton.closest("#view-dashboard"));
    if (!inDashboard) setView("dashboard");
    openLibraryFilePreview(libraryButton.dataset.docId);
    if (!inDashboard) {
      requestAnimationFrame(() => {
        const reviewPanel = $("#dashboardReviewPanel");
        if (reviewPanel) reviewPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  });

  modalConfirmReview.addEventListener("click", () => {
    const file = findActiveLibraryFile();
    if (!file || !currentEnterprise) return;
    file.reviewedAt = new Date().toISOString();
    currentEnterprise.updatedAt = file.reviewedAt;
    saveCompany(currentEnterprise);
    showEnterpriseProfile(currentEnterprise);
    closeModal();
    setView("dashboard");
    requestAnimationFrame(() => {
      const reviewPanel = $("#dashboardReviewPanel");
      if (reviewPanel) reviewPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    showToast("文件 " + file.name + " 已完成核查，状态仅在当前企业账号中保存。", "核查完成");
  });

  modalDownload.addEventListener("click", () => downloadArchiveDocument(getActiveArchiveDocument()));
  modalEditDocument.addEventListener("click", showArchiveDocumentEditor);
  modalSaveVersion.addEventListener("click", saveArchiveDocumentVersion);
  modalReplaceFile.addEventListener("click", () => {
    if (!getActiveArchiveDocument()) return;
    modalReplaceFileInput.value = "";
    modalReplaceFileInput.click();
  });
  modalReplaceFileInput.addEventListener("change", () => {
    const file = modalReplaceFileInput.files && modalReplaceFileInput.files[0];
    if (file) replaceArchiveDocumentFromFile(file);
  });

  $("#modalClose").addEventListener("click", closeModal);
  $("#modalCancel").addEventListener("click", closeModal);
  docModal.addEventListener("click", (event) => {
    if (event.target === docModal) closeModal();
  });

  // Data-toast buttons inside the modal should not block the prototype.
  docModal.addEventListener("click", (event) => {
    const action = event.target.closest("[data-toast]");
    if (action) showToast(action.dataset.toast);
  });

  window.addEventListener("hashchange", () => setView(resolveViewFromHash(), false));
  setView(resolveViewFromHash(), false);
  refreshSelectionState();
  filterArchiveTable();
  const previewParams = new URLSearchParams(window.location.search);
  const forceLoginPreview = previewParams.get("login") === "1";
  const authPreview = previewParams.get("auth");
  const authPreviewViews = { register: "register", enterprise: "enterprise", personal: "personal" };
  const sessionCompanyCode = readSession("zadocs_session_company_code");
  const sessionCompany = sessionCompanyCode ? findCompanyByCode(sessionCompanyCode) : null;
  const hasInvalidSession = Boolean(sessionCompanyCode) && !sessionCompany;
  const requiresLogin = readSession("zadocs_logged_out") === "1" || forceLoginPreview || Boolean(authPreview) || hasInvalidSession;
  if (requiresLogin || !sessionCompany) {
    showLoginScreen(false);
    if (authPreviewViews[authPreview]) setAuthView(authPreviewViews[authPreview]);
  } else {
    activateEnterprise(sessionCompany);
    setView(resolveViewFromHash(), false);
  }
  if (previewParams.get("menu") === "1" && !forceLoginPreview) setAccountMenu(true);
})();
