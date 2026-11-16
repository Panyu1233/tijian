const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  let testPassed = false;
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', error => errors.push('PAGEERROR ' + error.message));

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
    const files = fs.readdirSync(dir)
      .filter(name => /\.(docx|xls|xlsx|pdf)$/i.test(name))
      .map(name => path.join(dir, name));
    assert.equal(files.length, 4, '测试目录应包含 4 个上传文件');
    await page.setInputFiles('#enterpriseGlobalFileInput', files);
    await page.waitForFunction(() => !document.querySelector('#enterpriseImportSubmit').disabled);
    await page.click('#enterpriseImportSubmit');
    await page.waitForSelector('#enterpriseImportModal', { state: 'hidden', timeout: 120000 });
    await page.waitForTimeout(1200);

    await page.click('.nav-item[data-view="dashboard"]');
    await page.waitForTimeout(500);
    const reviewButtons = page.locator('#dashboardReviewList [data-doc-id]');
    const reviewCount = await reviewButtons.count();
    assert(reviewCount >= 2, '工作台应有可核查文件');
    for (let index = 0; index < reviewCount; index += 1) {
      const button = page.locator('#dashboardReviewList [data-doc-id]').nth(index);
      await button.click();
      await page.waitForSelector('#docModal', { state: 'visible' });
      if (await page.locator('#modalConfirmReview').isVisible()) {
        await page.click('#modalConfirmReview');
      } else {
        await page.click('#modalCancel');
      }
      await page.waitForSelector('#docModal', { state: 'hidden' });
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(700);

    const mappedCompany = await getCompany();
    assert(mappedCompany, '企业注册数据应存在');
    assert(mappedCompany.enterpriseMapping, '核查后应存在映射结果');
    const employeeCount = mappedCompany.enterpriseMapping.employees.length;
    assert(employeeCount > 0, '应映射出员工');
    console.log('MAPPED', JSON.stringify({
      company: mappedCompany.enterpriseMapping.profile.companyName,
      employees: employeeCount,
      positions: mappedCompany.enterpriseMapping.positions.length,
      detectionPoints: mappedCompany.enterpriseMapping.detectionPoints.length
    }));

    await page.click('.nav-item[data-view="generate"]');
    await page.waitForTimeout(700);
    const checks = page.locator('#generationTableBody .doc-check');
    const enabledChecks = page.locator('#generationTableBody .doc-check:not(:disabled)');
    const enabledCount = await enabledChecks.count();
    assert(enabledCount > 0, '核查后应存在可生成模板');
    console.log('GENERATION READY', enabledCount, 'SUMMARY', await page.locator('#generationReadySummary').innerText());
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
    console.log('GENERATED', generated.length, 'EMPLOYEE DOCS', employeeDocuments.length);

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
    assert(/\.doc$/i.test(download.suggestedFilename()), '下载文件应为 Word 可打开的 .doc');
    const downloadPath = path.join(__dirname, 'e2e-generated-document.doc');
    await download.saveAs(downloadPath);
    assert(fs.statSync(downloadPath).size > 500, '下载文件不应为空');
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
    console.log('ARCHIVE', JSON.stringify({ archiveRows, peopleRows, sourceRows }));
    await page.screenshot({ path: 'preview/e2e-complete-flow.png', fullPage: true });

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