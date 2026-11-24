(() => {
  "use strict";

  const REQUIRED = ["company", "employees", "positions"];
  const definitions = [
    {
      id: "hazard-notice", name: "职业病危害告知书", shortName: "危害告知书", scope: "employee",
      version: "2.4", templateCode: "ZD-GZ-001", iconTone: "blue", iconLetter: "告",
      requiredCategories: REQUIRED, scopeLabel: "人员级", cycleLabel: "每员工 1 份"
    },
    {
      id: "hazard-card", name: "职业病危害告知卡", shortName: "危害告知卡", scope: "position",
      version: "1.3", templateCode: "ZD-GZ-007", iconTone: "red", iconLetter: "卡",
      requiredCategories: REQUIRED, scopeLabel: "岗位级", cycleLabel: "每岗位 1 份"
    },
    {
      id: "operating-procedure", name: "岗位职业卫生操作规程", shortName: "操作规程", scope: "position",
      version: "1.2", templateCode: "ZD-CZ-008", iconTone: "indigo", iconLetter: "规",
      requiredCategories: REQUIRED, scopeLabel: "岗位级", cycleLabel: "每岗位 1 份"
    },
    {
      id: "ppe-plan", name: "劳动防护用品发放计划", shortName: "防护用品计划", scope: "position",
      version: "2.0", templateCode: "ZD-LD-004", iconTone: "green", iconLetter: "护",
      requiredCategories: REQUIRED, scopeLabel: "岗位级", cycleLabel: "每岗位 1 份"
    },
    {
      id: "facility-maintenance", name: "职业病防护设施维护记录", shortName: "设施维护记录", scope: "enterprise",
      version: "1.6", templateCode: "ZD-FH-002", iconTone: "indigo", iconLetter: "维",
      requiredCategories: REQUIRED, scopeLabel: "企业级", cycleLabel: "每企业 1 份"
    },
    {
      id: "emergency-plan", name: "职业病危害事故应急预案", shortName: "应急预案", scope: "enterprise",
      version: "1.8", templateCode: "ZD-YJ-003", iconTone: "red", iconLetter: "急",
      requiredCategories: REQUIRED, scopeLabel: "企业级", cycleLabel: "每企业 1 份"
    },
    {
      id: "management-system", name: "职业卫生管理制度汇编", shortName: "制度汇编", scope: "enterprise",
      version: "2.1", templateCode: "ZD-ZD-009", iconTone: "green", iconLetter: "制",
      requiredCategories: REQUIRED, scopeLabel: "企业级", cycleLabel: "每企业 1 份"
    },
    {
      id: "management-organization", name: "职业卫生管理机构成立文件", shortName: "管理机构", scope: "enterprise",
      version: "1.1", templateCode: "ZD-JG-010", iconTone: "blue", iconLetter: "机",
      requiredCategories: REQUIRED, scopeLabel: "企业级", cycleLabel: "每企业 1 份"
    },
    {
      id: "annual-prevention-plan", name: "年度职业病防治计划与实施方案", shortName: "年度防治计划", scope: "enterprise",
      version: "1.4", templateCode: "ZD-JH-011", iconTone: "amber", iconLetter: "计",
      requiredCategories: REQUIRED, scopeLabel: "企业级", cycleLabel: "每企业 1 份"
    },
    {
      id: "annual-assessment", name: "年度职业病危害评估报告", shortName: "年度评估报告", scope: "enterprise",
      version: "3.0", templateCode: "ZD-PG-006", iconTone: "slate", iconLetter: "评",
      requiredCategories: REQUIRED, scopeLabel: "企业级", cycleLabel: "每企业 1 份"
    },
    {
      id: "training-plan", name: "职业健康教育培训计划", shortName: "培训计划", scope: "enterprise",
      version: "1.2", templateCode: "ZD-PX-012", iconTone: "indigo", iconLetter: "训",
      requiredCategories: REQUIRED, scopeLabel: "企业级", cycleLabel: "每企业 1 份"
    },
    {
      id: "training-record", name: "职业健康培训记录", shortName: "培训记录", scope: "enterprise",
      version: "1.2", templateCode: "ZD-PX-013", iconTone: "green", iconLetter: "录",
      requiredCategories: REQUIRED, scopeLabel: "企业级", cycleLabel: "每企业 1 份"
    },
    {
      id: "health-record", name: "员工职业健康监护档案", shortName: "监护档案", scope: "employee",
      version: "2.3", templateCode: "ZD-JK-005", iconTone: "amber", iconLetter: "档",
      requiredCategories: REQUIRED, scopeLabel: "人员级", cycleLabel: "每员工 1 份"
    }
  ];

  function text(value, fallback = "资料未提供") {
    const result = String(value == null ? "" : value).trim();
    return result || fallback;
  }

  function list(values, fallback = "资料未提供") {
    const result = (Array.isArray(values) ? values : []).map((item) => text(item, "")).filter(Boolean);
    return result.length ? Array.from(new Set(result)).join("、") : fallback;
  }

  function compact(value) {
    return String(value == null ? "" : value).replace(/\s+/g, "").trim();
  }

  function contextProfile(context) {
    return context && context.profile || context && context.mapping && context.mapping.profile || {};
  }

  function contextEmployees(context) {
    return context && Array.isArray(context.employees) ? context.employees : [];
  }

  function contextPositions(context) {
    return context && Array.isArray(context.positions) ? context.positions : [];
  }

  function contextPoints(context) {
    return context && Array.isArray(context.detectionPoints) ? context.detectionPoints : [];
  }

  function contextExams(context) {
    return context && Array.isArray(context.exams) ? context.exams : [];
  }

  function buildTargets(definition, context) {
    if (!definition || !context) return [];
    const company = context.company || {};
    const profile = contextProfile(context);
    const companyName = text(profile.companyName || company.name, "当前企业");
    if (definition.scope === "enterprise") {
      return [{
        targetType: "enterprise",
        targetId: String(company.code || "enterprise"),
        targetName: companyName,
        documentName: definition.name,
        scopeText: companyName
      }];
    }
    if (definition.scope === "position") {
      return contextPositions(context).map((position, index) => {
        const positionName = text(position && position.name, "岗位 " + (index + 1));
        const department = text(position && position.department, "部门未提供");
        return {
          targetType: "position",
          targetId: String(position && (position.id || position.name) || "position-" + index),
          targetName: positionName,
          position: position,
          documentName: positionName + " - " + definition.name,
          scopeText: positionName + " · " + department
        };
      });
    }
    if (definition.scope === "employee") {
      return contextEmployees(context).map((employee, index) => {
        const employeeName = text(employee && employee.name, "员工 " + (index + 1));
        return {
          targetType: "employee",
          targetId: String(employee && (employee.idNumber || employee.name) || "employee-" + index),
          targetName: employeeName,
          employee: employee,
          documentName: employeeName + " - " + definition.name,
          scopeText: employeeName + " · " + text(employee && employee.position, "岗位未提供")
        };
      });
    }
    return [];
  }

  function findPosition(context, employee) {
    const positionName = compact(employee && employee.position);
    if (!positionName) return {};
    return contextPositions(context).find((position) => compact(position && position.name) === positionName) || {};
  }

  function pointsForPosition(context, position) {
    const points = contextPoints(context);
    const positionName = text(position && position.name, "");
    const hazards = Array.isArray(position && position.hazards) ? position.hazards : [];
    const exact = points.filter((point) => String(point && point.name || "").includes(positionName));
    const byHazard = points.filter((point) => hazards.includes(point && point.hazard));
    return Array.from(new Set(exact.concat(byHazard)));
  }

  function pointsForEmployee(context, employee) {
    const position = findPosition(context, employee);
    const hazards = Array.from(new Set((employee && employee.hazards || []).concat(position.hazards || [])));
    const points = pointsForPosition(context, position);
    return Array.from(new Set(points.concat(contextPoints(context).filter((point) => hazards.includes(point && point.hazard)))));
  }

  function detectionLines(context, position) {
    const points = pointsForPosition(context, position);
    if (!points.length) return ["未匹配到该岗位的专项检测结果，正式使用前应补充现场检测或现状评价依据。"];
    return points.map((point, index) => {
      return (index + 1) + ". " + text(point.name, "检测点位") + "：" + text(point.hazard, "危害因素") +
        "检测结果 " + text(point.result, "未提供") + "，职业接触限值 " + text(point.standard, "未提供") +
        "，判定 " + text(point.judgement, "待确认") + "。";
    });
  }

  function positionEmployees(context, position) {
    const positionName = text(position && position.name, "");
    return contextEmployees(context).filter((employee) => text(employee && employee.position, "") === positionName);
  }

  function ppeForHazards(hazards) {
    const source = Array.isArray(hazards) ? hazards : [];
    const result = [];
    source.forEach((hazard) => {
      if (/噪声/.test(hazard)) result.push("耳塞或耳罩");
      else if (/粉尘|烟尘|矽尘|煤尘/.test(hazard)) result.push("符合要求的防尘口罩");
      else if (/苯|甲醛|甲苯|二甲苯|氨|硫化氢|一氧化碳|化合物/.test(hazard)) result.push("对应滤毒盒的防毒面具");
      else if (/高温/.test(hazard)) result.push("隔热服、防高温手套");
      else if (/振动/.test(hazard)) result.push("防振手套");
      else if (/紫外|辐射/.test(hazard)) result.push("防护眼镜或辐射防护用品");
      else if (/照度/.test(hazard)) result.push("岗位照明改善及必要的眼部防护");
      else result.push(hazard + "专项防护用品");
    });
    return result.length ? Array.from(new Set(result)) : ["按岗位危害因素识别结果补充防护用品"];
  }

  function examForEmployee(context, employee) {
    const idNumber = compact(employee && employee.idNumber).toUpperCase();
    const name = compact(employee && employee.name);
    return contextExams(context).find((exam) => {
      if (idNumber && compact(exam && exam.idNumber).toUpperCase() === idNumber) return true;
      return Boolean(name) && compact(exam && (exam.employeeName || exam.name)) === name;
    }) || null;
  }

  function examResultLines(context, employee) {
    const exam = employee && employee.physicalExam || examForEmployee(context, employee);
    if (!exam) {
      return [
        "检查日期：________________    检查机构：________________",
        "检查项目：________________    检查结论：待补充",
        "处理建议：________________    复查日期：________________",
        "说明：当前企业未提供可用的体检报告，本档案不编造检查结论。"
      ];
    }
    const items = Array.isArray(exam.items) ? exam.items.filter(Boolean).join("；") : text(exam.items, "详见体检报告");
    return [
      "检查日期：" + text(exam.examDate) + "    检查机构：" + text(exam.organization),
      "体检类别：" + text(exam.examType) + "    报告编号：" + text(exam.reportNo, "未提供"),
      "检查项目：" + items,
      "检查结论：" + text(exam.conclusion, "待确认"),
      "处理建议：" + text(exam.advice, "无/待确认") + "    复查日期：" + text(exam.reviewDate, "无/待确认")
    ];
  }

  function commonHeader(context) {
    const company = context.company || {};
    const profile = contextProfile(context);
    const year = text(profile.year, String(new Date().getFullYear()));
    return [
      text(profile.companyName || company.name, "当前企业"),
      "统一社会信用代码：" + text(profile.creditCode, "资料未提供"),
      "注册 / 通讯地址：" + text(profile.address, "资料未提供"),
      "法定代表人：" + text(profile.legalRepresentative, "资料未提供") + "    职业健康联系人：" + text(profile.contactName, "资料未提供") + "    联系电话：" + text(profile.contactPhone || profile.phone, "资料未提供"),
      "编制年度：" + year + " 年"
    ];
  }

  function enterpriseOverview(context) {
    const profile = contextProfile(context);
    const employees = contextEmployees(context);
    const positions = contextPositions(context);
    const points = contextPoints(context);
    return [
      "职工总人数：" + text(profile.employeeCount, employees.length ? String(employees.length) : "资料未提供") + " 人",
      "接触职业病危害人数：" + text(profile.exposedCount, employees.length ? String(employees.length) : "资料未提供") + " 人",
      "已识别岗位：" + positions.length + " 个",
      "已识别检测点位 / 结果：" + points.length + " 条",
      "已归集体检报告：" + contextExams(context).length + " 份",
      "主要职业病危害因素：" + list(Array.from(new Set(positions.flatMap((position) => position.hazards || []).concat(points.map((point) => point.hazard)))))
    ];
  }

  function noticeBody(context, target) {
    const employee = target.employee || {};
    const position = findPosition(context, employee) || target.position || {};
    const hazards = Array.from(new Set((employee.hazards || []).concat(position.hazards || [])));
    return [
      "职业病危害告知书",
      "",
      ...commonHeader(context),
      "",
      "编号：________________",
      "",
      "劳动者姓名：" + text(employee.name) + "    身份证号：" + text(employee.idNumber) + "    联系电话：" + text(employee.phone, "资料未提供"),
      "所在部门：" + text(employee.department || position.department) + "    岗位：" + text(employee.position || position.name),
      "",
      "根据《中华人民共和国职业病防治法》等规定，现将本岗位存在的职业病危害因素、接触限值及防护要求告知如下：",
      "",
      "一、岗位职业病危害因素",
      hazards.length ? hazards.map((hazard, index) => (index + 1) + ". " + hazard).join("\n") : "尚未识别，请在正式使用前补充岗位危害因素识别。",
      "",
      "二、检测结果与接触限值",
      ...detectionLines(context, position),
      "",
      "三、职业健康检查结果",
      ...examResultLines(context, employee),
      "",
      "四、职业病防护要求",
      "1. 上岗前、在岗期间和离岗时按要求参加职业健康检查，不得隐瞒职业史和健康状况。",
      "2. 正确佩戴并使用与岗位危害因素相适应的个人防护用品，不得擅自拆除职业病防护设施。",
      "3. 参加职业卫生培训，掌握危害因素、防护措施和事故应急处置方法。",
      "4. 发现职业病防护设施异常或身体不适，应立即报告职业健康管理人员。",
      "",
      "五、拟配备劳动防护用品",
      ppeForHazards(hazards).join("、") + "。",
      "",
      "六、告知与签收",
      "劳动者已知悉本岗位职业病危害因素、检测结果、职业健康检查结果及防护要求。",
      "劳动者签字：______________    日期：______年__月__日",
      "企业告知人签字：______________    日期：______年__月__日"
    ].join("\n");
  }

  function maintenanceBody(context) {
    const points = contextPoints(context);
    const positions = contextPositions(context);
    const rows = positions.length ? positions : [{ name: "全厂共用设施", department: "生产区域", hazards: [] }];
    const facilityText = rows.map((position, index) => {
      const related = points.filter((point) => (position.hazards || []).includes(point.hazard) || String(point.name || "").includes(position.name));
      return (index + 1) + ". " + text(position.name) + "（" + text(position.department, "区域未提供") + "）：涉及 " +
        (related.length ? related.map((point) => text(point.name) + "/" + text(point.hazard)).join("、") : list(position.hazards, "通用防护设施")) +
        "；检查频次：每月一次；异常处置：停机、隔离并记录整改。";
    }).join("\n");
    return [
      "职业病防护设施维护记录",
      "",
      ...commonHeader(context),
      "",
      "一、设施台账与维护范围",
      facilityText,
      "",
      "二、维护检查项目",
      "1. 通风、排毒、除尘、降噪、隔声、照明等设施是否完整并正常运行。",
      "2. 设施风量、风速、过滤材料、管道连接及控制开关是否处于有效状态。",
      "3. 防护设施是否擅自拆除、停用或改变用途，检修期间是否采取临时防护措施。",
      "4. 维护、检修、更换滤材和故障处理是否形成记录并由责任人签字。",
      "",
      "三、维护记录表",
      "日期 | 设施名称 / 位置 | 检查结果 | 处理措施 | 检查人 | 复核人",
      "____年__月__日 |  | □正常 □异常 |  |  | ",
      "____年__月__日 |  | □正常 □异常 |  |  | ",
      "____年__月__日 |  | □正常 □异常 |  |  | ",
      "",
      "四、异常整改闭环",
      "发现设施失效时，应立即停止相关作业、设置警示并安排维修；整改完成后进行复测，复测合格后方可恢复生产。",
      "",
      "编制人：______________    审核人：______________    批准人：______________"
    ].join("\n");
  }

  function emergencyBody(context) {
    const profile = contextProfile(context);
    const positions = contextPositions(context);
    const points = contextPoints(context);
    const report = context.report || {};
    return [
      "职业病危害事故应急预案",
      "",
      ...commonHeader(context),
      "",
      "一、适用范围",
      "本预案适用于" + text(profile.companyName || context.company && context.company.name) + "生产经营场所内可能发生的急性职业中毒、尘肺暴发风险、高温中暑、噪声伤害及其他职业病危害事故的预防、预警、响应和处置。",
      "",
      "二、职业病危害风险",
      enterpriseOverview(context),
      "检测报告编号：" + text(report.reportNo) + "；检测机构：" + text(report.testingOrganization) + "；风险分类：" + text(report.riskLevel) + "；检测日期：" + text(report.reportDate) + "。",
      "重点岗位：" + (positions.length ? positions.map((position) => text(position.name) + "（" + list(position.hazards, "危害待识别") + "）").join("；") : "待补充岗位识别结果"),
      "",
      "三、应急组织与职责",
      "1. 应急指挥部：由企业主要负责人担任总指挥，负责启动预案、资源调配和对外报告。",
      "2. 现场处置组：负责切断危害源、通风排毒、人员疏散和现场警戒。",
      "3. 医疗救护组：负责现场急救、联系医疗机构并陪同就诊。",
      "4. 后勤保障组：负责防护用品、急救药品、通讯和车辆保障。",
      "5. 信息联络组：负责事故记录、内部报告和按规定向监管部门报告。",
      "",
      "四、响应程序",
      "1. 发现人员出现中毒、窒息、中暑或其他急性健康损害时，立即呼救并停止相关作业。",
      "2. 救援人员必须首先做好自身防护，严禁无防护进入受限空间或高浓度危害区域。",
      "3. 将患者转移至通风安全区域，保持呼吸道通畅，必要时实施心肺复苏并拨打 120。",
      "4. 保护事故现场，封存可能涉及的原料、设备、通风设施和检测记录。",
      "5. 配合医疗机构、监管部门开展调查，按要求提交事故报告和整改方案。",
      "",
      "五、重点岗位处置提示",
      points.length ? points.map((point, index) => (index + 1) + ". " + text(point.name) + "：" + text(point.hazard) + "，检测结果 " + text(point.result) + "，处置时优先控制危害源并佩戴对应防护用品。").join("\n") : "待补充检测点位后完善岗位处置卡。",
      "",
      "六、应急物资",
      "急救箱、担架、洗眼器（如适用）、应急照明、警戒带、通讯设备、正压式呼吸器或符合危害因素的呼吸防护用品、应急车辆。",
      "",
      "七、预案管理",
      "每年至少组织一次演练，演练后评估预案有效性；工艺、设备、原辅材料或岗位危害发生重大变化时及时修订。",
      "",
      "编制人：______________    审核人：______________    批准人：______________"
    ].join("\n");
  }

  function ppeBody(context, target) {
    const position = target.position || {};
    const hazards = Array.isArray(position.hazards) ? position.hazards : [];
    const employees = positionEmployees(context, position);
    return [
      "劳动防护用品发放计划",
      "",
      ...commonHeader(context),
      "",
      "一、适用岗位",
      "岗位名称：" + text(position.name) + "    所属部门：" + text(position.department) + "    涉及人数：" + employees.length + " 人",
      "职业病危害因素：" + list(hazards, "待识别"),
      "",
      "二、配备计划",
      "防护用品名称：" + ppeForHazards(hazards).join("、"),
      "选用要求：应符合国家标准或行业标准，并与岗位危害因素、作业方式和接触水平相适应。",
      "发放频次：按产品有效期、损耗情况和实际接触情况及时更换；至少每季度检查一次库存和发放记录。",
      "培训要求：发放时开展佩戴方法、气密性检查、清洁保养和报废条件培训。",
      "",
      "三、发放对象",
      employees.length ? employees.map((employee, index) => (index + 1) + ". " + text(employee.name) + "（" + text(employee.position) + "）").join("\n") : "按岗位实际在岗人员登记发放。",
      "",
      "四、发放记录",
      "日期 | 姓名 | 防护用品 | 数量 | 领用人签字 | 发放人",
      "____年__月__日 |  |  |  |  | ",
      "____年__月__日 |  |  |  |  | ",
      "____年__月__日 |  |  |  |  | ",
      "",
      "五、检查与更换",
      "班组长每日检查佩戴情况；职业健康管理人员每月抽查防护用品有效性；出现破损、污染、失效或呼吸阻力明显增加时立即更换。",
      "",
      "编制人：______________    审核人：______________    批准人：______________"
    ].join("\n");
  }

  function healthRecordBody(context, target) {
    const employee = target.employee || {};
    const position = findPosition(context, employee);
    const points = pointsForEmployee(context, employee);
    return [
      "员工职业健康监护档案",
      "",
      ...commonHeader(context),
      "",
      "一、人员基本信息",
      "姓名：" + text(employee.name) + "    性别：" + text(employee.gender) + "    身份证号：" + text(employee.idNumber),
      "部门：" + text(employee.department) + "    岗位：" + text(employee.position) + "    联系电话：" + text(employee.phone, "资料未提供"),
      "入职时间：" + text(employee.entryDate, "资料未提供") + "    总工龄：" + text(employee.totalYear, "资料未提供") + "    接害工龄：" + text(employee.exposureYear, "资料未提供"),
      "",
      "二、职业接触史",
      "接触职业病危害因素：" + list(Array.from(new Set((employee.hazards || []).concat(position.hazards || []))), "资料未提供"),
      "本次体检类别：" + text(employee.examType, "资料未提供") + "    当前体检状态：" + text(employee.examStatus, "资料未提供"),
      "",
      "三、岗位检测依据",
      points.length ? points.map((point, index) => (index + 1) + ". " + text(point.name) + "：" + text(point.hazard) + " " + text(point.result) + "，限值 " + text(point.standard) + "，判定 " + text(point.judgement) + "。").join("\n") : "未匹配到该员工岗位的检测结果，正式建档前应补充检测或现状评价资料。",
      "",
      "四、职业健康检查结果",
      ...examResultLines(context, employee),
      "",
      "五、职业健康监护记录",
      "日期 | 检查类别 | 检查机构 | 检查结论 | 处理意见 | 归档人",
      "____年__月__日 | 上岗前 / 在岗期间 / 离岗时 |  |  |  | ",
      "____年__月__日 | 上岗前 / 在岗期间 / 离岗时 |  |  |  | ",
      "",
      "六、告知与签收",
      "劳动者已知悉本岗位职业病危害因素、职业健康检查结果及处理建议。",
      "劳动者签字：______________    日期：______年__月__日",
      "企业经办人：______________    日期：______年__月__日"
    ].join("\n");
  }

  function annualBody(context) {
    const profile = contextProfile(context);
    const positions = contextPositions(context);
    const points = contextPoints(context);
    const report = context.report || {};
    const hasDetectionDetails = points.length > 0;
    const failures = points.filter((point) => point.judgement === "不合格");
    const positionLines = positions.length ? positions.map((position, index) => {
      return (index + 1) + ". " + text(position.name) + "（" + text(position.department) + "）：危害因素 " + list(position.hazards, "待识别") +
        "；风险 " + text(position.riskLevel) + "；岗位人数 " + Number(position.relatedCount || 0) + " 人；检测点位 " + Number(position.detectionPointCount || 0) + " 条。";
    }).join("\n") : "尚未识别岗位数据，需在正式使用前补充岗位及危害因素清单。";
    const pointLines = hasDetectionDetails ? points.map((point, index) => {
      return (index + 1) + ". " + text(point.name) + " / " + text(point.hazard) + "：结果 " + text(point.result) + "，限值 " + text(point.standard) + "，判定 " + text(point.judgement) + "。";
    }).join("\n") : "当前未取得可用检测明细，本报告为待补充稿，不能据此作出合格结论。";
    const conclusion = !hasDetectionDetails
      ? "待补充：当前档案未包含可用的检测点位或检测报告明细。本报告仅依据企业基本信息、岗位和人员资料形成编制框架，不能作为职业病危害现状评价、合规结论或整改验收依据。完成现场检测并补充检测报告编号、检测日期、点位、危害因素、检测结果和判定后，应重新生成正式报告。"
      : failures.length
        ? "本年度发现 " + failures.length + " 条检测结果不合格，应立即采取工程控制、管理控制和个体防护措施，并复测确认整改效果。"
        : "根据已归集的检测资料，已识别检测项目未发现不合格结果。企业仍应持续运行职业病防护设施，并按岗位危害因素落实个体防护和职业健康监护。";
    const basisLines = [
      "1.《中华人民共和国职业病防治法》；",
      hasDetectionDetails ? "2. 工作场所职业病危害因素检测报告" + (report.reportNo ? "（编号：" + report.reportNo + "）" : "") + "；" : "2. 工作场所职业病危害因素检测报告（待补充）；",
      "3. 企业人员名册、岗位清单及职业健康管理资料。"
    ];
    return [
      "年度职业病危害评估报告",
      "",
      ...commonHeader(context),
      "",
      "一、评估依据",
      ...basisLines,
      "",
      "二、企业基本情况",
      enterpriseOverview(context),
      "",
      "三、检测与评价概况",
      "检测机构：" + text(report.testingOrganization) + "；报告编号：" + text(report.reportNo) + "；检测日期：" + text(report.reportDate) + "；风险分类：" + text(report.riskLevel) + "。",
      "工作场所：" + text(report.workplace || profile.address),
      hasDetectionDetails ? "检测明细状态：已载入 " + points.length + " 条可用检测结果。" : "检测明细状态：待补充，本报告不得据此作出合格结论。",
      "",
      "四、岗位危害因素识别",
      positionLines,
      "",
      "五、检测结果汇总",
      pointLines,
      "",
      "六、评估结论",
      conclusion,
      "",
      "七、管理建议",
      "1. 对检测结果接近职业接触限值的岗位加强通风、降噪、除尘和照明维护。",
      "2. 按岗位危害因素发放并监督佩戴个人防护用品，形成领用和更换记录。",
      "3. 按体检类别组织上岗前、在岗期间、离岗时职业健康检查，异常结果及时复查和处置。",
      "4. 定期维护职业病防护设施，保存检修、检测、培训和应急演练记录。",
      "5. 当工艺、设备、原辅材料或岗位发生变化时，及时重新识别危害因素并更新评估。",
      "6. " + (hasDetectionDetails ? "检测报告、岗位和人员信息发生变化时，应重新生成并审核本报告。" : "补充检测报告明细后，应重新生成正式报告并完成审核、签发。"),
      "",
      hasDetectionDetails ? "编制人：______________    审核人：______________    批准人：______________" : "本稿状态：待补充检测依据（不可直接签发）",
      "编制日期：______年__月__日"
    ].join("\n");
  }

  function hazardCardBody(context, target) {
    const position = target.position || {};
    const hazards = Array.isArray(position.hazards) ? position.hazards : [];
    const points = pointsForPosition(context, position);
    const rows = hazards.map((hazard) => {
      const matched = points.filter((point) => point.hazard === hazard);
      return hazard + " | " + (matched.length ? matched.map((point) => text(point.result) + "（" + text(point.judgement) + "）").join("；") : "待补充") + " | " + (matched.length ? list(matched.map((point) => point.standard), "待补充") : "待补充") + " | " + ppeForHazards([hazard]).join("、");
    });
    return [
      "职业病危害告知卡", "",
      ...commonHeader(context), "",
      "岗位 / 区域：" + text(position.name) + "（" + text(position.department) + "）",
      "风险等级：" + text(position.riskLevel, "待评估"),
      "检测报告：" + text(position.reportNo || context.report && context.report.reportNo, "待补充") + "    检测日期：" + text(position.reportDate || context.report && context.report.reportDate, "待补充"), "",
      "一、危害因素与检测结果",
      "危害因素 | 检测结果 | 职业接触限值 | 防护用品",
      ...(rows.length ? rows : ["待识别 | 待补充 | 待补充 | 按现场识别结果配备"]), "",
      "二、可能造成的健康损害",
      hazards.length ? hazards.map((hazard) => "• " + hazard + "：长期接触可能造成相应职业健康损害，应以有资质机构出具的检测和体检结论为准。").join("\n") : "待识别岗位危害因素后补充。", "",
      "三、防护要求",
      "1. 进入作业区域必须正确佩戴岗位规定的个人防护用品。",
      "2. 作业前检查通风、除尘、降噪、隔离等防护设施是否正常运行。",
      "3. 不得在作业区域饮食、吸烟或长时间停留。",
      "4. 出现头晕、胸闷、呼吸困难、皮肤刺激等异常时，立即撤离并报告。", "",
      "四、应急处置",
      "立即停止作业并撤离至安全区域；按现场应急预案实施急救；拨打急救电话并报告企业职业卫生管理人员。", "",
      "五、警示标识",
      "在岗位显著位置悬挂本告知卡，并保持警示标识、中文警示说明和应急电话清晰可见。", "",
      "企业负责人：______________    职业卫生管理人员：______________    日期：______年__月__日"
    ].join("\n");
  }

  function operatingProcedureBody(context, target) {
    const position = target.position || {};
    const hazards = Array.isArray(position.hazards) ? position.hazards : [];
    return [
      "岗位职业卫生操作规程", "",
      ...commonHeader(context), "",
      "适用岗位：" + text(position.name) + "    所属部门：" + text(position.department),
      "主要危害因素：" + list(hazards, "待识别"), "",
      "一、上岗前准备",
      "1. 确认作业任务、危害因素和防护要求，身体不适时主动报告。",
      "2. 检查通风、除尘、降噪、隔离、报警等职业病防护设施运行状态。",
      "3. 按岗位要求穿戴 " + ppeForHazards(hazards).join("、") + "，并检查完好性。", "",
      "二、作业过程控制",
      "1. 严格按工艺参数和设备操作规程作业，不得擅自拆除或停用防护设施。",
      "2. 产生粉尘、毒物、噪声或高温的作业应在指定区域进行，保持排风、除尘或降噪设施有效运行。",
      "3. 物料应密闭、分类存放，泄漏时立即处置并报告。",
      "4. 作业现场保持整洁，避免二次扬尘、交叉污染和无关人员进入。", "",
      "三、个体防护",
      "按岗位危害因素配备 " + ppeForHazards(hazards).join("、") + "；防护用品损坏、失效或污染时立即更换。", "",
      "四、异常与应急",
      "1. 发现检测报警、设备异常、异味、刺激性症状或人员不适时，立即停止作业、撤离并报告。",
      "2. 皮肤或眼睛接触危害因素时，立即用大量清水冲洗；吸入后迅速转移至通风处。",
      "3. 按企业应急预案报警、急救、隔离现场，并配合事故调查。", "",
      "五、作业结束与记录",
      "关闭设备并检查防护设施；分类收集废弃物；清洁作业区域；如实填写设施运行、防护用品领用和异常情况记录。", "",
      "编制人：______________    审核人：______________    批准人：______________    日期：______年__月__日"
    ].join("\n");
  }

  function managementSystemBody(context) {
    const systems = [
      ["职业病防治责任制", "明确主要负责人、分管负责人、职业卫生管理人员和岗位人员的职业病防治职责。"],
      ["职业卫生管理机构与人员职责", "设置或者指定职业卫生管理机构，配备专兼职管理人员，建立岗位责任清单。"],
      ["职业病危害警示与告知制度", "设置警示标识、告知卡和中文警示说明，依法履行劳动合同告知。"],
      ["职业病危害项目申报制度", "及时、如实申报职业病危害项目，变更后及时更新。"],
      ["职业病防护设施维护管理制度", "建立设施台账，开展日常检查、定期维护和异常停用恢复管理。"],
      ["个人防护用品管理制度", "按岗位危害因素配备、发放、培训、检查、更换和报废个人防护用品。"],
      ["职业病危害监测与评价制度", "定期开展检测评价，超标结果及时整改和复测。"],
      ["职业健康监护制度", "组织上岗前、在岗期间、离岗时和应急职业健康检查，建立个人监护档案。"],
      ["职业卫生培训制度", "对负责人、管理人员和劳动者开展分层分类培训并保存记录。"],
      ["职业病危害事故应急救援制度", "编制应急预案，配备应急物资，组织演练和总结改进。"],
      ["职业病危害事故报告与调查制度", "明确事故报告、现场保护、医疗救治、调查处理和整改闭环要求。"],
      ["职业卫生档案管理制度", "归档保存企业职业卫生档案和个人监护档案，明确保管期限和借阅权限。"],
      ["建设项目职业病防护设施“三同时”管理制度", "防护设施与主体工程同时设计、同时施工、同时投入生产和使用。"]
    ];
    return [
      "职业卫生管理制度汇编", "",
      ...commonHeader(context), "",
      "目录",
      ...systems.map((item, index) => (index + 1) + ". " + item[0]), "",
      ...systems.flatMap((item, index) => [
        (index + 1) + ". " + item[0], item[1],
        "责任部门：职业卫生管理部门    执行范围：" + text(contextProfile(context).companyName || context.company && context.company.name) + "全体从业人员。", ""
      ]),
      "附则",
      "本制度汇编经企业负责人批准后实施，由职业卫生管理部门负责解释和修订。制度应与法律法规、企业工艺、岗位危害因素和检测结果保持一致。", "",
      "编制人：______________    审核人：______________    批准人：______________    日期：______年__月__日"
    ].join("\n");
  }

  function managementOrganizationBody(context) {
    const profile = contextProfile(context);
    const companyName = text(profile.companyName || context.company && context.company.name);
    return [
      "关于成立职业卫生管理机构的通知", "",
      ...commonHeader(context), "",
      "各部门：",
      "为落实《中华人民共和国职业病防治法》等法律法规要求，加强职业病防治工作，经研究，决定成立" + companyName + "职业卫生管理机构。现将有关事项通知如下：", "",
      "一、组织机构",
      "组  长：" + text(profile.legalRepresentative, "企业主要负责人") + "（企业主要负责人）",
      "副组长：______________（分管负责人）",
      "成  员：______________（职业卫生管理人员）、______________（生产部门负责人）、______________（人力资源部门负责人）、______________（工会代表）",
      "职业卫生管理机构下设办公室，办公室设在______________，负责日常组织协调工作。", "",
      "二、主要职责",
      "1. 贯彻执行职业病防治法律法规、标准和本企业职业卫生管理制度。",
      "2. 组织开展职业病危害因素识别、检测、评价和申报。",
      "3. 组织职业健康检查，建立并维护职业健康监护档案。",
      "4. 组织职业卫生培训和职业病危害告知。",
      "5. 检查职业病防护设施和个人防护用品配备使用情况。",
      "6. 组织职业病危害事故应急演练、事故报告和调查处理。",
      "7. 定期向企业主要负责人报告职业卫生工作情况。", "",
      "三、工作要求",
      "各部门应配合职业卫生管理机构开展工作。职业卫生管理人员应接受相应培训，掌握职业病防治知识和管理要求。", "",
      "特此通知。", "", companyName, "______年__月__日"
    ].join("\n");
  }

  function annualPreventionPlanBody(context) {
    const positions = contextPositions(context);
    const tasks = [
      ["完善责任体系", "更新职业卫生管理机构和岗位责任清单", "第一季度", "企业负责人"],
      ["危害因素识别与申报", "核对岗位、危害因素和接触人员，完成职业病危害项目申报", "第一季度", "职业卫生管理部门"],
      ["工作场所检测", "委托有资质机构开展检测评价，跟踪超标整改", "第二至第三季度", "职业卫生管理部门"],
      ["防护设施维护", "建立设施台账并开展日常检查和定期维护", "全年", "生产部门"],
      ["个体防护用品", "按岗位危害因素发放、培训和检查个人防护用品", "全年", "采购与生产部门"],
      ["职业健康检查", "组织上岗前、在岗期间和离岗时检查，处理异常结果", "按计划", "人力资源部门"],
      ["职业卫生培训", "开展负责人、管理人员和劳动者培训", "每半年", "职业卫生管理部门"],
      ["警示与告知", "更新告知卡、警示标识和劳动合同告知内容", "全年", "职业卫生管理部门"],
      ["应急管理", "修订预案、补充物资并组织应急演练", "第三季度", "应急管理负责人"],
      ["档案管理", "归档检测、体检、培训、设施和防护用品记录", "全年", "档案管理员"],
      ["合规诊断", "对照法规和已交材料识别三同时、资质等缺口", "第四季度", "企业负责人"],
      ["年度总结", "评估目标完成情况并制定下一年度计划", "第四季度", "职业卫生管理机构"]
    ];
    return [
      "年度职业病防治计划与实施方案", "",
      ...commonHeader(context), "",
      "一、指导思想",
      "坚持预防为主、防治结合，以职业病危害因素识别、检测评价、工程控制、个体防护和职业健康监护为重点，持续降低职业病危害风险。", "",
      "二、年度目标",
      "1. 职业病危害项目申报率 100%。",
      "2. 工作场所职业病危害因素检测覆盖率达到 100%。",
      "3. 接触职业病危害劳动者职业健康检查率、培训率和告知率达到 100%。",
      "4. 职业病防护设施完好率、个人防护用品配备率达到 100%。",
      "5. 职业病危害事故应急处置和报告机制有效运行。", "",
      "三、企业基本情况", ...enterpriseOverview(context), "",
      "四、重点工作任务",
      "序号 | 工作事项 | 主要内容 | 完成时限 | 责任部门 / 人员",
      ...tasks.map((task, index) => (index + 1) + " | " + task[0] + " | " + task[1] + " | " + task[2] + " | " + task[3]), "",
      "五、岗位危害控制重点",
      positions.length ? positions.map((position, index) => (index + 1) + ". " + text(position.name) + "（" + text(position.department) + "）：" + list(position.hazards, "待识别") + "；检测点位 " + Number(position.detectionPointCount || 0) + " 条。").join("\n") : "待补充岗位和危害因素识别结果。", "",
      "六、资源保障",
      "预算项目：检测评价、职业健康检查、防护设施维护、个人防护用品、培训、应急物资和档案管理。具体费用由财务部门根据年度预算核定。", "",
      "七、检查与考核",
      "职业卫生管理机构每季度检查计划完成情况，形成问题清单并跟踪整改；年度末开展总结评估，将完成情况纳入部门考核。", "",
      "编制人：______________    审核人：______________    批准人：______________    日期：______年__月__日"
    ].join("\n");
  }

  function trainingPlanBody(context) {
    const positions = contextPositions(context);
    const hazards = Array.from(new Set(positions.flatMap((position) => position.hazards || [])));
    const courses = [
      ["职业病防治法律法规与企业责任", "负责人、职业卫生管理人员", "2 学时", "第一季度"],
      ["职业病危害因素识别与检测评价", "职业卫生管理人员、班组长", "2 学时", "第二季度"],
      ["岗位职业病危害告知与防护用品使用", "接触职业病危害劳动者", "2 学时", "第二季度"],
      ["职业健康监护与异常结果处置", "人力资源、职业卫生管理人员", "1 学时", "第三季度"],
      ["职业病危害事故应急救援与演练", "全体员工及应急人员", "2 学时", "第三季度"],
      ["职业卫生管理制度和操作规程", "全体员工", "1 学时", "第四季度"],
      ["年度培训考核与总结", "全体员工", "1 学时", "第四季度"]
    ];
    return [
      "职业健康教育培训计划", "",
      ...commonHeader(context), "",
      "一、培训目标",
      "使企业负责人、职业卫生管理人员和劳动者了解职业病防治法律法规、岗位危害因素、防护措施、职业健康监护和应急处置要求。", "",
      "二、培训对象",
      "企业主要负责人、职业卫生管理人员、接触职业病危害的劳动者、班组长、人力资源和应急救援人员。", "",
      "三、培训内容与安排",
      "序号 | 培训主题 | 培训对象 | 学时 | 计划时间 | 培训方式",
      ...courses.map((course, index) => (index + 1) + " | " + course[0] + " | " + course[1] + " | " + course[2] + " | " + course[3] + " | 集中授课 / 现场教学"), "",
      "四、岗位重点内容",
      positions.length ? positions.map((position, index) => (index + 1) + ". " + text(position.name) + "：" + list(position.hazards, "危害因素待识别") + "；重点培训防护设施、个人防护用品、异常报告和应急处置。").join("\n") : "待补充岗位及危害因素后细化。", "",
      "五、培训要求",
      "1. 新员工上岗前接受职业卫生培训，转岗、离岗和工艺变化时进行针对性培训。",
      "2. 培训签到、课件、考核和影像资料应归档保存。",
      "3. 对培训考核不合格人员组织补训。",
      "4. 培训内容应与岗位危害因素和检测结果保持一致。", "",
      "六、主要危害因素", list(hazards, "待识别"), "",
      "编制人：______________    审核人：______________    批准人：______________    日期：______年__月__日"
    ].join("\n");
  }

  function trainingRecordBody(context) {
    const employees = contextEmployees(context);
    return [
      "职业健康培训记录", "",
      ...commonHeader(context), "",
      "培训主题：________________________________________________",
      "培训日期：______年__月__日    培训时间：______至______",
      "培训地点：________________    授课人：________________",
      "培训方式：集中授课 / 现场教学 / 在线学习    学时：______", "",
      "一、培训内容",
      "1. 职业病防治法律法规和企业职业卫生管理制度。",
      "2. 岗位职业病危害因素、检测结果及健康影响。",
      "3. 职业病防护设施、个人防护用品正确使用方法。",
      "4. 职业健康检查、异常结果报告和复查要求。",
      "5. 职业病危害事故应急处置和自救互救。", "",
      "二、培训签到",
      "序号 | 姓名 | 部门 | 岗位 | 签到 | 考核结果",
      ...(employees.length ? employees.map((employee, index) => (index + 1) + " | " + text(employee.name) + " | " + text(employee.department) + " | " + text(employee.position) + " |  | ") : ["1 |  |  |  |  | "]), "",
      "三、培训效果评价",
      "应到 ______ 人，实到 ______ 人，缺席 ______ 人；考核合格 ______ 人，不合格 ______ 人。",
      "培训效果：□ 达到计划要求  □ 需补充培训  □ 需重新考核", "",
      "四、影像与资料",
      "培训通知、课件、签到表、考核试卷和现场照片附后归档。", "",
      "授课人签字：______________    组织人签字：______________",
      "企业负责人签字：______________    日期：______年__月__日"
    ].join("\n");
  }

  const bodyBuilders = {
    "hazard-notice": noticeBody,
    "facility-maintenance": maintenanceBody,
    "emergency-plan": emergencyBody,
    "ppe-plan": ppeBody,
    "health-record": healthRecordBody,
    "annual-assessment": annualBody,
    "hazard-card": hazardCardBody,
    "operating-procedure": operatingProcedureBody,
    "management-system": managementSystemBody,
    "management-organization": managementOrganizationBody,
    "annual-prevention-plan": annualPreventionPlanBody,
    "training-plan": trainingPlanBody,
    "training-record": trainingRecordBody
  };

  function render(definition, target, context) {
    const builder = definition && bodyBuilders[definition.id];
    if (!builder) return "该模板暂未配置正文生成器。";
    return builder(context || {}, target || {});
  }

  window.DocumentTemplates = {
    definitions,
    buildTargets,
    render,
    requiredCategories: REQUIRED
  };
})();
