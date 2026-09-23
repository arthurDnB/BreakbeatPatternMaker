const fs = require('node:fs');
const path = require('node:path');
const { marked } = require('C:/Users/arthu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/marked');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'Breakbeat Pattern Maker Project.md'), 'utf8');
const escape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const toc = [];
let body = marked.parse(source, {gfm:true});
body = body.replace(/<h2>(.*?)<\/h2>/g, (_, title) => {
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,'');
  toc.push({id,title});
  return `<h2 id="${id}">${title}</h2>`;
});
body = body.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>');
body = body.replace(/#([A-Fa-f0-9]{6})/g, (m, hex) => `<span class="swatch" style="background:#${hex}" aria-hidden="true"></span>${m}`);
const nav = toc.map(t=>`<a href="#${t.id}">${t.title}</a>`).join('\n');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Breakbeat Pattern Maker — Project specification</title>
<style>
:root { color-scheme:light; --ink:#17212c; --muted:#566270; --rule:#d9dfe5; --blue:#245b80; }
* {box-sizing:border-box} html {scroll-behavior:smooth;scroll-padding-top:30px}
body {margin:0;background:#f1f3f5;color:var(--ink);font:16px/1.65 'Segoe UI',Arial,sans-serif}
a {color:#1c597e;text-underline-offset:3px} a:hover {color:#102f46}
.skip {position:absolute;left:-9999px}.skip:focus {left:16px;top:10px;background:white;padding:10px;z-index:9}
aside {position:fixed;inset:0 auto 0 0;width:278px;overflow:auto;background:#e9edf0;padding:28px 20px 36px;border-right:1px solid var(--rule)}
.brand {font-size:12px;font-weight:700;letter-spacing:1.5px;color:#405466;margin-bottom:18px}
nav a {display:block;font-size:12px;line-height:1.4;text-decoration:none;padding:6px 10px;border-radius:4px;margin-bottom:1px;color:#384755}
nav a:hover,nav a.active {background:#d8e3eb;color:#111;font-weight:600}
.print {margin:20px 10px 0;border:1px solid #b4c1cb;background:white;padding:8px 14px;border-radius:5px;font:inherit;font-size:13px;cursor:pointer}
main {max-width:1110px;margin:28px 28px 56px 306px;background:white;padding:50px 56px 64px;border:1px solid var(--rule)}
h1,h2,h3 {color:#000;line-height:1.2;letter-spacing:-.02em}
h1 {font-size:42px;font-weight:700;margin:0 0 12px;max-width:720px}
h2 {font-size:27px;margin:56px 0 20px;scroll-margin-top:30px}
h2:first-of-type {font-size:21px;font-weight:500;margin:0 0 24px;letter-spacing:0}
h3 {font-size:19px;margin:32px 0 12px}
p {margin:0 0 17px} main>p:first-of-type {font-size:13px;color:var(--muted);margin-bottom:30px}
li {margin:7px 0} ul,ol {padding-left:25px;margin:14px 0 23px}
strong {font-weight:650}
.table-wrap {overflow-x:auto;margin:22px 0 26px}
table {width:100%;border-collapse:collapse;font-size:13px;line-height:1.5}
th,td {border:1px solid #d9d9d9;padding:11px 12px;vertical-align:top;text-align:left}
th {background:#253e52;color:white;font-weight:600}
tbody tr:nth-child(even) {background:#f3f6f8}
td:first-child {font-weight:600}
pre {background:#f3f5f7;border:1px solid #d9dfe5;padding:20px;overflow-x:auto;font:12px/1.65 Consolas,'Courier New',monospace;margin:22px 0 26px;tab-size:2}
code {font-family:Consolas,'Courier New',monospace;font-size:.9em} :not(pre)>code {background:#eef2f5;padding:2px 4px;border-radius:3px}
.swatch {display:inline-block;width:12px;height:12px;vertical-align:baseline;border:1px solid #66758455;margin-right:5px;border-radius:2px}
.tracker td:nth-child(3) {background:#fff0f1;color:#69262c}.tracker td:nth-child(4) {background:#edf5ff;color:#184b7c}.tracker td:nth-child(5) {background:#fff9dd;color:#584900}.tracker td:nth-child(6) {background:#f4effb;color:#5a397c}
.tracker td:nth-child(-n+7) {font-family:Consolas,monospace;font-size:12px;white-space:nowrap}
.tracker td.role-kick {background:#fff0f1;color:#69262c}.tracker td.role-snare {background:#edf5ff;color:#184b7c}.tracker td.role-hat {background:#fff9dd;color:#584900}.tracker td.role-percussion {background:#e8f6ee;color:#21543e}.tracker td.role-ghost {background:#e0f2ff;color:#255577;border-bottom-style:dashed}
.tracker td {padding:9px 8px}.tracker th {padding:10px 8px}.tracker td.empty {color:#8a939b;background:#fafbfc}
footer {margin-top:45px;color:#52606d;font-size:12px}
@media (min-width:1600px) {main {margin-left:calc(278px + (100vw - 1450px)/2)}}
@media (max-width:1050px) {aside {position:relative;width:auto;max-height:280px} nav {columns:2}main {margin:20px;padding:32px} .brand {margin-bottom:8px}}
@media (max-width:600px) {nav {columns:1}main {padding:24px 18px;margin:12px}h1 {font-size:32px}h2 {font-size:24px}body {font-size:15px}}
@media print {
@page {size:letter;margin:18mm 16mm}
body {background:white;font-size:10.5pt;line-height:1.45}
aside,.skip,footer {display:none} main {margin:0!important;padding:0;border:0;max-width:none}
h1 {font-size:29pt}h2 {font-size:18pt;margin-top:26pt;break-after:avoid}h3 {font-size:13pt;break-after:avoid}
p {orphans:3;widows:3}table {font-size:8.5pt}th,td {padding:6px 7px}thead {display:table-header-group}tr {break-inside:avoid}
.table-wrap {overflow:visible}pre {font-size:8pt;white-space:pre-wrap;overflow-wrap:anywhere;break-inside:auto}
a {color:#183e58;text-decoration:none}.tracker td:nth-child(-n+7) {font-size:8pt}.tracker td {padding:5px 4px}
* {-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
</style></head><body><a class="skip" href="#document">Skip to document</a>
<aside aria-label="Document navigation"><div class="brand">BREAKBEAT PATTERN MAKER</div><nav>${nav}</nav><button class="print" onclick="window.print()">Print document</button></aside>
<main id="document">${body}<footer>Breakbeat Pattern Maker · Product and implementation specification · September 2026</footer></main>
<script>
for(const table of document.querySelectorAll('table')){
 if(table.querySelector('th')?.textContent==='Row') {
  table.classList.add('tracker');
  for(const td of table.querySelectorAll('td')) if(td.textContent.trim()==='--')td.classList.add('empty');
  for(const row of table.querySelectorAll('tbody tr')){
   const cells=row.cells, note=cells[5].textContent.trim();
   if(note.startsWith('C-4'))cells[5].classList.add('role-kick');
   if(note.startsWith('C#4'))cells[5].classList.add('role-hat');
   if(note.startsWith('D#4'))cells[5].classList.add('role-percussion');
   if(note.startsWith('D-4'))cells[5].classList.add('role-snare');
   if(cells[7].textContent.toLowerCase().includes('ghost')){
    (note==='--'?cells[3]:cells[5]).classList.add('role-ghost');
   }
  }
 }
}
const links=[...document.querySelectorAll('nav a')];
const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){for(const a of links)a.classList.toggle('active',a.hash==='#'+entry.target.id)}}},{rootMargin:'0px 0px -70% 0px'});
document.querySelectorAll('h2').forEach(h=>observer.observe(h));
</script></body></html>`;
fs.writeFileSync(path.join(root,'Breakbeat Pattern Maker Project.html'),html);
const json = source.match(/```json\n([\s\S]*?)\n```/)[1];
JSON.parse(json);
console.log(JSON.stringify({words:source.split(/\s+/).length,sections:toc.length,numberedSections:toc.filter(x=>/^\d+ /.test(x.title)).length,htmlBytes:Buffer.byteLength(html),jsonExampleValid:true}));
