(() => {
  "use strict";

  const HAZARD_TERMS = [
    "噪声", "照度", "高温", "电焊烟尘", "矽尘", "煤尘", "水泥粉尘", "其他粉尘", "粉尘",
    "苯系物", "苯", "甲苯", "二甲苯", "甲醛", "氨", "硫化氢", "一氧化碳", "二氧化碳",
    "锰及其化合物", "铅及其化合物", "汞及其化合物", "铬及其化合物", "镍及其化合物",
    "手传振动", "紫外辐射", "紫外线", "微波", "高频电磁场", "工频电场"
  ];

  const COMPANY_KEYS = [
    "单位名称", "企业名称", "用人单位", "通迅地址", "通讯地址", "注册地址", "住所", "地址",
    "邮编", "社会信用证代码", "统一社会信用代码", "信用代码", "注册资金", "注册资本",
    "所属乡镇街道", "所属行业", "行业", "经济类型", "企业规模", "单位法人", "法定代表人",
    "体检联系人", "联系人", "单位法人电话", "联系电话", "职工总人数", "女职工人数",
    "生产工人数", "生产女工人数", "接触有毒有害作业人数", "接害人数", "生产场所"
  ];

  const HEADER_ALIASES = {
    name: ["姓名", "员工姓名", "人员姓名"],
    gender: ["性别"],
    idNumber: ["身份证号", "身份证号码", "证件号码"],
    phone: ["联系电话", "手机号", "手机号码", "电话"],
    position: ["工种", "岗位", "工作岗位"],
    department: ["部门", "车间", "所属部门"],
    hazards: ["接触有害因素", "接触职业病危害因素", "接害因素", "职业病危害因素", "危害因素"],
    entryDate: ["入职时间", "入职日期", "参加工作时间"],
    examType: ["体检类别", "体检类型", "检查类别"],
    examStatus: ["体检状态", "检查状态", "体检结论"],
    exposureYear: ["接害工龄(年)", "接害工龄（年）", "接害工龄"],
    totalYear: ["总工龄(年)", "总工龄（年）", "总工龄"]
  };

  const EXAM_HEADER_ALIASES = {
    name: ["姓名", "员工姓名", "人员姓名"],
    idNumber: ["身份证号", "身份证号码", "证件号码"],
    examDate: ["检查日期", "体检日期", "报告日期", "检查时间"],
    organization: ["检查机构", "体检机构", "医疗机构", "报告出具机构"],
    examType: ["体检类别", "体检类型", "检查类别"],
    conclusion: ["检查结论", "体检结论", "结论", "检查结果"],
    advice: ["处理建议", "建议", "复查建议", "医学建议"],
    reviewDate: ["复查日期", "建议复查日期"],
    reportNo: ["报告编号", "体检编号", "检查编号"],
    items: ["检查项目", "体检项目", "检查内容"]
  };

  function compact(value) {
    return String(value == null ? "" : value).replace(/\s+/g, "").trim();
  }

  function unique(values) {
    return Array.from(new Set(values.map((value) => String(value == null ? "" : value).trim()).filter(Boolean)));
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function fileText(file) {
    const result = file && file.parseResult ? file.parseResult : {};
    if (result.text) return String(result.text);
    if (Array.isArray(result.pages)) return result.pages.map((page) => page && page.text || "").join("\n");
    return "";
  }

  function structuredFieldText(file) {
    const direct = fileText(file);
    if (direct) return direct;
    const sheets = file && file.parseResult && Array.isArray(file.parseResult.sheets) ? file.parseResult.sheets : [];
    return sheets.map((sheet) => {
      const rows = Array.isArray(sheet && sheet.rows) ? sheet.rows : [];
      return rows.map((row) => {
        const cells = Array.isArray(row) ? row : [];
        const label = String(cells[0] == null ? "" : cells[0]).trim();
        const value = String(cells[1] == null ? "" : cells[1]).trim();
        return label && value ? label + "：" + value : "";
      }).filter(Boolean).join("\n");
    }).filter(Boolean).join("\n");
  }

  function categoryFiles(files, category) {
    return files.filter((file) => file && file.category === category && file.parseStatus === "parsed" && file.reviewedAt);
  }

  function trimAtStop(value, stopLabels) {
    let output = String(value == null ? "" : value).trim();
    if (!output) return "";
    stopLabels.map(compact).filter(Boolean).forEach((label) => {
      const index = compact(output).indexOf(label);
      if (index > 0) output = output.slice(0, index);
    });
    return output.replace(/^[：:;；,，]+|[：:;；,，]+$/g, "").trim();
  }

  function isKnownLabel(value) {
    const normalized = compact(value).replace(/^[：:]+|[：:]+$/g, "");
    if (!normalized) return false;
    return COMPANY_KEYS.some((label) => normalized === compact(label) || normalized === compact(label) + "：");
  }

  function findField(text, labels, stopLabels = []) {
    const lines = String(text || "").split(/\r?\n/).map((line) => compact(line)).filter(Boolean);
    const compactLabels = labels.map(compact);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      for (const label of compactLabels) {
        const labelIndex = line.indexOf(label);
        if (labelIndex < 0) continue;
        let value = line.slice(labelIndex + label.length).replace(/^[：:]+/, "");
        if (value && !isKnownLabel(value)) return trimAtStop(value, stopLabels);
        for (let cursor = index + 1; cursor < Math.min(lines.length, index + 5); cursor += 1) {
          const candidate = lines[cursor];
          if (!candidate || isKnownLabel(candidate)) continue;
          return trimAtStop(candidate, stopLabels);
        }
      }
    }
    return "";
  }

  function extractScale(text, employeeCount) {
    const raw = findField(text, ["企业规模"], ["经济类型", "单位法人", "法定代表人", "职工总人数"]);
    const value = compact(raw);
    let selected = "";
    const checked = value.match(/(?:☑|■|√|✓)(大型|中型|小型|微型)/);
    if (checked) {
      selected = checked[1];
    } else {
      for (const size of ["大型", "中型", "小型", "微型"]) {
        const index = value.indexOf(size);
        if (index < 0) continue;
        const previous = value.slice(Math.max(0, index - 1), index);
        if (!/[□口]/.test(previous)) {
          selected = size;
          break;
        }
      }
    }
    if (!selected) {
      const direct = value.match(/(大型|中型|小型|微型)/);
      if (direct) selected = direct[1];
    }
    if (selected && employeeCount) return selected + " · " + employeeCount + " 人";
    if (selected) return selected;
    if (employeeCount) return employeeCount + " 人";
    return "";
  }

  function extractCompanyProfile(files) {
    const companyFiles = categoryFiles(files, "company");
    const text = companyFiles.map(structuredFieldText).filter(Boolean).join("\n");
    if (!text) return { profile: {}, warnings: [], sourceFileIds: [], mappedFields: [] };

    const employeeCountValue = findField(text, ["职工总人数", "员工总人数", "总人数"], ["女职工人数", "生产工人数", "接触有毒有害作业人数"]);
    const employeeCount = (employeeCountValue.match(/\d+/) || [])[0] || "";
    const exposedValue = findField(text, ["接触有毒有害作业人数", "接害人数", "接触职业病危害人数"], ["接触有毒有害作业女工人数", "生产工人数", "职工总人数"]);
    const exposedCount = (exposedValue.match(/\d+/) || [])[0] || "";
    const companyName = findField(text, ["单位名称", "企业名称", "用人单位"], ["通迅地址", "通讯地址", "注册地址", "住所", "地址", "邮编", "社会信用证代码", "统一社会信用代码"]);
    const creditValue = findField(text, ["社会信用证代码", "统一社会信用代码", "信用代码"], ["注册资金", "注册资本", "所属乡镇街道", "所属行业"]);
    const creditMatch = compact(creditValue + " " + text).match(/\b[0-9A-Z]{18}\b/i);
    const creditCode = creditMatch ? creditMatch[0].toUpperCase() : "";
    const address = findField(text, ["通迅地址", "通讯地址", "注册地址", "住所", "生产场所"], ["邮编", "社会信用证代码", "统一社会信用代码", "注册资金", "所属乡镇街道", "所属行业"]);
    const industry = findField(text, ["所属行业", "行业"], ["经济类型", "企业规模", "单位法人", "法定代表人"]);
    const legalRepresentative = findField(text, ["单位法人", "法定代表人"], ["体检联系人", "联系人", "单位法人电话", "联系电话"]);
    const contactName = findField(text, ["体检联系人", "联系人"], ["单位法人电话", "体检联系人电话", "联系电话"]);
    const contactPhone = findField(text, ["单位法人电话", "体检联系人电话", "联系电话"], ["职工总人数", "女职工人数", "生产工人数"]);
    const scale = extractScale(text, employeeCount);
    const yearMatch = String(text || "").match(/(?:^|\n)\s*(20\d{2})\s*年\s*(?=\r?\n|$)/);

    const profile = {
      companyName: companyName && companyName.length <= 80 ? companyName : "",
      creditCode,
      address: address && address.length <= 100 ? address : "",
      industry: industry && industry.length <= 40 ? industry : "",
      scale,
      employeeCount,
      exposedCount,
      legalRepresentative,
      contactName,
      contactPhone,
      year: yearMatch ? yearMatch[1] : ""
    };
    const mappedFields = ["companyName", "creditCode", "address", "industry", "scale", "employeeCount", "exposedCount", "legalRepresentative", "contactName", "contactPhone", "year"]
      .filter((key) => profile[key]);
    return { profile, warnings: [], sourceFileIds: companyFiles.map((file) => file.id), mappedFields };
  }

  function normalizeHeader(value) {
    return compact(value).replace(/[（(].*?[）)]/g, "");
  }

  function findHeaderIndex(headers, aliases) {
    return headers.findIndex((header) => {
      const normalized = normalizeHeader(header);
      return aliases.some((alias) => normalized.includes(normalizeHeader(alias)));
    });
  }

  function splitValues(value) {
    return unique(String(value || "").split(/[,，、;；/／|]+/).map((item) => item.trim()));
  }

  function extractEmployees(files) {
    const employeeFiles = categoryFiles(files, "employees");
    const employees = [];
    const fieldUnion = new Set();
    employeeFiles.forEach((file) => {
      const sheets = file.parseResult && Array.isArray(file.parseResult.sheets) ? file.parseResult.sheets : [];
      sheets.forEach((sheet) => {
        const rows = Array.isArray(sheet.rows) ? sheet.rows : [];
        const headerIndex = rows.findIndex((row) => {
          const cells = Array.isArray(row) ? row : [];
          const hasName = findHeaderIndex(cells, HEADER_ALIASES.name) >= 0;
          const hasIdentity = findHeaderIndex(cells, HEADER_ALIASES.idNumber) >= 0;
          const hasPosition = findHeaderIndex(cells, HEADER_ALIASES.position) >= 0;
          return hasName && (hasIdentity || hasPosition);
        });
        if (headerIndex < 0) return;
        const headers = rows[headerIndex].map(compact);
        const indexes = {};
        Object.keys(HEADER_ALIASES).forEach((key) => {
          indexes[key] = findHeaderIndex(headers, HEADER_ALIASES[key]);
        });
        rows.slice(headerIndex + 1).forEach((row) => {
          const cells = Array.isArray(row) ? row : [];
          const get = (key) => indexes[key] >= 0 ? String(cells[indexes[key]] == null ? "" : cells[indexes[key]]).trim() : "";
          const name = get("name");
          const gender = get("gender");
          if (!name || /姓名|注意|合计|总计/.test(name)) return;
          const idNumber = get("idNumber").toUpperCase();
          const position = get("position");
          const department = get("department");
          const hazards = splitValues(get("hazards"));
          const examType = get("examType");
          const examStatus = get("examStatus");
          const mappedFields = [];
          if (name) mappedFields.push("姓名");
          if (gender) mappedFields.push("性别");
          if (idNumber) mappedFields.push("身份证号");
          if (get("phone")) mappedFields.push("联系电话");
          if (position) mappedFields.push("岗位");
          if (department) mappedFields.push("部门");
          if (hazards.length) mappedFields.push("接害因素");
          if (examType) mappedFields.push("体检类别");
          if (examStatus) mappedFields.push("体检状态");
          if (get("entryDate")) mappedFields.push("入职时间");
          if (get("exposureYear")) mappedFields.push("接害工龄");
          mappedFields.forEach((field) => fieldUnion.add(field));
          employees.push({
            name,
            gender,
            idNumber,
            phone: get("phone"),
            position,
            department,
            hazards,
            entryDate: get("entryDate"),
            examType,
            examStatus,
            exposureYear: get("exposureYear"),
            totalYear: get("totalYear"),
            mappedFields,
            sourceFileId: file.id
          });
        });
      });
    });

    const seen = new Set();
    return {
      employees: employees.filter((employee) => {
        const key = employee.idNumber || compact(employee.name) + "|" + compact(employee.position);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
      mappedFields: Array.from(fieldUnion),
      sourceFileIds: employeeFiles.map((file) => file.id)
    };
  }

  function normalizeExamDate(value) {
    const raw = String(value || "").trim();
    const match = /(20\d{2})[年./-](\d{1,2})[月./-](\d{1,2})/.exec(raw);
    if (!match) return raw;
    return match[1] + "-" + String(match[2]).padStart(2, "0") + "-" + String(match[3]).padStart(2, "0");
  }

  function examTextValue(text, aliases) {
    const escaped = aliases.map(escapeRegExp).join("|");
    const pattern = new RegExp("(?:^|[\\n\\r])\\s*(?:" + escaped + ")\\s*[：:]\\s*([^\\n\\r]+)", "i");
    const match = pattern.exec(String(text || ""));
    if (!match) return "";
    return match[1].split(/\s{2,}/)[0].replace(/[；;]+$/, "").trim();
  }

  function examNameFromFile(fileName) {
    const base = String(fileName || "").replace(/\.[^.]+$/, "")
      .replace(/^(职业健康检查报告|职业健康体检报告|体检报告|健康检查报告)[-_—\s]*/i, "")
      .replace(/[-_—]?(个人|员工)?(体检|检查)报告$/i, "").trim();
    const match = /^[\u4e00-\u9fa5]{2,4}/.exec(base);
    return match ? match[0] : "";
  }

  function extractPhysicalExams(files) {
    const examFiles = categoryFiles(files, "exam");
    const exams = [];
    const addExam = (exam, file) => {
      if (!exam || (!exam.employeeName && !exam.idNumber)) return;
      const key = compact(exam.idNumber) + "|" + compact(exam.employeeName) + "|" + compact(exam.examDate);
      const existing = exams.find((item) => item.key === key);
      const normalized = Object.assign({
        employeeName: "",
        idNumber: "",
        examDate: "",
        organization: "",
        examType: "",
        conclusion: "",
        advice: "",
        reviewDate: "",
        reportNo: "",
        items: "",
        sourceFileId: file && file.id || ""
      }, exam, { key: key });
      normalized.examDate = normalizeExamDate(normalized.examDate);
      normalized.reviewDate = normalizeExamDate(normalized.reviewDate);
      if (!existing) exams.push(normalized);
      else Object.keys(normalized).forEach((field) => {
        if (!existing[field] && normalized[field]) existing[field] = normalized[field];
      });
    };

    examFiles.forEach((file) => {
      const result = file.parseResult || {};
      const sheets = Array.isArray(result.sheets) ? result.sheets : [];
      sheets.forEach((sheet) => {
        const rows = Array.isArray(sheet.rows) ? sheet.rows : [];
        const headerIndex = rows.findIndex((row) => {
          const headers = Array.isArray(row) ? row : [];
          return findHeaderIndex(headers, EXAM_HEADER_ALIASES.name) >= 0 &&
            (findHeaderIndex(headers, EXAM_HEADER_ALIASES.conclusion) >= 0 || findHeaderIndex(headers, EXAM_HEADER_ALIASES.examDate) >= 0);
        });
        if (headerIndex < 0) return;
        const headers = rows[headerIndex].map(compact);
        const indexes = {};
        Object.keys(EXAM_HEADER_ALIASES).forEach((key) => {
          indexes[key] = findHeaderIndex(headers, EXAM_HEADER_ALIASES[key]);
        });
        rows.slice(headerIndex + 1).forEach((row) => {
          const cells = Array.isArray(row) ? row : [];
          const get = (key) => indexes[key] >= 0 ? String(cells[indexes[key]] == null ? "" : cells[indexes[key]]).trim() : "";
          const employeeName = get("name");
          if (!employeeName || /姓名|合计|总计/.test(employeeName)) return;
          addExam({
            employeeName: employeeName,
            idNumber: get("idNumber").toUpperCase(),
            examDate: get("examDate"),
            organization: get("organization"),
            examType: get("examType"),
            conclusion: get("conclusion"),
            advice: get("advice"),
            reviewDate: get("reviewDate"),
            reportNo: get("reportNo"),
            items: get("items")
          }, file);
        });
      });

      const source = fileText(file);
      if (!source) return;
      const blocks = source.split(/(?=(?:^|[\n\r])\s*姓名\s*[：:])/).filter((block) => /姓名\s*[：:]/.test(block));
      (blocks.length ? blocks : [source]).forEach((block) => {
        addExam({
          employeeName: examTextValue(block, EXAM_HEADER_ALIASES.name) || examNameFromFile(file.name),
          idNumber: examTextValue(block, EXAM_HEADER_ALIASES.idNumber).toUpperCase(),
          examDate: examTextValue(block, EXAM_HEADER_ALIASES.examDate),
          organization: examTextValue(block, EXAM_HEADER_ALIASES.organization),
          examType: examTextValue(block, EXAM_HEADER_ALIASES.examType),
          conclusion: examTextValue(block, EXAM_HEADER_ALIASES.conclusion),
          advice: examTextValue(block, EXAM_HEADER_ALIASES.advice),
          reviewDate: examTextValue(block, EXAM_HEADER_ALIASES.reviewDate),
          reportNo: examTextValue(block, EXAM_HEADER_ALIASES.reportNo),
          items: examTextValue(block, EXAM_HEADER_ALIASES.items)
        }, file);
      });
    });

    return {
      exams: exams.map((exam) => Object.assign({}, exam, { key: undefined })),
      sourceFileIds: examFiles.map((file) => file.id),
      mappedFields: exams.length ? ["体检日期", "检查机构", "检查结论", "处理建议"] : []
    };
  }

  function attachPhysicalExams(employees, exams) {
    return employees.map((employee) => {
      const idNumber = compact(employee.idNumber).toUpperCase();
      const name = compact(employee.name);
      const exam = exams.find((item) => {
        if (idNumber && compact(item.idNumber).toUpperCase() === idNumber) return true;
        return Boolean(name) && compact(item.employeeName) === name;
      });
      if (!exam) return Object.assign({}, employee, { physicalExam: null, examStatus: employee.examStatus || "待补充" });
      return Object.assign({}, employee, {
        gender: employee.gender || exam.gender || "",
        physicalExam: exam,
        examDate: exam.examDate,
        examOrganization: exam.organization,
        examConclusion: exam.conclusion,
        examAdvice: exam.advice,
        examStatus: employee.examStatus || exam.conclusion || "已取得体检报告"
      });
    });
  }

  function cleanPointDetail(value) {
    return String(value || "")
      .replace(/&+\d*/g, "")
      .replace(/(?:生产)?车间\d*/g, "")
      .replace(/\d+(?=动工具)/g, "")
      .replace(/^[，,、;；:：\s]+|[，,、;；:：\s]+$/g, "")
      .trim();
  }

  function extractLocationName(value) {
    const source = String(value || "").replace(/\d/g, "");
    const match = source.match(/(?:生产|整机|装配|加工|包装|焊接|喷涂|打磨|冲压|质检|仓储|办公|辅助|公用)[\u4e00-\u9fa5A-Za-z]{0,12}?(?:区|车间|工位|场所)$/);
    return match ? match[0] : "";
  }

  function extractPointNames(text) {
    const source = compact(text);
    const names = [];
    const pattern = /([\u4e00-\u9fa5A-Za-z0-9]{0,24})[（(]([^）)]{2,24})[）)]/g;
    let match;
    while ((match = pattern.exec(source))) {
      const location = extractLocationName(match[1]);
      const detail = cleanPointDetail(match[2]);
      if (!location || !detail) continue;
      if (/检测|报告|标准|样品|评价|仪器|类型名称|设置地点|模板|检测项目|标准值/.test(location + detail)) continue;
      if (/^[A-Za-z]{1,5}$/.test(detail)) continue;
      names.push(location + "（" + detail + "）");
    }
    return unique(names);
  }

  function normalizeOcrNumber(value) {
    return String(value || "").replace(/[，、]/g, ".").replace(/[^\d.]/g, "");
  }

  function extractDetectionReport(files) {
    const reportFiles = categoryFiles(files, "positions");
    const pointMap = new Map();
    const sourceHazards = new Set();
    const sourceTexts = [];
    let reportDate = "";
    let reportNo = "";
    let riskLevel = "";
    let companyName = "";

    const addPoint = (point) => {
      const key = compact(point.name + "|" + point.hazard);
      const existing = pointMap.get(key);
      if (!existing) {
        pointMap.set(key, point);
        return;
      }
      ["result", "standard", "judgement", "reportDate"].forEach((field) => {
        if (!existing[field] && point[field]) existing[field] = point[field];
      });
    };

    reportFiles.forEach((file) => {
      const result = file.parseResult || {};
      const ocr = result.ocrFields || null;
      const structuredReport = ocr && ocr.report ? ocr.report : null;
      if (structuredReport) {
        reportNo = reportNo || structuredReport.reportNumber || structuredReport.taskNumber || "";
        reportDate = reportDate || structuredReport.reportDate || structuredReport.onsiteInspectionDate || "";
        riskLevel = riskLevel || structuredReport.occupationalDiseaseRiskCategory || "";
        companyName = companyName || structuredReport.employerNameOnReport || "";
        (structuredReport.hazards || []).forEach((hazard) => sourceHazards.add(hazard));
        const pointName = [structuredReport.workplace, structuredReport.position].filter(Boolean).join(" · ") || structuredReport.position || "检测结果";
        (ocr.results || []).forEach((item) => {
          if (!item || !item.factor) return;
          const numeric = item.result == null ? "" : String(item.result);
          const limit = item.standard == null ? "" : String(item.standard);
          addPoint({
            name: pointName + "（" + (item.metric || item.factor) + "）",
            hazard: item.factor,
            result: numeric ? numeric + " " + (item.unit || "") : "",
            standard: limit ? limit + " " + (item.unit || "") : "",
            judgement: item.judgement || "",
            reportDate: "",
            sourceFileId: file.id
          });
        });
        if (result.text) sourceTexts.push(compact(result.text));
      }
      const pages = Array.isArray(result.pages)
        ? result.pages
        : [{ page: 1, text: fileText(file) }];
      pages.forEach((page) => {
        const text = String(page && page.text || "");
        const source = compact(text);
        if (!source) return;
        sourceTexts.push(source);

        HAZARD_TERMS.forEach((hazard) => {
          if (source.includes(hazard)) sourceHazards.add(hazard);
        });
        if (!reportNo) {
          const numberMatch = source.match(/(?:检测任务编号|报告编号)[：:]?(\d{6,})/);
          if (numberMatch) reportNo = numberMatch[1];
        }
        if (!reportDate) {
          const dateMatch = source.match(/20\d{2}[.．年-]\d{1,2}[.．月-]\d{1,2}/);
          if (dateMatch) {
            reportDate = dateMatch[0]
              .replace(/[年月]/g, "-")
              .replace(/日/g, "")
              .replace(/[.．]/g, "-");
          }
        }
        if (!riskLevel && source.includes("风险分类")) {
          const riskMatch = source.match(/风险分类(?:为)?[“"]?(严重|较重|一般)/);
          if (riskMatch) riskLevel = riskMatch[1];
        }
        if (!companyName) {
          const companyMatch = source.match(/用人单位[：:]?([\u4e00-\u9fa5]{2,50}?)(?=检测类别|检测项目|检测范围)/);
          if (companyMatch) companyName = companyMatch[1];
        }

        const pageHazards = HAZARD_TERMS.filter((hazard) => {
          if (!source.includes(hazard)) return false;
          if (/检测项目[：:]/.test(source)) return new RegExp("检测项目[：:]?[^。；]{0,16}" + escapeRegExp(hazard)).test(source);
          return new RegExp(escapeRegExp(hazard) + "(?:测量)?结果|结果.*" + escapeRegExp(hazard)).test(source);
        });
        const names = extractPointNames(text);
        names.forEach((name) => {
          pageHazards.forEach((hazard) => {
            let resultValue = "";
            let standardValue = "";
            if (hazard === "照度") {
              const averageMatch = source.match(/平均值(?:\(lx\))?([\d.]+)/i);
              const standardMatch = source.match(/标准值(?:\(lx\))?(\d{1,3})(?=\d{6}|[^\d]|$)/i);
              resultValue = averageMatch ? normalizeOcrNumber(averageMatch[1]) + " lx" : "";
              standardValue = standardMatch ? normalizeOcrNumber(standardMatch[1]) + " lx" : "";
            } else if (hazard === "噪声") {
              const leqMatch = source.match(/LEX[.,]?8h[^\d]{0,8}(\d{2,3}(?:[.,\uFF0C\u3001]\d)?)(?=\d{6,}|[^\d]|$)/i);
              const standardMatch = source.match(/接触限值\[dB\(A\)\](\d{2,3})(?=\d{2,3}(?:[^\d]|$)|[^\d]|$)/i);
              resultValue = leqMatch ? normalizeOcrNumber(leqMatch[1]) + " dB(A)" : "";
              standardValue = standardMatch ? normalizeOcrNumber(standardMatch[1]) + " dB(A)" : "";
            }
            addPoint({
              name,
              hazard,
              result: resultValue,
              standard: standardValue,
              judgement: /判定结果合格|结果合格/.test(source) ? "合格" : "",
              reportDate: "",
              sourceFileId: file.id
            });
          });
        });
      });
    });

    const joinedSource = sourceTexts.join("");
    const reportPositionMatch = joinedSource.match(/岗位[\/／]工种采样[（(]测量[）)]点([\u4e00-\u9fa5]{2,12}?)(?=整机|生产|车间|采样|$)/);
    const workplaceMatch = joinedSource.match(/生产车间(\d{1,2})(?=生产车间|接触时间|岗位|$)/);
    const areaMatch = joinedSource.match(/(整机部装|部装)区/);
    let workplace = joinedSource.includes("\u751F\u4EA7\u8F66\u95F4") ? "\u751F\u4EA7\u8F66\u95F4" : "";
    if (workplace && areaMatch) workplace += " · " + areaMatch[1];
    const points = Array.from(pointMap.values())
      .map((point) => Object.assign({}, point, { reportDate }))
      .sort((left, right) => {
        const hazardOrder = { "噪声": 0, "照度": 1 };
        return (hazardOrder[left.hazard] || 9) - (hazardOrder[right.hazard] || 9) || left.name.localeCompare(right.name, "zh-CN");
      });
    const ocrReportFile = reportFiles.find((file) => file.parseResult && file.parseResult.ocrFields && file.parseResult.ocrFields.report);
    const structuredReport = ocrReportFile && ocrReportFile.parseResult.ocrFields.report || null;
    return {
      hazards: Array.from(sourceHazards),
      points,
      reportDate,
      reportNo,
      riskLevel,
      positionName: structuredReport && structuredReport.position || (reportPositionMatch ? reportPositionMatch[1] : ""),
      workplace: structuredReport && structuredReport.workplace || workplace,
      companyName: structuredReport && structuredReport.employerNameOnReport || companyName,
      inspectionPoints: structuredReport && ocrReportFile.parseResult.ocrFields.qualitySummary ? Number(ocrReportFile.parseResult.ocrFields.qualitySummary.inspectionPoints || 0) : points.length,
      testingOrganization: structuredReport && structuredReport.testingOrganization || "",
      onsiteInspectionDate: structuredReport && structuredReport.onsiteInspectionDate || "",
      sourceFileIds: reportFiles.map((file) => file.id)
    };
  }

  function riskLabel(riskLevel) {
    if (riskLevel === "严重") return "高风险";
    if (riskLevel === "较重") return "中风险";
    if (riskLevel === "一般") return "低风险";
    return "待评估";
  }

  function derivePositions(employees, report) {
    const map = new Map();
    const add = (name, department, hazards, reportMatched) => {
      const normalized = compact(name);
      if (!normalized) return;
      const existing = map.get(normalized) || { name, department: "", hazards: [], reportMatched: false };
      if (!existing.department && department) existing.department = department;
      existing.hazards = unique(existing.hazards.concat(hazards || []));
      existing.reportMatched = existing.reportMatched || Boolean(reportMatched);
      map.set(normalized, existing);
    };
    employees.forEach((employee) => add(employee.position, employee.department, employee.hazards, false));
    if (report.positionName) add(report.positionName, report.workplace, report.hazards, true);
    return Array.from(map.values()).map((position) => {
      const related = employees.filter((employee) => compact(employee.position) === compact(position.name));
      const risk = position.reportMatched ? riskLabel(report.riskLevel) : "待评估";
      const checks = [
        Boolean(position.name),
        Boolean(position.department),
        position.hazards.length > 0,
        risk !== "待评估",
        related.length > 0
      ];
      return {
        name: position.name,
        department: position.department || "资料未提供",
        hazards: position.hazards,
        riskLevel: risk,
        relatedCount: related.length,
        completeness: Math.round(checks.filter(Boolean).length / checks.length * 100),
        documents: position.reportMatched ? Math.max(Number(report.inspectionPoints || 0), report.points.length) + " 项检测" : "待生成",
        detectionPointCount: position.reportMatched ? Math.max(Number(report.inspectionPoints || 0), report.points.length) : 0,
        reportDate: position.reportMatched ? report.reportDate : "",
        reportNo: position.reportMatched ? report.reportNo : "",
        workplace: position.reportMatched ? report.workplace : position.department,
        sourceFileIds: position.reportMatched ? report.sourceFileIds : [],
        source: position.reportMatched ? "检测报告" : "员工名册"
      };
    });
  }

  function extractSystems(files) {
    const systemFiles = categoryFiles(files, "systems");
    return systemFiles.map((file) => ({
      name: file.name,
      reviewed: Boolean(file.reviewedAt),
      sourceFileId: file.id
    }));
  }

  function build(company) {
    const files = company && Array.isArray(company.libraryFiles)
      ? company.libraryFiles.filter((file) => file && file.parseStatus === "parsed" && file.reviewedAt)
      : [];
    const companyResult = extractCompanyProfile(files);
    const employeeResult = extractEmployees(files);
    const reportResult = extractDetectionReport(files);
    const examResult = extractPhysicalExams(files);
    const employees = attachPhysicalExams(employeeResult.employees, examResult.exams);
    const positions = derivePositions(employees, reportResult);
    const systems = extractSystems(files);
    const mappedCategories = [];
    if (companyResult.mappedFields.length) mappedCategories.push("company");
    if (positions.length || reportResult.points.length || reportResult.hazards.length) mappedCategories.push("positions");
    if (employeeResult.employees.length) mappedCategories.push("employees");
    if (examResult.exams.length) mappedCategories.push("exam");
    if (systems.length) mappedCategories.push("systems");
    const sourceFileIds = unique(companyResult.sourceFileIds
      .concat(employeeResult.sourceFileIds)
      .concat(reportResult.sourceFileIds)
      .concat(examResult.sourceFileIds)
      .concat(systems.map((item) => item.sourceFileId)));
    const mappedItemCount = companyResult.mappedFields.length + employees.length + positions.length + reportResult.points.length + examResult.exams.length + systems.length;
    const warnings = [];
    if (companyResult.profile.companyName && reportResult.companyName && companyResult.profile.companyName !== reportResult.companyName) {
      warnings.push({
        code: "company-name-mismatch",
        title: "企业名称存在差异",
        message: "企业信息表为“" + companyResult.profile.companyName + "”，检测报告为“" + reportResult.companyName + "”，已保留原文，需人工确认。"
      });
    }
    return {
      version: 1,
      mappedAt: new Date().toISOString(),
      profile: Object.assign({}, companyResult.profile, company && company.profileOverrides || {}),
      profileFields: companyResult.mappedFields,
      employees: employees,
      employeeFields: employeeResult.mappedFields,
      positions,
      detectionPoints: reportResult.points,
      report: reportResult,
      exams: examResult.exams,
      systems,
      mappedCategories: unique(mappedCategories),
      sourceFileIds,
      mappedItemCount,
      warnings
    };
  }

  window.EnterpriseMapper = { build };
})();
