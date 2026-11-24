(() => {
  "use strict";

  const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const XML_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

  function escapeXml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function safeFileName(value, fallback = "未命名文档") {
    const normalized = String(value == null ? "" : value)
      .replace(/[\\/:*?"<>|\r\n\t]+/g, "_")
      .replace(/\s+/g, " ")
      .replace(/^\.+|\.+$/g, "")
      .trim();
    return (normalized || fallback).slice(0, 120);
  }

  function paragraphXml(textValue, options = {}) {
    const text = String(textValue == null ? "" : textValue);
    if (!text.trim()) {
      return '<w:p><w:pPr><w:spacing w:after="80"/></w:pPr></w:p>';
    }
    const align = options.center ? '<w:jc w:val="center"/>' : "";
    const bold = options.bold ? "<w:b/>" : "";
    const size = options.size ? '<w:sz w:val="' + Number(options.size) + '"/><w:szCs w:val="' + Number(options.size) + '"/>' : "";
    const color = options.color ? '<w:color w:val="' + escapeXml(options.color) + '"/>' : "";
    const keepNext = options.keepNext ? "<w:keepNext/>" : "";
    return '<w:p><w:pPr><w:spacing w:after="' + Number(options.after == null ? 80 : options.after) + '" w:line="360" w:lineRule="auto"/>' + align + keepNext + '</w:pPr>' +
      '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="宋体"/>' + bold + size + color + '</w:rPr>' +
      '<w:t xml:space="preserve">' + escapeXml(text) + '</w:t></w:r></w:p>';
  }

  function buildDocumentXml(document) {
    const source = document && typeof document === "object" ? document : {};
    const title = String(source.name || "生成文档").trim();
    const body = String(source.body || "").trim();
    const meta = [source.documentNumber, source.version, source.scopeText].filter(Boolean).join(" · ");
    const paragraphs = [
      paragraphXml(title, { center: true, bold: true, size: 36, after: 120, keepNext: true }),
      paragraphXml(meta, { center: true, size: 18, color: "666666", after: 240 }),
      ...body.split(/\r?\n/).map((line) => paragraphXml(line))
    ];
    if (source.signer || source.signedAt) {
      paragraphs.push(paragraphXml("签发人：" + (source.signer || "待补充") + "    签发日期：" + (source.signedAt || "待补充"), { after: 160 }));
    }
    return XML_HEADER + '<w:document ' + XML_NS + '><w:body>' + paragraphs.join("") +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>' +
      '</w:body></w:document>';
  }

  function buildStylesXml() {
    return XML_HEADER + '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="宋体"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="zh-CN" w:eastAsia="zh-CN"/></w:rPr></w:rPrDefault>' +
      '<w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
      '</w:styles>';
  }

  function buildCoreXml(document) {
    const source = document && typeof document === "object" ? document : {};
    const now = new Date().toISOString();
    const created = String(source.createdAt || source.generatedAt || now).replace(/\.\d{3}Z$/, "Z");
    const modified = String(source.updatedAt || source.generatedAt || source.createdAt || now).replace(/\.\d{3}Z$/, "Z");
    return XML_HEADER + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:title>' + escapeXml(source.name || "生成文档") + '</dc:title>' +
      '<dc:subject>' + escapeXml(source.templateName || "职业健康管理文档") + '</dc:subject>' +
      '<dc:creator>职安文档云</dc:creator><cp:lastModifiedBy>职安文档云</cp:lastModifiedBy>' +
      '<dcterms:created xsi:type="dcterms:W3CDTF">' + escapeXml(created) + '</dcterms:created>' +
      '<dcterms:modified xsi:type="dcterms:W3CDTF">' + escapeXml(modified) + '</dcterms:modified>' +
      '</cp:coreProperties>';
  }

  function buildAppXml() {
    return XML_HEADER + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
      '<Application>职安文档云</Application><AppVersion>1.0</AppVersion></Properties>';
  }

  function buildContentTypesXml() {
    return XML_HEADER + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
      '</Types>';
  }

  function buildRootRelsXml() {
    return XML_HEADER + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
      '</Relationships>';
  }

  function buildDocumentRelsXml() {
    return XML_HEADER + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>';
  }

  async function createDocxBlob(document) {
    const JSZipCtor = window.JSZip;
    if (!JSZipCtor) throw new Error("DOCX 导出组件未加载，请刷新页面后重试。");
    const zip = new JSZipCtor();
    zip.file("[Content_Types].xml", buildContentTypesXml());
    zip.file("_rels/.rels", buildRootRelsXml());
    zip.file("docProps/core.xml", buildCoreXml(document));
    zip.file("docProps/app.xml", buildAppXml());
    zip.file("word/document.xml", buildDocumentXml(document));
    zip.file("word/styles.xml", buildStylesXml());
    zip.file("word/_rels/document.xml.rels", buildDocumentRelsXml());
    return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", compression: "DEFLATE", compressionOptions: { level: 6 } });
  }

  function csvCell(value) {
    const text = String(value == null ? "" : value);
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  function formatDate(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
    return match ? match[1] + "-" + match[2] + "-" + match[3] : text;
  }

  function buildDirectoryCsv(documents) {
    const statusLabels = { draft: "草稿", review: "待审核", signed: "已签发", archived: "已归档" };
    const rows = [["序号", "档案编号", "文档名称", "模板名称", "模板编号", "版本", "状态", "适用范围", "签发人", "签发日期", "生成日期"]];
    (Array.isArray(documents) ? documents : []).forEach((document, index) => {
      rows.push([
        index + 1,
        document.documentNumber || "",
        document.name || "",
        document.templateName || "",
        document.templateCode || "",
        document.version || "",
        statusLabels[document.status] || document.status || "草稿",
        document.scopeText || document.targetName || "",
        document.signer || "",
        formatDate(document.signedAt),
        formatDate(document.generatedAt || document.createdAt)
      ]);
    });
    return "\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  }

  function createTextBlob(text, mimeType) {
    return new Blob([String(text || "")], { type: mimeType || "text/plain;charset=utf-8" });
  }

  async function createDirectoryCsvBlob(documents) {
    return createTextBlob(buildDirectoryCsv(documents), "text/csv;charset=utf-8");
  }

  async function createArchivePackage(company, documents) {
    const JSZipCtor = window.JSZip;
    if (!JSZipCtor) throw new Error("ZIP 导出组件未加载，请刷新页面后重试。");
    const zip = new JSZipCtor();
    const list = Array.isArray(documents) ? documents : [];
    const usedPaths = new Set();
    const folderFor = (document) => {
      const code = safeFileName(document.templateCode || "", "TEMPLATE");
      const name = safeFileName(document.templateName || "其他文档", "其他文档");
      return code + "_" + name;
    };
    for (const document of list) {
      const blob = await createDocxBlob(document);
      const folder = folderFor(document);
      const base = safeFileName((document.documentNumber || "DOC") + "_" + (document.name || "生成文档"), "生成文档");
      let path = folder + "/" + base + ".docx";
      let suffix = 2;
      while (usedPaths.has(path)) {
        path = folder + "/" + base + "_" + suffix + ".docx";
        suffix += 1;
      }
      usedPaths.add(path);
      zip.file(path, blob);
    }
    zip.file("档案目录.csv", buildDirectoryCsv(list));
    zip.file("导出说明.txt", [
      "职安文档云企业档案包",
      "企业：" + String(company && (company.name || company.account) || "当前企业"),
      "企业码：" + String(company && company.code || ""),
      "导出时间：" + new Date().toLocaleString("zh-CN", { hour12: false }),
      "文档数量：" + list.length,
      "",
      "说明：本档案包由浏览器本地数据和已生成模板正文导出，不含上传的原始文件。",
      "签发与归档状态可在档案目录.csv中核对。"
    ].join("\r\n"));
    return zip.generateAsync({ type: "blob", mimeType: "application/zip", compression: "DEFLATE", compressionOptions: { level: 6 } });
  }

  function downloadBlob(blob, fileName) {
    if (!(blob instanceof Blob)) throw new Error("导出内容无效。");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  window.DocumentExporter = {
    safeFileName,
    escapeXml,
    buildDocumentXml,
    createDocxBlob,
    buildDirectoryCsv,
    createDirectoryCsvBlob,
    createArchivePackage,
    downloadBlob
  };
})();
