(() => {
  "use strict";

  const REQUIRED = ["company", "employees", "positions"];
  const definitions = [
    {
      id: "hazard-notice",
      name: "职业病危害告知书",
      shortName: "危害告知书",
      scope: "position",
      version: "2.3",
      templateCode: "ZD-GZ-001",
      iconTone: "blue",
      iconLetter: "告",
      requiredCategories: REQUIRED,
      scopeLabel: "岗位级",
      cycleLabel: "每岗位 1 份"
    },
    {
      id: "facility-maintenance",
      name: "职业病防护设施维护记录",
      shortName: "设施维护记录",
      scope: "enterprise",
      version: "1.6",
      templateCode: "ZD-FH-002",
      iconTone: "indigo",
      iconLetter: "维",
      requiredCategories: REQUIRED,
      scopeLabel: "企业级",
      cycleLabel: "每企业 1 份"
    },
    {
      id: "emergency-plan",
      name: "职业病危害事故应急预案",
      shortName: "应急预案",
      scope: "enterprise",
      version: "1.8",
      templateCode: "ZD-YJ-003",
      iconTone: "red",
      iconLetter: "急",
      requiredCategories: REQUIRED,
      scopeLabel: "企业级",
      cycleLabel: "每企业 1 份"
    },
    {
      id: "ppe-plan",
      name: "劳动防护用品发放计划",
      shortName: "防护用品计划",
      scope: "position",
      version: "2.0",
      templateCode: "ZD-LD-004",
      iconTone: "green",
      iconLetter: "护",
      requiredCategories: REQUIRED,
      scopeLabel: "岗位级",
      cycleLabel: "每岗位 1 份"
    },
    {
      id: "health-record",
      name: "员工职业健康监护档案",
      shortName: "监护档案",
      scope: "employee",
      version: "2.2",
      templateCode: "ZD-JK-005",
      iconTone: "amber",
      iconLetter: "档",
      requiredCategories: REQUIRED,
      scopeLabel: "人员级",
      cycleLabel: "每员工 1 份"
    },
    {
      id: "annual-assessment",
      name: "年度职业病危害评估报告",
      shortName: "年度评估报告",
      scope: "enterprise",
      version: "3.0",
      templateCode: "ZD-PG-006",
      iconTone: "slate",
      iconLetter: "评",
      requiredCategories: REQUIRED,
      scopeLabel: "企业级",
      cycleLabel: "每企业 1 份"
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

  function pointsForPosition(context, position) {
    const points = contextPoints(context);
    const positionName = text(position && position.name, "");
    const hazards = Array.isArray(position && position.hazards) ? position.hazards : [];
    const exact = points.filter((point) => String(point && point.name || "").includes(positionName));
    const byHazard = points.filter((point) => hazards.includes(point && point.hazard));
    return Array.from(new Set(exact.concat(byHazard)));
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
      "主要职业病危害因素：" + list(Array.from(new Set(positions.flatMap((position) => position.hazards || []).concat(points.map((point) => point.hazard)))))
    ];
  }

  function noticeBody(context, target) {
    const position = target.position || {};
    const hazards = Array.isArray(position.hazards) ? position.hazards : [];
    return [
      "职业病危害告知书",
      "",
      "编号：________________",
      "",
      "劳动者姓名：____________________    所在部门：" + text(position.department) + "    岗位：" + text(position.name),
      "用人单位：" + text(contextProfile(context).companyName || context.company && context.company.name),
      "",
      "根据《中华人民共和国职业病防治法》等规定，现将本岗位存在的职业病危害因素、接触限值及防护要求告知如下：",
      "",
      "一、岗位职业病危害因素",
      hazards.length ? hazards.map((hazard, index) => (index + 1) + ". " + hazard).join("\n") : "尚未识别，请在正式使用前补充岗位危害因素识别。",
      "",
      "二、检测结果与接触限值",
      detectionLines(context, position).join("\n"),
      "",
      "三、职业病防护要求",
      "1. 上岗前、在岗期间和离岗时按要求参加职业健康检查，不得隐瞒职业史和健康状况。",
      "2. 正确佩戴并使用与岗位危害因素相适应的个人防护用品，不得擅自拆除职业病防护设施。",
      "3. 参加职业卫生培训，掌握危害因素、防护措施和事故应急处置方法。",
      "4. 发现职业病防护设施异常或身体不适，应立即报告职业健康管理人员。",
      "",
      "四、拟配备劳动防护用品",
      ppeForHazards(hazards).join("、") + "。",
      "",
      "告知人（签字）：______________    日期：______年__月__日",
      "劳动者（签字）：______________    日期：______年__月__日",
      "",
      ...commonHeader(context)
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
    const points = contextPoints(context).filter((point) => (employee.hazards || []).includes(point.hazard));
    return [
      "员工职业健康监护档案",
      "",
      "一、人员基本信息",
      "姓名：" + text(employee.name) + "    性别：资料未提供    身份证号：" + text(employee.idNumber, "资料未提供"),
      "部门：" + text(employee.department) + "    岗位：" + text(employee.position) + "    联系电话：" + text(employee.phone, "资料未提供"),
      "入职时间：" + text(employee.entryDate, "资料未提供") + "    总工龄：" + text(employee.totalYear, "资料未提供") + "    接害工龄：" + text(employee.exposureYear, "资料未提供"),
      "",
      "二、职业接触史",
      "接触职业病危害因素：" + list(employee.hazards, "资料未提供"),
      "本次体检类别：" + text(employee.examType, "资料未提供") + "    当前体检状态：" + text(employee.examStatus, "资料未提供"),
      "",
      "三、岗位检测依据",
      points.length ? points.map((point, index) => (index + 1) + ". " + text(point.name) + "：" + text(point.hazard) + " " + text(point.result) + "，限值 " + text(point.standard) + "，判定 " + text(point.judgement) + "。").join("\n") : "未匹配到该员工岗位的检测结果，正式建档前应补充检测或现状评价资料。",
      "",
      "四、职业健康检查结果",
      "检查日期：________________    检查机构：________________",
      "检查项目：________________    检查结论：________________",
      "处理建议：________________    复查日期：________________",
      "",
      "五、职业健康监护记录",
      "日期 | 检查类别 | 检查机构 | 检查结论 | 处理意见 | 归档人",
      "____年__月__日 | 上岗前 / 在岗期间 / 离岗时 |  |  |  | ",
      "____年__月__日 | 上岗前 / 在岗期间 / 离岗时 |  |  |  | ",
      "",
      "六、告知与签收",
      "劳动者已知悉本岗位职业病危害因素、职业健康检查结果及处理建议。",
      "劳动者签字：______________    日期：______年__月__日",
      "企业经办人：______________    日期：______年__月__日",
      "",
      ...commonHeader(context)
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

  const bodyBuilders = {
    "hazard-notice": noticeBody,
    "facility-maintenance": maintenanceBody,
    "emergency-plan": emergencyBody,
    "ppe-plan": ppeBody,
    "health-record": healthRecordBody,
    "annual-assessment": annualBody
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
