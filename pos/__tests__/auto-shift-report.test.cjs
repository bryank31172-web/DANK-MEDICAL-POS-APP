/* Wiring checks for the six-page Auto Shift report and real PDF actions.
 *
 *   node pos/__tests__/auto-shift-report.test.cjs
 */
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..','..');
const src=fs.readFileSync(path.join(root,'pos','app.fixed.jsx'),'utf8');
const build=fs.readFileSync(path.join(root,'pos','build.sh'),'utf8');
const deployed=fs.readFileSync(path.join(root,'index.html'),'utf8');
let pass=0,total=0;
function check(ok,note){total++;if(ok){pass++;console.log('✓ '+note);}else console.error('✗ '+note);}

check(src.includes('const shiftReportBundle=function'),'report data and pages are built in the app');
check(src.includes('locPages.concat([payrollPage,validationPage,payoutPage])'),'three shop pages are followed by payroll, validation and payout');
check(src.includes('monthExpenses=(expenses||[]).filter'),'actual expenses are filtered to the selected roster month');
check(src.includes('EXPENSE_TARGETS.byCategory.wages'),'the report reconciles against the Finance wages budget');
check(src.includes('(transactions||[]).forEach')&&src.includes('(Array.isArray(txHistory)?txHistory:[])'),'local and StoreHub receipts feed attributed staff sales');
check(src.includes('var commission=Math.round(sales*2/100)'),'commission is 2% of attributed sales');
check(src.includes('t.staffServiceCharge||+t.serviceChargeStaffShare'),'bar service charge uses only an explicit staff-share field');
check(src.includes('Waiting for an explicit staff-share field; no estimate used'),'missing service charge is disclosed rather than invented');
check(src.includes('ดูรายงาน Report')&&src.includes('Live report connections'),'the PDF-style report and its data links are visible in Auto Shift');
check(src.includes('setFinView("expenses");setActiveTab("finance")'),'Actual Expense opens the existing Finance database');
check(src.includes('Download PDF')&&src.includes('Share PDF'),'download and share actions are present');
check(src.includes('.outputPdf("blob")'),'the actions generate a real PDF Blob');
check(src.includes('navigator.canShare({files:[file]})'),'mobile Web Share receives the PDF file');
check(build.includes('vendor/html2pdf.bundle.min.js'),'the PDF engine is bundled into both app builds');
check(fs.existsSync(path.join(root,'pos','vendor','html2pdf.bundle.min.js')),'the vendored PDF engine exists');
check(deployed.includes('html2pdf')&&deployed.includes('DANK Auto Shift Report'),'the committed deploy artifact contains the feature');

console.log('\n'+pass+'/'+total+' passed');
process.exit(pass===total?0:1);
