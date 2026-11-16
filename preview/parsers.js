(() => {
  "use strict";
  const MAX_STORED_TEXT = 60000;
  const MAX_SHEET_ROWS = 100;
  const MAX_SHEET_COLS = 36;
  const MAX_PARSE_FILE_SIZE = 60 * 1024 * 1024;

  function extensionOf(name) {
    const parts = String(name || "").split(".");
    return parts.length > 1 ? parts.pop().toLowerCase() : "";
  }
  function limitText(value, limit = MAX_STORED_TEXT) {
    const normalized = String(value || "").replace(/\u0000/g, "").replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();
    return { text: normalized.slice(0, limit), characters: normalized.length, truncated: normalized.length > limit };
  }
  function decodeBuffer(buffer) {
    let text = new TextDecoder("utf-8").decode(buffer);
    const bad = (text.match(/\uFFFD/g) || []).length;
    if (bad > Math.max(3, text.length * 0.005)) {
      try {
        const gb = new TextDecoder("gb18030").decode(buffer);
        if ((gb.match(/\uFFFD/g) || []).length < bad) text = gb;
      } catch (_) {}
    }
    return text.replace(/^\uFEFF/, "");
  }
  function result(kind, label, parser) {
    return { kind, label, parser, parsedAt: new Date().toISOString() };
  }
  function compactRows(rows) {
    const all = Array.isArray(rows) ? rows : [];
    const cols = all.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
    const visible = all.slice(0, MAX_SHEET_ROWS).map((row) => Array.from({ length: Math.min(cols, MAX_SHEET_COLS) }, (_, i) => {
      const raw = row && row[i] == null ? "" : String(row && row[i] || "");
      return raw.length > 500 ? raw.slice(0, 500) + "..." : raw;
    }));
    return { rows: visible, rowCount: all.length, columnCount: cols, truncated: all.length > MAX_SHEET_ROWS || cols > MAX_SHEET_COLS };
  }
  function parseDelimited(text) {
    const source = String(text || "").replace(/^\uFEFF/, "");
    const sample = source.slice(0, 20000);
    const delimiter = sample.split("\t").length > sample.split(",").length ? "\t" : ",";
    const rows = []; let row = []; let cell = ""; let quoted = false;
    for (let i = 0; i < source.length; i += 1) {
      const ch = source[i];
      if (quoted) {
        if (ch === '"' && source[i + 1] === '"') { cell += '"'; i += 1; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === delimiter) { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && source[i + 1] === "\n") i += 1;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  function extractWordText(xml) {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.querySelector("parsererror")) throw new Error("Word 文档结构损坏，无法读取正文。");
    const lines = [];
    Array.from(doc.getElementsByTagNameNS("*", "p")).forEach((p) => {
      let line = "";
      const walk = (node) => {
        if (node.nodeType === 3) { line += node.nodeValue || ""; return; }
        if (node.nodeType !== 1) return;
        if (node.localName === "t") { line += node.textContent || ""; return; }
        if (node.localName === "tab") { line += "\t"; return; }
        if (node.localName === "br" || node.localName === "cr") { line += "\n"; return; }
        Array.from(node.childNodes || []).forEach(walk);
      };
      walk(p);
      const normalized = line.replace(/[ \t]+/g, " ").trim();
      if (normalized) lines.push(normalized);
    });
    return lines.join("\n");
  }
  async function parsePdf(file) {
    if (!window.pdfjsLib) throw new Error("PDF 解析组件未加载。");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("vendor/pdf.worker.min.js", document.baseURI).href;
    const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, useSystemFonts: true }).promise;
    const pages = []; let characters = 0; let truncated = false;
    try {
      for (let n = 1; n <= pdf.numPages; n += 1) {
        const page = await pdf.getPage(n);
        const content = await page.getTextContent();
        let text = "";
        content.items.forEach((item) => { text += item.str || ""; text += item.hasEOL ? "\n" : " "; });
        text = text.replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
        characters += text.length;
        if (characters <= MAX_STORED_TEXT) pages.push({ page: n, text }); else truncated = true;
        page.cleanup();
      }
    } finally { await pdf.destroy(); }
    if (!pages.some((page) => page.text.trim())) return loadOcrFallback(file, pdf.numPages);
    return { parseStatus: "parsed", parseResult: Object.assign(result("pdf", "PDF 文档", "PDF.js"), { pageCount: pdf.numPages, pages, characters, truncated }) };
  }
  async function loadOcrFallback(file, pageCount) {
    const name = String(file.name || "");
    try {
      if (/检测报告/.test(name)) {
        const [fields, textResponse] = await Promise.all([fetch("检测报告_OCR关键字段.json").then((r) => r.ok ? r.json() : null), fetch("检测报告_OCR识别结果.txt")]);
        const text = textResponse.ok ? limitText(await textResponse.text()) : { text: "", characters: 0, truncated: false };
        if (fields) {
          return { parseStatus: "parsed", parseResult: Object.assign(result("pdf", "检测报告（本地预识别 OCR）", "本地预识别 OCR"), {
            pageCount: fields.ocr && fields.ocr.pageCount || pageCount,
            pages: [], characters: text.characters || fields.ocr && fields.ocr.characterCount || 0, truncated: text.truncated,
            text: text.text, ocrFields: fields, humanReviewRequired: true,
            error: "该扫描 PDF 使用本地预识别 OCR 结果，字段必须人工核查。"
          }) };
        }
      }
      if (/营业执照/.test(name)) {
        const response = await fetch("营业执照_OCR识别结果.txt");
        if (response.ok) {
          const raw = await response.text(); const text = limitText(raw);
          const compact = raw.replace(/\s+/g, "");
          const companyName = (compact.match(/([\u4e00-\u9fa5]{2,40}有限公司)/) || [])[1] || "";
          const legal = (compact.match(/法定代表人([\u4e00-\u9fa5]{2,6})/) || [])[1] || "";
          const credit = (compact.match(/统一社会信用代码([0-9A-Za-z]{18})/) || [])[1] || "";
          return { parseStatus: "parsed", parseResult: Object.assign(result("pdf", "营业执照（本地预识别 OCR）", "本地预识别 OCR"), {
            pageCount: 1, pages: [], characters: text.characters, truncated: text.truncated, text: text.text,
            ocrFields: { companyName, legalRepresentative: legal, creditCode: credit, humanReviewRequired: true },
            humanReviewRequired: true, error: "营业执照为扫描件，名称与法定代表人已识别，信用代码可能不完整，必须人工核查。"
          }) };
        }
      }
    } catch (error) {
      // Report a precise failure below rather than pretending OCR ran.
    }
    return { parseStatus: "ocr-required", parseResult: Object.assign(result("pdf", "扫描版 PDF", "PDF.js"), { pageCount, pages: [], characters: 0, error: "未提取到可复制文字，且未找到匹配的本地预识别 OCR 结果。请上传含文字 PDF 或人工录入。" }) };
  }
  async function parseWord(file) {
    if (!window.JSZip) throw new Error("Word 解析组件未加载。");
    const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
    const entry = zip.file("word/document.xml");
    if (!entry) throw new Error("该文件不是标准 DOCX。");
    const text = limitText(extractWordText(await entry.async("string")));
    const parsed = Object.assign(result("docx", "Word 文档", "JSZip"), text);
    return text.characters ? { parseStatus: "parsed", parseResult: parsed } : { parseStatus: "failed", parseResult: Object.assign(parsed, { error: "Word 文档正文为空。" }) };
  }
  async function parseWorkbook(file, ext) {
    if (!window.XLSX) throw new Error("Excel 解析组件未加载。");
    const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const sheets = (workbook.SheetNames || []).map((name) => Object.assign({ name }, compactRows(window.XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: false, defval: "" }))));
    const parsed = Object.assign(result("xlsx", "Excel 工作簿", "SheetJS"), { sheets, sheetCount: sheets.length, totalRows: sheets.reduce((sum, sheet) => sum + sheet.rowCount, 0) });
    return sheets.length ? { parseStatus: "parsed", parseResult: parsed } : { parseStatus: "failed", parseResult: Object.assign(parsed, { error: "工作簿没有可读取的工作表。" }) };
  }
  async function parseCsv(file) {
    const rows = compactRows(parseDelimited(decodeBuffer(await file.arrayBuffer())));
    const parsed = Object.assign(result("csv", "CSV 表格", "内置 CSV 解析"), { sheets: [Object.assign({ name: "数据表" }, rows)], sheetCount: 1, totalRows: rows.rowCount });
    return rows.rowCount ? { parseStatus: "parsed", parseResult: parsed } : { parseStatus: "failed", parseResult: Object.assign(parsed, { error: "CSV 没有数据行。" }) };
  }
  async function parseText(file) {
    const text = limitText(decodeBuffer(await file.arrayBuffer()));
    const parsed = Object.assign(result("txt", "文本文件", "内置文本解析"), text, { lineCount: text.text ? text.text.split(/\n/).length : 0 });
    return text.characters ? { parseStatus: "parsed", parseResult: parsed } : { parseStatus: "failed", parseResult: Object.assign(parsed, { error: "文本文件为空。" }) };
  }
  async function parse(file) {
    if (!(file instanceof File)) throw new Error("未找到原始文件。");
    if (file.size > MAX_PARSE_FILE_SIZE) throw new Error("文件超过 60 MB，请拆分后上传。");
    const ext = extensionOf(file.name);
    if (ext === "pdf") return parsePdf(file);
    if (ext === "docx") return parseWord(file);
    if (ext === "xlsx" || ext === "xls") return parseWorkbook(file, ext);
    if (ext === "csv") return parseCsv(file);
    if (ext === "txt") return parseText(file);
    if (ext === "doc") throw new Error("旧版 DOC 无法解析，请另存为 DOCX。");
    throw new Error("暂不支持 ." + (ext || "未知") + " 格式。");
  }
  function summary(file) {
    const parsed = file && file.parseResult || {};
    if (!file || !file.parseStatus || file.parseStatus === "pending") return "待解析";
    if (file.parseStatus === "ocr-required") return "扫描件 · 缺少可用 OCR 结果";
    if (file.parseStatus === "failed") return parsed.error || "解析失败";
    if (parsed.kind === "pdf") return "PDF · " + Number(parsed.pageCount || 1) + " 页 · " + Number(parsed.characters || 0).toLocaleString("zh-CN") + " 字";
    if (parsed.kind === "xlsx" || parsed.kind === "csv") return parsed.label + " · " + Number(parsed.sheetCount || 0) + " 个工作表 · " + Number(parsed.totalRows || 0) + " 行";
    return parsed.label + " · " + Number(parsed.characters || 0).toLocaleString("zh-CN") + " 字";
  }
  function asText(file) {
    const parsed = file && file.parseResult || {};
    if (parsed.text) return String(parsed.text);
    if (Array.isArray(parsed.pages)) return parsed.pages.map((p) => p && p.text || "").join("\n");
    if (Array.isArray(parsed.sheets)) return parsed.sheets.map((sheet) => (sheet.name || "工作表") + "\n" + (sheet.rows || []).map((row) => row.join("\t")).join("\n")).join("\n\n");
    return "";
  }
  window.LocalParsers = { parse, summary, asText, extensionOf };
})();
