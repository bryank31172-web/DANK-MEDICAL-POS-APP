/* Static and pure-function coverage for DANK SIRI voice + command routing. */
const fs=require('fs'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','app.fixed.jsx'),'utf8');
const guide=src.slice(src.indexOf('const TAB_GUIDE='),src.indexOf('// Weights display exactly'));
const helpers=src.slice(src.indexOf('function asstTabName('),src.indexOf('const ASST_SYSTEM='));
const {asstCommandFor,asstSpeechLang}=new Function(guide+helpers+';return {asstCommandFor,asstSpeechLang};')();
let pass=0,fail=0;function ok(n,c){console.log((c?'  ✓ ':'  ✗ ')+n);c?pass++:fail++;}
console.log('DANK SIRI commands');
ok('Thai opens stock',asstCommandFor('DANK SIRI เปิดสต๊อก').nav==='inventory');
ok('English opens POS',asstCommandFor('Hey DANK SIRI, open POS').nav==='pos');
ok('roster goes to work shifts',asstCommandFor('เปิดตารางกะ').nav==='workshifts');
ok('questions are not mistaken for commands',asstCommandFor('สต๊อกเหลือเท่าไหร่')===null);
ok('mutating command is guarded',asstCommandFor('เปิดหน้าขายแล้ว checkout').guarded===true);
ok('Thai speech voice',asstSpeechLang('เปิดสต๊อก')==='th-TH');
ok('English speech voice',asstSpeechLang('open stock')==='en-US');
console.log('\nDANK SIRI wiring');
ok('brand is visible',src.includes('🎙 DANK SIRI'));
ok('voice recognition fallback exists',src.includes('window.SpeechRecognition||window.webkitSpeechRecognition'));
ok('spoken replies exist',src.includes('window.SpeechSynthesisUtterance'));
ok('AI blocks automatic mutations',src.includes('ห้ามสั่งทำรายการที่เปลี่ยนข้อมูลร้านโดยอัตโนมัติ'));
console.log(`\n${fail?'FAIL':'PASS'} — ${pass} passed, ${fail} failed`);process.exit(fail?1:0);
