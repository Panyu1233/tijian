const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const JSZip = require('./vendor/jszip.min.js');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  let testPassed = false;
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', error => errors.push('PAGEERROR ' + error.message));
  page.on('dialog', async dialog => { await dialog.accept(); });

  const getCompany = async () => page.evaluate(() => {
    const code = sessionStorage.getItem('zadocs_session_company_code');
    const companies = JSON.parse(localStorage.getItem('zadocs_registered_companies') || '[]');
    return companies.find(item => item.code === code) || null;
  });

  try {
    await page.goto('http://127.0.0.1:8765/preview/index.html?login=1', { waitUntil: 'networkidle' });
    await page.click('[data-auth-tab="register"]');
    await page.click('[data-auth-view="enterprise"]');
    const account = 'e2e_' + Date.now();
    await page.fill('#enterpriseAccount', account);
    await page.fill('#enterprisePassword', 'test123456');
    await page.click('#enterpriseRegisterSubmit');
    await page.waitForSelector('#enterpriseImportModal', { state: 'visible' });

    const dir = process.env.E2E_FILES_DIR;
    assert(dir, '请通过 E2E_FILES_DIR 指定测试资料目录');
    assert(fs.existsSync(dir), '测试资料目录不存在：' + dir);
    const includeExam = process.env.E2E_INCLUDE_EXAM !== '0';
    const expectedFileCount = includeExam ? 4 : 3;
    const files = fs.readdirSync(dir)
      .filter(name => /\.(docx|xls|xlsx|pdf)$/i.test(name))
      .filter(name => includeExam || !/体检|健康检查/.test(name))
      .map(name => path.join(dir, name));
    assert.equal(files.length, expectedFileCount, '测试资料数量应与测试模式一致');
    await page.setInputFiles('#enterpriseGlobalFileInput', files);
    await page.waitForFunction(() => !document.querySelector('#enterpriseImportSubmit').disabled);
    await page.click('#enterpriseImportSubmit');
    await page.waitForSelector('#enterpriseImportModal', { state: 'hidden', timeout: 120000 });
    await page.waitForTimeout(1200);

    const uploadedCompany = await getCompany();
    assert(uploadedCompany, '上传后企业数据应存在');
    const uploadedFiles = uploadedCompany.libraryFiles || [];
    assert.equal(uploadedFiles.length, expectedFileCount, '全部测试资料应进入当前企业资料库');
    assert.equal(uploadedFiles.filter(file => file.category === 'company').length, 1, '应识别企业主体资料');
    assert.equal(uploadedFiles.filter(file => file.category === 'employees').length, 1, '应识别人员名册');
    assert.equal(uploadedFiles.filter(file => file.category === 'positions').length, 1, '应识别职业病危害检测报告');
    assert.equal(uploadedFiles.filter(file => file.category === 'exam').length, includeExam ? 1 : 0, '体检报告应按建议项处理');
    assert(uploadedFiles.every(file => file.parseStatus === 'parsed'), '全部资料应解析成功');

    await page.click('.nav-item[data-view="dashboard"]');
    await page.waitForTimeout(500);
    const reviewButtons = page.locator('#dashboardReviewList [data-doc-id]');
    const reviewCount = await reviewButtons.count();
    assert(reviewCount >= 2, '工作台应有可核查文件');
    await reviewButtons.first().click();
    await page.waitForSelector('#docModal', { state: 'visible' });
    assert(await page.locator('#modalConfirmReview').isVisible(), '已解析文件应支持逐份核查');
    await page.click('#modalConfirmReview');
    await page.waitForSelector('#docModal', { state: 'hidden' });
    await page.waitForTimeout(500);
    assert(await page.locator('#dashboardReviewAllButton').isVisible(), '仍有待核查文件时应显示一键核查');
    await page.click('#dashboardReviewAllButton');
    await page.waitForFunction(() => {
      const code = sessionStorage.getItem('zadocs_session_company_code');
      const companies = JSON.parse(localStorage.getItem('zadocs_registered_companies') || '[]');
      const current = companies.find(item => item.code === code);
      return current && current.libraryFiles.length > 0 && current.libraryFiles.every(file => file.parseStatus !== 'parsed' || Boolean(file.reviewedAt));
    });
    await page.waitForTimeout(700);

    const mappedCompany = await getCompany();
    assert(mappedCompany, '企业注册数据应存在');
    assert(mappedCompany.enterpriseMapping, '核查后应存在映射结果');
    const employeeCount = mappedCompany.enterpriseMapping.employees.length;
    assert(employeeCount > 0, '应映射出员工');
    assert.equal(employeeCount, 3, '应同步全部三名测试员工');
    assert.equal(mappedCompany.enterpriseMapping.profile.companyName, '测试职业健康科技有限公司', '企业基本信息应从 Excel 映射');
    assert(mappedCompany.enterpriseMapping.positions.length >= 3, '岗位应从人员名册与检测报告合并');
    assert(mappedCompany.enterpriseMapping.detectionPoints.length >= 2, '检测报告应映射出检测点位');
    assert.equal(mappedCompany.enterpriseMapping.exams.length, includeExam ? 3 : 0, '体检报告应按实际提供情况映射');
    assert.equal(mappedCompany.name, '测试职业健康科技有限公司', '解析出的企业名称应同步为企业空间名称');
    assert.equal((await page.locator('.workspace-copy strong').innerText()).trim(), '测试职业健康科技有限公司', '侧栏企业名称应同步更新');
    console.log('MAPPED', JSON.stringify({
      company: mappedCompany.enterpriseMapping.profile.companyName,
      employees: employeeCount,
      positions: mappedCompany.enterpriseMapping.positions.length,
      detectionPoints: mappedCompany.enterpriseMapping.detectionPoints.length
    }));

    await page.click('.nav-item[data-view="enterprise"]');
    await page.waitForTimeout(500);
    assert.equal((await page.locator('#currentCompanyTitle').innerText()).trim(), '测试职业健康科技有限公司', '企业档案应展示映射后的企业名称');
    assert.equal(await page.locator('#positionTableBody tr').count(), 3, '企业档案应展示同步后的全部岗位');
    assert.equal(await page.locator('#employeeMappingList .mapped-employee-row:not(.mapped-employee-row-head)').count(), employeeCount, '企业档案应展示同步后的全部员工');

    await page.click('#editCompanyProfile');
    await page.waitForSelector('#companyEditModal', { state: 'visible' });
    assert.equal(await page.inputValue('#editCompanyName'), '测试职业健康科技有限公司', '编辑弹窗应带出已映射企业名称');
    await page.fill('#editCompanyContact', '赵测试');
    await page.click('#companyEditSave');
    await page.waitForSelector('#companyEditModal', { state: 'hidden' });
    const editedCompany = await getCompany();
    assert.equal(editedCompany.profileOverrides.contactName, '赵测试', '人工修改应保存为企业主数据覆盖项');
    assert.equal(editedCompany.enterpriseMapping.profile.contactName, '赵测试', '人工修改应回写到生成上下文');
    console.log('PROFILE EDIT', editedCompany.name, editedCompany.enterpriseMapping.profile.contactName);

    await page.click('#generateSupplementalMaterial');
    await page.waitForTimeout(300);
    assert(await page.locator('#view-generate').evaluate(element => element.classList.contains('active')), '生成补充资料按钮应进入文档生成页');
    await page.waitForTimeout(700);
    const checks = page.locator('#generationTableBody .doc-check');
    const enabledChecks = page.locator('#generationTableBody .doc-check:not(:disabled)');
    const enabledCount = await enabledChecks.count();
    assert.equal(enabledCount, 13, '三类必选资料齐备后，13 类模板应全部可生成，体检报告不作为阻断项');
    const templateDefinitions = await page.evaluate(() => window.DocumentTemplates.definitions.map(definition => definition.id));
    assert.equal(templateDefinitions.length, 13, '模板引擎应提供 13 类模板');
    console.log('GENERATION READY', enabledCount, 'SUMMARY', await page.locator('#generationReadySummary').innerText());
    await enabledChecks.first().check({ force: true });
    await page.click('#validateDocs');
    await page.waitForFunction(() => !document.querySelector('#validateDocs').disabled);
    assert.equal((await page.locator('#generationTableBody tr.checked .doc-status').first().innerText()).trim(), '校验通过', '文档依赖校验应更新行状态');
    await page.check('#selectAllDocs', { force: true });
    assert(await page.locator('#generateDocs').isEnabled(), '全选后生成按钮应启用');
    await page.click('#generateDocs');
    await page.waitForFunction(() => !document.querySelector('#generationProgress').hidden, null, { timeout: 5000 });
    await page.waitForSelector('#generationProgress', { state: 'hidden', timeout: 20000 });

    let company = await getCompany();
    const generated = (company.archiveDocuments || []).filter(document => document.templateId);
    const employeeDocuments = generated.filter(document => document.templateId === 'health-record');
    assert(generated.length >= enabledCount, '生成文档数量应不少于所选模板数');
    assert.equal(employeeDocuments.length, employeeCount, '人员级文档应按员工一人一份生成');
    const generatedTemplateIds = Array.from(new Set(generated.map(document => document.templateId))).sort();
    const expectedTemplateIds = templateDefinitions.slice().sort();
    assert.deepEqual(generatedTemplateIds, expectedTemplateIds, '应实际生成全部 13 类模板文件');
    assert(generated.every(document => document.body && document.body.length > 100), '每份生成文件都应有真实正文');
    assert(generated.every(document => document.body.includes('测试职业健康科技有限公司')), '每份生成正文都应包含同步后的企业名称');
    console.log('GENERATED', generated.length, 'TEMPLATE TYPES', generatedTemplateIds.length, 'EMPLOYEE DOCS', employeeDocuments.length);

    await page.click('.nav-item[data-view="library"]');
    await page.waitForTimeout(600);
    const generatedRows = page.locator('#generatedDocsTableBody tr');
    assert((await generatedRows.count()) >= generated.length, '资源中心应展示全部生成文档');
    const firstViewButton = page.locator('#generatedDocsTableBody [data-archive-doc-id]').first();
    const documentId = await firstViewButton.getAttribute('data-archive-doc-id');
    assert(documentId, '生成文档应有档案 ID');
    await firstViewButton.click();
    await page.waitForSelector('#docModal', { state: 'visible' });
    const bodyText = await page.locator('.archive-document-body').innerText();
    assert(bodyText.length > 100, '生成文档详情应显示真实正文');
    assert(await page.locator('#modalEditDocument').isVisible(), '生成文档应支持编辑');
    assert(await page.locator('#modalDownload').isVisible(), '生成文档应支持下载');
    assert(await page.locator('#modalReplaceFile').isVisible(), '生成文档应支持重新上传');

    await page.click('#modalEditDocument');
    await page.waitForSelector('#archiveDocumentEditor', { state: 'visible' });
    const originalEditorText = await page.inputValue('#archiveDocumentEditor');
    const editedText = originalEditorText + '\n\n演示修订记录：已由企业管理员核查。';
    await page.fill('#archiveDocumentEditor', editedText);
    await page.click('#modalSaveVersion');
    await page.waitForFunction(expected => document.querySelector('#modalFooterNote').textContent.includes(expected), '已保存新版本');

    company = await getCompany();
    let editedDocument = company.archiveDocuments.find(document => document.id === documentId);
    assert.equal(editedDocument.version, 'V1.1', '编辑后版本应递增为 V1.1');
    assert(editedDocument.body.includes('演示修订记录'), '编辑正文应保存');
    assert(editedDocument.versions.some(version => version.version === 'V1.0'), '历史版本 V1.0 应保留');
    assert(editedDocument.versions.some(version => version.version === 'V1.1'), '新版本 V1.1 应保留');

    const downloadPromise = page.waitForEvent('download');
    await page.click('#modalDownload');
    const download = await downloadPromise;
    assert(/\.docx$/i.test(download.suggestedFilename()), '下载文件应为真实 .docx');
    const downloadPath = path.join(__dirname, 'e2e-generated-document.docx');
    await download.saveAs(downloadPath);
    assert(fs.statSync(downloadPath).size > 500, '下载文件不应为空');
    const downloadedDocx = await JSZip.loadAsync(fs.readFileSync(downloadPath));
    assert(downloadedDocx.file('word/document.xml'), 'DOCX 应包含 Word 正文部件');
    const downloadedXml = await downloadedDocx.file('word/document.xml').async('string');
    assert(downloadedXml.includes('演示修订记录'), 'DOCX 正文应包含当前编辑版本内容');
    fs.unlinkSync(downloadPath);
    console.log('DOWNLOAD', download.suggestedFilename());

    const chooserPromise = page.waitForEvent('filechooser');
    await page.click('#modalReplaceFile');
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: '重新上传演示正文.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('重新上传正文\n\n本文件用于验证资源中心重新上传并生成新版本。', 'utf8')
    });
    await page.waitForFunction(id => {
      const code = sessionStorage.getItem('zadocs_session_company_code');
      const companies = JSON.parse(localStorage.getItem('zadocs_registered_companies') || '[]');
      const current = companies.find(item => item.code === code);
      const document = current && (current.archiveDocuments || []).find(item => item.id === id);
      return document && document.version === 'V1.2';
    }, documentId, { timeout: 15000 });
    company = await getCompany();
    editedDocument = company.archiveDocuments.find(document => document.id === documentId);
    assert(editedDocument.body.includes('重新上传正文'), '重新上传应替换正文');
    assert(editedDocument.versions.some(version => version.note && version.note.includes('重新上传')), '重新上传应记录版本备注');
    assert.equal(editedDocument.versions.length, 3, '编辑和重传后应保留三个版本');
    const versionSummary = await page.locator('.archive-version-history summary').innerText();
    assert(versionSummary.includes('3'), '详情页应显示三个版本记录');
    assert(versionSummary.includes('V1.2'), '版本历史应标记当前 V1.2');
    await page.screenshot({ path: 'preview/e2e-document-detail.png', fullPage: false });
    console.log('REUPLOAD VERSION', editedDocument.version);

    await page.click('#modalSubmitReview');
    await page.waitForFunction(id => {
      const code = sessionStorage.getItem('zadocs_session_company_code');
      const companies = JSON.parse(localStorage.getItem('zadocs_registered_companies') || '[]');
      const current = companies.find(item => item.code === code);
      const document = current && (current.archiveDocuments || []).find(item => item.id === id);
      return document && document.status === 'review';
    }, documentId);
    assert(await page.locator('#modalSignDocument').isVisible(), '待审核文档应可签发');

    await page.click('#modalSignDocument');
    await page.waitForFunction(id => {
      const code = sessionStorage.getItem('zadocs_session_company_code');
      const companies = JSON.parse(localStorage.getItem('zadocs_registered_companies') || '[]');
      const current = companies.find(item => item.code === code);
      const document = current && (current.archiveDocuments || []).find(item => item.id === id);
      return document && document.status === 'signed' && Boolean(document.signer) && Boolean(document.signedAt);
    }, documentId);
    assert(await page.locator('#modalArchiveDocument').isVisible(), '已签发文档应可归档');

    await page.click('#modalArchiveDocument');
    await page.waitForFunction(id => {
      const code = sessionStorage.getItem('zadocs_session_company_code');
      const companies = JSON.parse(localStorage.getItem('zadocs_registered_companies') || '[]');
      const current = companies.find(item => item.code === code);
      const document = current && (current.archiveDocuments || []).find(item => item.id === id);
      return document && document.status === 'archived' && Boolean(document.archivedAt);
    }, documentId);
    company = await getCompany();
    const archivedDocument = company.archiveDocuments.find(document => document.id === documentId);
    assert(archivedDocument.signer, '归档文档应保留签发人');
    assert(archivedDocument.signedAt && archivedDocument.archivedAt, '归档文档应保留签发和归档时间');
    console.log('LIFECYCLE', archivedDocument.status, archivedDocument.signer);

    await page.click('#modalCancel');
    await page.click('.nav-item[data-view="archive"]');
    await page.waitForTimeout(700);
    const archiveRows = await page.locator('#archiveTableBody tr[data-document-id]').count();
    const peopleRows = await page.locator('#archivePeopleBody tr').count();
    const sourceRows = await page.locator('#archiveSourceBody tr').count();
    assert(archiveRows > 0, '档案库应显示生成文档');
    assert.equal(peopleRows, employeeCount, '档案库人员列表应显示全部员工');
    assert.equal(sourceRows, files.length, '档案库原始资料列表应显示全部上传文件');
    assert.equal((await page.locator('#archiveStatTotal').innerText()).trim(), String(generated.length));

    await page.fill('#archiveSearch', '张三');
    await page.waitForTimeout(200);
    assert(await page.locator('#archiveTableBody tr[data-document-id]').count() > 0, '档案库搜索应命中员工文档');
    await page.fill('#archiveSearch', '');
    await page.locator('.status-tabs button[data-status="archived"]').click();
    await page.waitForTimeout(200);
    assert.equal(await page.locator('#archiveTableBody tr[data-document-id]').count(), 1, '档案状态筛选应只显示已归档文档');
    await page.locator('.status-tabs button[data-status="all"]').click();
    await page.waitForTimeout(200);
    await page.locator('#archivePager [data-archive-page="2"]').filter({ hasText: /^2$/ }).click();
    await page.waitForTimeout(200);
    assert.equal((await page.locator('#archivePager [aria-current="page"]').innerText()).trim(), '2', '档案分页应可切换到第二页');
    await page.locator('#archivePager [data-archive-page="1"]').filter({ hasText: /^1$/ }).click();

    const csvDownloadPromise = page.waitForEvent('download');
    await page.click('#exportArchiveDirectory');
    const csvDownload = await csvDownloadPromise;
    assert(/\.csv$/i.test(csvDownload.suggestedFilename()), '档案目录应导出 CSV');
    assert(csvDownload.suggestedFilename().includes('测试职业健康科技有限公司'), '导出文件名应使用真实企业名称');
    const csvPath = path.join(__dirname, 'e2e-archive-directory.csv');
    await csvDownload.saveAs(csvPath);
    const csvText = fs.readFileSync(csvPath, 'utf8');
    assert(csvText.includes('档案编号') && csvText.includes('文档名称'), '档案目录应包含表头');
    assert(csvText.includes('已归档'), '档案目录应体现签发归档状态');
    fs.unlinkSync(csvPath);

    const zipDownloadPromise = page.waitForEvent('download');
    await page.click('#exportArchivePackage');
    const zipDownload = await zipDownloadPromise;
    assert(/\.zip$/i.test(zipDownload.suggestedFilename()), '档案包应导出 ZIP');
    const zipPath = path.join(__dirname, 'e2e-archive-package.zip');
    await zipDownload.saveAs(zipPath);
    const archiveZip = await JSZip.loadAsync(fs.readFileSync(zipPath));
    const zipNames = Object.keys(archiveZip.files);
    assert(zipNames.includes('档案目录.csv') && zipNames.includes('导出说明.txt'), '档案包应包含目录与说明');
    const docxNames = zipNames.filter(name => /\.docx$/i.test(name));
    assert.equal(docxNames.length, generated.length, '档案包应包含全部 DOCX');
    for (const docxName of docxNames) {
      const nestedDocx = await JSZip.loadAsync(await archiveZip.file(docxName).async('nodebuffer'));
      const documentPart = nestedDocx.file('word/document.xml');
      assert(documentPart, '档案包内 DOCX 应包含 Word 正文：' + docxName);
      const xml = await documentPart.async('string');
      assert(xml.includes('<w:document'), '档案包内 DOCX 应可解压读取：' + docxName);
      const plainText = xml.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
      assert(plainText.length > 50, '档案包内 DOCX 正文不应为空：' + docxName);
    }
    fs.unlinkSync(zipPath);
    console.log('EXPORTS', csvDownload.suggestedFilename(), zipDownload.suggestedFilename(), zipNames.length);
    console.log('ARCHIVE', JSON.stringify({ archiveRows, peopleRows, sourceRows }));
    await page.screenshot({ path: 'preview/e2e-complete-flow.png', fullPage: true });

    await page.click('#userMenuButton');
    await page.click('#logoutButton');
    await page.waitForSelector('#loginScreen', { state: 'visible' });
    await page.fill('#loginAccount', account);
    await page.fill('#loginPassword', 'test123456');
    await page.click('#loginSubmit');
    await page.waitForSelector('#appFrame', { state: 'visible' });
    assert.equal((await page.locator('.workspace-copy strong').innerText()).trim(), '测试职业健康科技有限公司', '退出后应能使用注册账号重新登录');
    console.log('ENTERPRISE RELOGIN passed');
    await page.click('#userMenuButton');
    await page.click('#logoutButton');
    await page.waitForSelector('#loginScreen', { state: 'visible' });
    await page.click('[data-auth-tab="register"]');
    await page.click('[data-auth-view="personal"]');
    await page.click('#fillPersonalDemo');
    await page.waitForSelector('#companyVerifyResult', { state: 'visible' });
    assert(await page.locator('#fillPersonalDemo').isVisible(), '个人注册演示按钮应可用');
    await page.click('#personalRegisterSubmit');
    await page.waitForSelector('#personalPending', { state: 'visible' });
    assert(await page.locator('#pendingDemoEnterButton').isVisible(), '个人注册后应显示审核通过演示入口');
    await page.click('#pendingDemoEnterButton');
    await page.waitForSelector('#appFrame', { state: 'visible' });
    assert.equal((await page.locator('.workspace-copy strong').innerText()).trim(), '华东精密制造有限公司（演示）', '个人成员通过演示审核后应进入绑定企业空间');
    console.log('PERSONAL FLOW approved');

    assert.equal(errors.length, 0, '浏览器不应出现控制台或页面错误：' + errors.join(' | '));
    testPassed = true;
    console.log('E2E PASSED');
  } finally {
    try {
      await page.evaluate(() => {
        Object.keys(localStorage).filter(key => key.startsWith('zadocs')).forEach(key => localStorage.removeItem(key));
        Object.keys(sessionStorage).filter(key => key.startsWith('zadocs')).forEach(key => sessionStorage.removeItem(key));
      });
    } catch (_) {}
    await context.close();
    await browser.close();
    const leftover = await page.evaluate(() => localStorage.length).catch(() => null);
    console.log('TEST STORAGE CLEARED', leftover);
    if (!testPassed) console.log('TEST DID NOT PASS');
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
