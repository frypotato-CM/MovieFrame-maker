'use strict';
/* MOVIE FRAME MAKER — 메인 스크립트 (설정값은 js/config.js 에 있습니다) */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const PER_DEF = {}; PER.forEach(k => PER_DEF[k] = DEFAULTS[k]);
const KEEP_ON_PRESET = [...PER, 'fmt','q','res','wSec'];
let S = {...DEFAULTS}, images = [], cur = -1, src = null;
const cv = $('#cv'), stage = $('#stage');
const pickPer = o => { const r = {}; PER.forEach(k => r[k] = o[k]); return r; };

/* ---------- 이미지 불러오기 (여러 장) ---------- */
function readImg(f, nameOverride){
  return new Promise((res, rej) => {
    if(f.size > MAX_FILE_MB*1048576) return rej('big');
    const url = URL.createObjectURL(f), img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if(img.naturalWidth*img.naturalHeight > MAX_PIXELS) return rej('big');
      const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth*k); c.height = Math.round(img.naturalHeight*k);
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      res({...PER_DEF, canvas:c, name: nameOverride || (f.name||'image').replace(/\.[^.]+$/,'') || 'image'});
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej('bad'); };
    img.src = url;
  });
}
async function addFiles(list, nameOverride){
  const files = [...list].filter(f => f.type.startsWith('image/'));
  if(!files.length) return;
  const room = MAX_IMAGES - images.length;
  if(room <= 0){ alert(`한 번에 최대 ${MAX_IMAGES}장까지 불러올 수 있습니다.`); return; }
  if(files.length > room) alert(`한 번에 최대 ${MAX_IMAGES}장까지 이미지를 불러올 수 있습니다. 앞의 ${room}장만 추가합니다.`);
  const added = []; let big = 0;
  for(const f of files.slice(0, room)){ try{ added.push(await readImg(f, nameOverride)); }catch(e){ if(e==='big') big++; } }
  if(big) alert(`파일이 너무 커서 ${big}장은 건너뛰었습니다. (최대 ${MAX_FILE_MB}MB, 1억 2천만 픽셀)`);
  if(!added.length){ if(!big) alert('이미지를 불러오지 못했습니다. 다른 파일을 선택해 주세요.'); return; }
  saveCur();
  const first = images.length; images.push(...added); loadCur(first);
}
$('#pick').onclick = $('#drop').onclick = () => $('#file').click();
$('#file').onchange = e => { addFiles(e.target.files); e.target.value=''; };
['dragenter','dragover'].forEach(n => stage.addEventListener(n, e => {e.preventDefault(); stage.classList.add('over');}));
['dragleave','drop'].forEach(n => stage.addEventListener(n, e => {e.preventDefault(); stage.classList.remove('over');}));
stage.addEventListener('drop', e => addFiles(e.dataTransfer.files));
document.addEventListener('paste', e => { const f=[...(e.clipboardData?.items||[])].filter(i=>i.type.startsWith('image/')).map(i=>i.getAsFile()); if(f.length) addFiles(f,'image'); });

/* ---------- 현재 이미지 전환 / 삭제 / 썸네일 ---------- */
function saveCur(){ if(cur>=0) PER.forEach(k => images[cur][k] = S[k]); }
function loadCur(n){
  cur = n; src = images[n].canvas; Object.assign(S, pickPer(images[n]));
  clampPan(S, src);
  stage.classList.add('has'); buildStrip(); sync(); draw();
}
function switchTo(i){ if(i===cur) return; saveCur(); loadCur(i); }
function removeImg(i){
  saveCur(); images.splice(i,1);
  if(!images.length){ cur=-1; src=null; stage.classList.remove('has'); buildStrip(); sync(); $('#warn').textContent=''; return; }
  loadCur(i<cur ? cur-1 : Math.min(i===cur ? i : cur, images.length-1));
}
let thumbs = [], thT = 0;
function buildStrip(){
  const el = $('#strip'); el.hidden = !images.length;
  el.innerHTML = images.map((m,i) => `<div class="th${i===cur?' on':''}" data-i="${i}"><canvas></canvas><button class="x" data-del="${i}" title="삭제">×</button></div>`).join('') + (images.length<MAX_IMAGES ? '<button class="addimg" id="addMore" title="이미지 추가">+</button>' : '');
  thumbs = $$('#strip canvas');
  updateShare();
}
$('#strip').addEventListener('click', e => {
  if(e.target.id==='addMore'){ $('#file').click(); return; }
  const x = e.target.closest('[data-del]'); if(x){ e.stopPropagation(); removeImg(+x.dataset.del); return; }
  const th = e.target.closest('.th'); if(th) switchTo(+th.dataset.i);
});
function drawThumbs(){ images.forEach((m,i) => { if(thumbs[i]) render(thumbs[i], 72, stateFor(i), m.canvas); }); }

/* 다른 이미지의 상태: 공통 설정 + 그 이미지의 위치값 (이동 범위는 이미지에 맞게 다시 계산) */
function stateFor(i){
  if(i===cur) return S;
  const P = {...S, ...pickPer(images[i])}, s = images[i].canvas;
  clampPan(P, s);
  return P;
}

/* ---------- 기하 계산 ----------
   이미지 비율(ratio)로 그림 영역(A:1)이 정해지고, 레터박스는 그 바깥에 여백만 추가합니다.
   단위: 그림 영역의 높이 = 1 */
function frameA(P, s){
  if(P.ratio==='custom') return P.frameCustom;
  if(P.ratio==='orig') return (P.rot%180===0) ? s.width/s.height : s.height/s.width;
  return typeof P.ratio==='number' ? P.ratio : 1.7778;
}
function barsOf(P, s){
  const A = frameA(P,s), R = P.lbPreset, z = {t:0,b:0,l:0,r:0};
  if(typeof R === 'number'){
    if(R === 0 || Math.abs(R-A) < 0.001) return z;
    if(R < A){ const e = (A/R - 1)/2; return {t:e,b:e,l:0,r:0}; }      // 최종 비율이 더 좁음 → 위아래 여백
    const e = (R - A)/2; return {t:0,b:0,l:e,r:e};                       // 최종 비율이 더 넓음 → 좌우 여백
  }
  return {t:P.lbTop/100, b:P.lbBot/100, l:0, r:0};
}
function geom(P, s){
  const A = frameA(P,s), bar = barsOf(P,s), Wu = A + bar.l + bar.r, Hu = 1 + bar.t + bar.b;
  const th = (P.rot + P.angle) * Math.PI/180, c = Math.abs(Math.cos(th)), sn = Math.abs(Math.sin(th));
  const iw = s.width, ih = s.height;
  const sb = Math.max((A*c + sn)/iw, (A*sn + c)/ih);   // 그림 영역을 빈틈없이 채우는 최소 배율
  return {A, bar, Wu, Hu, CA: Wu/Hu, th, iw, ih, sb, sc: sb*P.zoom};
}
function panOk(dx, dy, g){
  const co = Math.cos(g.th), si = Math.sin(g.th), hw = g.iw*g.sc/2 + 1e-6, hh = g.ih*g.sc/2 + 1e-6;
  for(const sx of [-1,1]) for(const sy of [-1,1]){
    const X = sx*g.A/2 - dx, Y = sy*0.5 - dy;
    if(Math.abs(X*co + Y*si) > hw || Math.abs(-X*si + Y*co) > hh) return false;
  }
  return true;
}
function clampPan(P, s){
  if(!s) return;
  const g = geom(P, s);
  if(panOk(P.px, P.py, g)) return;
  let lo = 0, hi = 1;
  for(let i=0;i<24;i++){ const m=(lo+hi)/2; panOk(P.px*m, P.py*m, g) ? lo=m : hi=m; }
  P.px *= lo; P.py *= lo;
}
function clampAxis(P, s, k){   // 슬라이더로 한 축만 움직였을 때, 그 축만 줄여서 범위 안으로
  const g = geom(P, s); if(panOk(P.px, P.py, g)) return;
  const v = P[k], test = x => k==='px' ? panOk(x,P.py,g) : panOk(P.px,x,g);
  if(!test(0)){ clampPan(P, s); return; }
  let lo = 0, hi = 1;
  for(let i=0;i<24;i++){ const m=(lo+hi)/2; test(v*m) ? lo=m : hi=m; }
  P[k] = v*lo;
}
function maxPan(P, s, axis){   // 한 방향으로 움직일 수 있는 최대 거리
  const g = geom(P, s); let lo = 0, hi = (g.iw+g.ih)*g.sc;
  for(let i=0;i<30;i++){ const m=(lo+hi)/2; (axis==='x' ? panOk(m,0,g) : panOk(0,m,g)) ? lo=m : hi=m; }
  return lo;
}

/* ---------- 글꼴: 글자 종류별로 지정된 글꼴을 사용 ---------- */
const reHangul=/[\uac00-\ud7a3\u1100-\u11ff\u3130-\u318f]/, reKana=/[\u3040-\u30ff\u31f0-\u31ff]/, reHan=/[\u3400-\u4dbf\u4e00-\u9fff]/, reLatin=/[A-Za-z0-9\u00c0-\u024f]/;
function segs(line, P){
  const kana = reKana.test(line), hang = reHangul.test(line); let prev = P.en;
  return [...line].map(ch => {
    let f;
    if(reHangul.test(ch)) f = P.ko; else if(reKana.test(ch)) f = P.ja;
    else if(reHan.test(ch)) f = kana ? P.ja : (hang ? P.ko : P.zh);
    else if(reLatin.test(ch)) f = P.en; else f = prev;
    prev = f; return {ch, f};
  });
}

/* ---------- 렌더링 (원본은 그대로, 매번 처음부터 다시 그림) ---------- */
function renderBase(P, s, outH){
  const g = geom(P,s), H = Math.max(1, Math.round(outH)), W = Math.max(1, Math.round(outH*g.CA)), k = H/g.Hu;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', {willReadFrequently:true});
  const ix = Math.round(g.bar.l*k), iy = Math.round(g.bar.t*k);
  const iw = Math.max(1, Math.min(Math.round(g.A*k), W-ix)), ih = Math.max(1, Math.min(Math.round(k), H-iy));
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,W,H);
  ctx.save();
  ctx.beginPath(); ctx.rect(ix,iy,iw,ih); ctx.clip();
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(ix + iw/2 + P.px*k, iy + ih/2 + P.py*k);
  ctx.rotate(g.th); ctx.scale(P.flip?-1:1, 1);
  const sc = g.sc*k; ctx.scale(sc,sc);
  ctx.drawImage(s, -g.iw/2, -g.ih/2);
  ctx.restore();
  const r = {ix,iy,iw,ih};
  if(P.gray){
    const d = ctx.getImageData(ix,iy,iw,ih), p = d.data;
    for(let i=0;i<p.length;i+=4){ const v = p[i]*.299+p[i+1]*.587+p[i+2]*.114; p[i]=p[i+1]=p[i+2]=v; }
    ctx.putImageData(d,ix,iy);
  }
  grad(ctx,r,'top',P.gTop,P.gTopAmt,P.gTopRange,P.gTopColor);
  grad(ctx,r,'bot',P.gBot,P.gBotAmt,P.gBotRange,P.gBotColor);
  if(P.grain && P.grainAmt>0){
    const d = ctx.getImageData(ix,iy,iw,ih), p = d.data, amp = P.grainAmt*0.8, rnd = mulberry32(123456789);
    for(let i=0;i<p.length;i+=4){ const n=(rnd()-.5)*amp; p[i]+=n; p[i+1]+=n; p[i+2]+=n; }
    ctx.putImageData(d,ix,iy);
  }
  canvas.info = r;
  return canvas;   // 이미지 + 흑백 + 그라데이션 + 그레인 (움직이지 않는 부분)
}
function renderFrame(canvas, base, P, phase){   // 기본 화면 위에 날씨 효과와 자막을 얹음
  const W = base.width, H = base.height;
  if(canvas.width !== W) canvas.width = W;
  if(canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext('2d', {willReadFrequently:true});
  ctx.drawImage(base,0,0);
  drawWeather(ctx,base.info,P,phase);
  return drawSub(ctx,W,H,base.info,P);
}
function render(canvas, outH, P, s, phase=0){ return renderFrame(canvas, renderBase(P,s,outH), P, phase); }

/* 난수 생성: mulberry32 (퍼블릭 도메인) */
function mulberry32(a){
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a>>>15, 1|a); t = t + Math.imul(t ^ t>>>7, 61|t) ^ t; return ((t ^ t>>>14)>>>0)/4294967296; };
}
function hexRgb(h, fb){
  if(!/^#[0-9a-f]{6}$/i.test(h)) h = fb;
  return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
}
/* 그라데이션: 어둡게 = 곱하기(multiply), 밝게 = 스크린(screen) */
function grad(ctx,r,pos,mode,amt,range,color){
  if(mode==='none' || amt<=0) return;
  const [R,G,B] = hexRgb(color, mode==='dark' ? '#000000' : '#ffffff');
  const top = pos==='top', len = r.ih*range/100;
  const g = ctx.createLinearGradient(0, top?r.iy:r.iy+r.ih, 0, top?r.iy+len:r.iy+r.ih-len);
  g.addColorStop(0, `rgba(${R},${G},${B},${amt/100})`); g.addColorStop(1, `rgba(${R},${G},${B},0)`);
  ctx.save(); ctx.globalCompositeOperation = mode==='dark' ? 'multiply' : 'screen';
  ctx.fillStyle = g; ctx.fillRect(r.ix,r.iy,r.iw,r.ih); ctx.restore();
}

/* 눈·비: 시간(phase 0~1)의 함수라서 처음과 끝이 자연스럽게 이어집니다 */
function mkParticles(seed, n){
  const rnd = mulberry32(seed);
  return Array.from({length:n}, () => ({x:rnd(), y:rnd(), r:rnd(), v:rnd(), ph:rnd(), a:rnd(), m:1+Math.floor(rnd()*2)}));
}
const PCACHE = {snow:mkParticles(1337,400), rain:mkParticles(7331,600)};
function drawWeather(ctx,r,P,phase){
  if(P.weather==='none') return;
  const k = r.ih/720, sp = (P.wSec/3)*P.wSpeed, snow = P.weather==='snow', tn = Math.tan((P.wDir||0)*Math.PI/180);
  const list = PCACHE[P.weather].slice(0, Math.round(P.wInt*(snow?3:5)));
  ctx.save(); ctx.beginPath(); ctx.rect(r.ix,r.iy,r.iw,r.ih); ctx.clip();
  if(snow){
    ctx.fillStyle = '#fff';
    for(const p of list){
      const c = Math.max(1, Math.round((p.v>0.7 ? 2 : 1)*sp)), y = (p.y + c*phase)%1;
      const x = (((p.x + 0.02*Math.sin(2*Math.PI*(p.m*phase + p.ph)))%1)+1)%1;
      ctx.globalAlpha = 0.4 + 0.6*p.a; ctx.beginPath(); ctx.arc(r.ix + x*r.iw, r.iy + y*r.ih, (1.2+p.r*2.8)*k, 0, 6.2832); ctx.fill();
    }
  } else {
    ctx.lineCap = 'round'; ctx.strokeStyle = '#dfe8ff';
    for(const p of list){
      const c = Math.max(1, Math.round((4 + Math.floor(p.v*3))*sp)), y = (p.y + c*phase)%1, yy = r.iy + y*r.ih, len = (0.04+0.04*p.r)*r.ih;
      const x = r.ix + ((((p.x + tn*y*r.ih/r.iw)%1)+1)%1)*r.iw;
      ctx.globalAlpha = 0.25 + 0.35*p.a; ctx.lineWidth = (0.8+p.r*0.8)*k;
      ctx.beginPath(); ctx.moveTo(x,yy); ctx.lineTo(x+len*tn, yy+len); ctx.stroke();
    }
  }
  ctx.restore();
}

/* 자막 */
function drawSub(ctx,W,H,r,P){
  if(!P.text.trim()) return false;
  const bT = r.iy, bB = H - r.iy - r.ih;
  const size = P.size*H/1080, ls = P.lsp/100*size, lh = size*P.lh;
  const fs = f => `${P.italic?'italic ':''}${P.bold?700:400} ${size}px "${f}",sans-serif`;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const L = P.text.split('\n').map(l => segs(l,P).map(o => { ctx.font = fs(o.f); o.w = ctx.measureText(o.ch).width; return o; }));
  const widths = L.map(a => a.reduce((s,o)=>s+o.w,0) + ls*Math.max(0,a.length-1));
  const maxW = Math.max(...widths), blockH = L.length*lh;
  const top = P.pos==='top', bar = top?bT:bB, margin = H*0.04;
  const onBar = P.place==='bar' && bar>0;
  let y0;
  if(onBar) y0 = top ? bar/2 - blockH/2 : H - bar/2 - blockH/2;
  else y0 = top ? bT + margin : H - bB - margin - blockH;
  y0 += P.y*H/100;
  // 가로: 레터박스 위면 캔버스 전체, 그림 위면 그림 영역 기준. 왼쪽/오른쪽 맞춤은 가장자리에서 8% 안쪽에 고정
  const hx = onBar ? 0 : r.ix, hw = onBar ? W : r.iw, sideM = hw*0.08;
  let cx = hx + hw/2;
  if(P.align==='left') cx = hx + sideM + maxW/2; else if(P.align==='right') cx = hx + hw - sideM - maxW/2;
  cx += P.x*hw/100;
  if(P.box){
    const px = size*0.5, py = size*0.2;
    ctx.globalAlpha = P.boxAlpha/100; ctx.fillStyle = P.boxColor;
    ctx.fillRect(cx-maxW/2-px, y0-py, maxW+px*2, blockH+py*2); ctx.globalAlpha = 1;
  }
  ctx.lineJoin = 'round'; ctx.lineWidth = P.strokeW*2*H/1080;   // 글자 바깥으로 보이는 두께 = 두께값(1080p 기준 px)
  ctx.strokeStyle = P.strokeColor; ctx.fillStyle = /^#[0-9a-f]{6}$/i.test(P.color) ? P.color : '#ffffff';
  const pass = fill => L.forEach((a,i) => {
    let x = P.align==='left' ? cx-maxW/2 : P.align==='right' ? cx+maxW/2-widths[i] : cx-widths[i]/2;
    const y = y0 + lh*i + lh/2;
    for(const o of a){ ctx.font = fs(o.f); fill ? ctx.fillText(o.ch,x,y) : ctx.strokeText(o.ch,x,y); x += o.w + ls; }
  });
  if(P.stroke) pass(false);
  pass(true);
  return maxW > hw*0.98;
}

/* ---------- 미리보기 ---------- */
let pvBase = null, animId = 0, lastT = 0;
function startAnim(){
  cancelAnimationFrame(animId);
  const tick = now => {
    if(!src || S.weather==='none') return;
    animId = requestAnimationFrame(tick);
    if(!pvBase || now-lastT < 66) return;   // 약 15프레임/초
    lastT = now; renderFrame(cv, pvBase, S, ((now/1000)%S.wSec)/S.wSec);
  };
  if(src && S.weather!=='none') animId = requestAnimationFrame(tick);
}
let raf = 0, loadedKey = '';
async function ensureFonts(){
  const texts = [S.text, ...images.filter((_,i)=>i!==cur).map(m=>m.text)];
  const key = [S.ko,S.en,S.ja,S.zh,S.bold,S.italic,texts.join('\u0001')].join('|');
  if(key === loadedKey) return; loadedKey = key;
  const need = {};
  texts.forEach(t => t.split('\n').forEach(l => segs(l,S).forEach(({ch,f}) => { need[f] = (need[f]||'') + ch; })));
  const style = `${S.italic?'italic ':''}${S.bold?700:400} 20px`;
  try{ await Promise.all(Object.entries(need).map(([f,t]) => document.fonts.load(`${style} "${f}"`, t))); }catch(e){}
}
function draw(){
  if(!src) return;
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(async () => {
    await ensureFonts();
    if(!src) return;
    const g = geom(S,src);
    pvBase = renderBase(S, src, Math.min(720, 960/g.CA));
    const over = renderFrame(cv, pvBase, S, 0);
    $('#warn').textContent = over ? '⚠ 자막이 화면 폭보다 깁니다. 줄바꿈하거나 크기를 줄여 주세요.' : '';
    clearTimeout(thT); thT = setTimeout(drawThumbs, 120);
    startAnim();
    estBytes = null; scheduleEst();
  });
}

/* ---------- 저장 크기 / 예상 용량 ---------- */
function outHeight(P, s){   // 최종 캔버스(여백 포함)의 세로 px
  const g = geom(P,s), lim = MAX_SIDE/Math.max(g.CA,1);
  const h = String(P.res)==='1080' ? 1080 : g.Hu/(g.sb*P.zoom);   // 원본: 이미지가 원본 화질 그대로 나오는 크기
  return Math.max(100, Math.round(Math.min(h, lim)));
}
function fmtBytes(n){
  if(n < 1048576) return Math.max(1,Math.round(n/1024)) + 'KB';
  if(n < 1073741824) return (n/1048576).toFixed(1) + 'MB';
  return (n/1073741824).toFixed(2) + 'GB';
}
let estBytes = null, estTok = 0, estT = 0;
function updateSizeInfo(){
  const el = $('#sizeInfo');
  if(!src){ el.textContent = ''; return; }
  const g = geom(S,src);
  if(S.fmt==='gif'){ const h = Math.min(720, Math.floor(MAX_SIDE/Math.max(g.CA,1))); el.textContent = `저장 크기: ${Math.round(h*g.CA)} × ${h}px · GIF 용량은 저장 후에 표시됩니다.`; return; }
  const h = outHeight(S,src);
  let t = `저장 크기: ${Math.round(h*g.CA)} × ${h}px · 용량 `;
  if(estBytes===null) t += '계산 중...';
  else { t += '약 ' + fmtBytes(estBytes); if(estBytes > 25*1048576) t += ' (용량이 큽니다. JPG나 1080을 권장합니다)'; }
  el.textContent = t;
}
function scheduleEst(){
  clearTimeout(estT); updateSizeInfo();
  if(!src || S.fmt==='gif' || !$('#p4').classList.contains('on')) return;
  estT = setTimeout(runEst, 600);
}
async function runEst(){   // 작은 크기로 실제 저장해 보고 면적 비율로 환산한 추정치
  const tok = ++estTok, P = S, s = src; if(!s) return;
  const g = geom(P,s), H = outHeight(P,s), eh = Math.min(H, 540), c = document.createElement('canvas');
  render(c, eh, P, s);
  const b = await toBlob(c);
  if(tok!==estTok || !b || s!==src) return;
  estBytes = b.size * (g.CA*H*H) / (c.width*c.height);
  updateSizeInfo();
}

/* ---------- 저장 ---------- */
const mime = () => S.fmt==='jpg' ? 'image/jpeg' : 'image/png', ext = () => S.fmt==='jpg' ? 'jpg' : 'png';
const toBlob = c => new Promise(r => c.toBlob(r, mime(), S.q/100));
const wait = () => new Promise(r => setTimeout(r, 20));
function download(blob, name){
  const u = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u),3000);
}
async function renderBlob(i){
  const P = stateFor(i), s = images[i].canvas, out = document.createElement('canvas');
  render(out, outHeight(P,s), P, s);
  return toBlob(out);
}
function uniqueName(m, used){
  let n = `${m.name}_영화편집`; used[n] = (used[n]||0) + 1;
  return (used[n]>1 ? `${n}(${used[n]})` : n) + '.' + ext();
}
let busy = false;
async function batch(label, fn){
  if(busy) return; busy = true; $$('#save,#saveAll,#share').forEach(b => b.disabled = true);
  let msg = '';
  try{ msg = (await fn()) || ''; }catch(e){ alert('저장에 실패했습니다. 사이즈를 1080으로 바꾸거나 이미지 수를 줄여 다시 시도해 주세요.'); }
  $('#prog').textContent = msg; busy = false; $$('#save,#saveAll,#share').forEach(b => b.disabled = false);
}
async function saveGif(){
  let G;
  try{ G = await import('https://cdn.jsdelivr.net/npm/gifenc@1.0.3/dist/gifenc.esm.js'); }
  catch(e){ alert('GIF 기능을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.'); return ''; }
  const {GIFEncoder, quantize, applyPalette} = G;
  const P = S, s = src, g = geom(P,s), H = Math.min(720, Math.floor(MAX_SIDE/Math.max(g.CA,1))), n = P.wSec*12;
  const base = renderBase(P,s,H), c = document.createElement('canvas');
  const grab = ph => { renderFrame(c, base, P, ph); return c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height).data; };
  $('#prog').textContent = '색상 분석 중...'; await wait();
  const a = grab(0), b = grab(0.5), sample = new Uint8ClampedArray(a.length + b.length);
  sample.set(a); sample.set(b, a.length);
  const palette = quantize(sample, 256), enc = GIFEncoder();
  for(let i=0;i<n;i++){
    $('#prog').textContent = `GIF 만드는 중... ${i+1} / ${n}`; await wait();
    enc.writeFrame(applyPalette(grab(i/n), palette), c.width, c.height, {palette, delay: Math.round(1000/12)});
  }
  enc.finish();
  const blob = new Blob([enc.bytes()], {type:'image/gif'});
  download(blob, `${images[cur].name}_영화편집.gif`);
  return `GIF 저장 완료 (약 ${(blob.size/1048576).toFixed(1)}MB)`;
}
$('#save').onclick = () => {
  if(!src){ alert('먼저 이미지를 넣어 주세요.'); return; }
  if(S.fmt==='gif'){ batch('', saveGif); return; }
  batch('', async () => { const b = await renderBlob(cur); if(!b) throw 0; download(b, `${images[cur].name}_영화편집.${ext()}`); });
};
$('#saveAll').onclick = () => batch('', async () => {
  if(typeof JSZip === 'undefined'){ alert('ZIP 기능을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.'); return; }
  const zip = new JSZip(), used = {};
  for(let i=0;i<images.length;i++){
    $('#prog').textContent = `저장 중... ${i+1} / ${images.length}`; await wait();
    const b = await renderBlob(i); if(!b) throw 0;
    zip.file(uniqueName(images[i], used), b);
  }
  $('#prog').textContent = '압축 중...'; await wait();
  download(await zip.generateAsync({type:'blob', compression:'STORE'}), '영화편집_모음.zip');
});
function canShareFiles(){ try{ return !!(navigator.canShare && navigator.canShare({files:[new File(['a'],'a.png',{type:'image/png'})]})); }catch(e){ return false; } }
let canShareCache = null;
function updateShare(){
  const gif = S.fmt==='gif'; if(canShareCache===null) canShareCache = canShareFiles();
  $('#share').hidden = !(images.length && canShareCache) || gif;
  $('#saveAll').hidden = images.length < 2 || gif;
  $('#save').textContent = gif ? 'GIF 저장' : (images.length > 1 ? '현재 이미지 저장' : '저장하기');
}
$('#share').onclick = () => batch('', async () => {
  const files = [], used = {};
  for(let i=0;i<images.length;i++){
    $('#prog').textContent = `준비 중... ${i+1} / ${images.length}`; await wait();
    const b = await renderBlob(i); if(!b) throw 0;
    files.push(new File([b], uniqueName(images[i], used), {type:mime()}));
  }
  try{ await navigator.share({files}); }catch(e){ if(e.name!=='AbortError') alert('공유 저장에 실패했습니다. ZIP 저장을 이용해 주세요.'); }
});

/* ---------- 미리보기 드래그 (마우스는 포인터 이벤트, 터치는 터치 이벤트) / 휠 확대 ---------- */
let drag = null;
function dragStart(x,y){ if(src) drag = {x, y, px:S.px, py:S.py}; }
function dragMove(x,y){
  if(!drag || !src) return;
  const r = cv.getBoundingClientRect(), ks = Math.min(r.width/cv.width, r.height/cv.height), k = cv.height/geom(S,src).Hu;
  S.px = drag.px + (x-drag.x)/ks/k;
  S.py = drag.py + (y-drag.y)/ks/k;
  clampPan(S, src); syncPan(); draw();
}
cv.addEventListener('pointerdown', e => { if(e.pointerType!=='mouse') return; dragStart(e.clientX, e.clientY); cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => { if(e.pointerType==='mouse') dragMove(e.clientX, e.clientY); });
['pointerup','pointercancel'].forEach(n => cv.addEventListener(n, e => { if(e.pointerType==='mouse') drag = null; }));
cv.addEventListener('touchstart', e => { if(e.touches.length!==1){ drag = null; return; } e.preventDefault(); const t = e.touches[0]; dragStart(t.clientX, t.clientY); }, {passive:false});
cv.addEventListener('touchmove', e => { if(!drag || e.touches.length!==1) return; e.preventDefault(); const t = e.touches[0]; dragMove(t.clientX, t.clientY); }, {passive:false});
['touchend','touchcancel'].forEach(n => cv.addEventListener(n, () => drag = null));
cv.addEventListener('wheel', e => {
  if(!src) return; e.preventDefault();
  S.zoom = Math.min(4, Math.max(1, S.zoom * (e.deltaY<0 ? 1.06 : 1/1.06)));
  clampPan(S, src); sync(); draw();
}, {passive:false});

/* ---------- UI 연결 ---------- */
const GEO = ['ratio','frameCustom','zoom','angle','rot'];
const num = v => /^-?\d+(\.\d+)?$/.test(v) ? parseFloat(v) : v;
function after(k){ if(src && GEO.includes(k)) clampPan(S, src); }
function syncPan(){
  let none = true;
  ['x','y'].forEach(a => {
    const el = $(`[data-pan="${a}"]`), m = src ? maxPan(S,src,a) : 0, v = a==='x' ? S.px : S.py, off = m < 1e-5;
    el.disabled = off; el.value = off ? 0 : Math.round(v/m*100);
    el.closest('.row').querySelector('.v').textContent = el.value;
    if(!off) none = false;
  });
  $('#panHint').hidden = !src || !none;
}
function sync(){
  if(S.fmt==='gif' && S.weather==='none') S.fmt = 'png';
  $$('[data-k]').forEach(el => { const v = S[el.dataset.k]; if(el.type==='checkbox') el.checked = !!v; else if(document.activeElement!==el) el.value = v; });
  $$('[data-set]').forEach(el => { const [k,v] = el.dataset.set.split('='); el.classList.toggle('on', String(S[k])===String(num(v))); });
  $$('[data-tog]').forEach(el => el.classList.toggle('on', !!S[el.dataset.tog]));
  $$('[data-pal]').forEach(box => box.querySelectorAll('.sw').forEach(b => b.classList.toggle('on', String(S[box.dataset.pal]).toLowerCase()===b.dataset.hex)));
  $$('[data-if]').forEach(el => {
    const m = el.dataset.if.match(/^(\w+)(!?=)(.*)$/);
    el.hidden = m ? (m[2]==='=' ? String(S[m[1]])!==m[3] : String(S[m[1]])===m[3]) : !S[el.dataset.if];
  });
  $$('.row>label .v').forEach(sp => { const i = sp.closest('.row').querySelector('[data-k]'); if(i) sp.textContent = i.value; });
  syncPan(); markPresets(); updateShare(); updateSizeInfo();
}
document.addEventListener('input', e => {
  const el = e.target;
  const pa = el.dataset?.pan;
  if(pa){
    if(!src) return;
    const v = el.value/100*maxPan(S,src,pa), key = pa==='x' ? 'px' : 'py';
    S[key] = v; clampAxis(S, src, key); sync(); draw(); return;
  }
  const k = el.dataset?.k; if(!k) return;
  S[k] = el.type==='checkbox' ? el.checked : (el.type==='range' ? parseFloat(el.value) : el.value);
  if((k==='lbTop' || k==='lbBot') && S.lbLink) S.lbTop = S.lbBot = S[k];
  after(k); sync(); draw();
});
const GRAD_DEF = {dark:'#000000', light:'#ffffff'};
document.addEventListener('click', e => {
  const t = e.target;
  const ext = t.closest('a[data-ext]');
  if(ext){ e.preventDefault(); askGo(ext.textContent, ext.href); return; }
  const rs = t.closest('.rs');
  if(rs){ e.preventDefault(); RESET_GROUPS[rs.dataset.reset].forEach(k => S[k] = DEFAULTS[k]); sync(); draw(); return; }
  const df = t.closest('[data-def]');
  if(df){ e.preventDefault(); df.dataset.def.split(',').forEach(k => { S[k] = DEFAULTS[k]; after(k); }); sync(); draw(); return; }
  const b = t.closest('[data-set]');
  if(b){
    const [k,v] = b.dataset.set.split('='), val = num(v);
    if(k==='lbPreset' && val==='custom' && typeof S.lbPreset==='number' && src){   // 지금 모양 그대로 직접 조절 시작
      const bar = barsOf(S,src); S.lbTop = Math.min(100, +(bar.t*100).toFixed(1)); S.lbBot = Math.min(100, +(bar.b*100).toFixed(1));
    }
    S[k] = val;
    if((k==='gTop' || k==='gBot') && (val==='dark' || val==='light')){   // 기본 흑/백 색이면 모드에 맞는 색으로
      const ck = k+'Color'; if(S[ck]==='#000000' || S[ck]==='#ffffff') S[ck] = GRAD_DEF[val];
    }
    after(k); sync(); draw(); return;
  }
  const tg = t.closest('[data-tog]');
  if(tg){ S[tg.dataset.tog] = !S[tg.dataset.tog]; sync(); draw(); return; }
  const ac = t.closest('[data-act]');
  if(ac){
    const a = ac.dataset.act;
    if(a==='rotL') S.rot = (S.rot+270)%360;
    if(a==='rotR') S.rot = (S.rot+90)%360;
    if(a==='flip') S.flip = !S.flip;
    if(a==='center') S.px = S.py = 0;
    if(a==='resetX') S.px = 0;
    if(a==='resetY') S.py = 0;
    after('rot'); sync(); draw();
  }
});
$$('#tabs button').forEach(b => b.onclick = () => {
  $$('#tabs button').forEach(x => x.classList.toggle('on', x===b));
  $$('.pane').forEach(p => p.classList.toggle('on', p.id===b.dataset.t));
  scheduleEst();
});

/* ---------- 외부 이동 확인 팝업 / 알림 ---------- */
let pendingUrl = '';
function askGo(name, url){
  if(!/^https:\/\//.test(url)) return;
  pendingUrl = url;
  $('#mdBody').textContent = `${name} (${new URL(url).hostname}) 페이지가 새 탭에서 열립니다.`;
  $('#modal').hidden = false; $('#mdOk').focus();
}
const closeModal = () => { $('#modal').hidden = true; pendingUrl = ''; };
$('#mdOk').onclick = () => { if(pendingUrl) window.open(pendingUrl, '_blank', 'noopener,noreferrer'); closeModal(); };
$('#mdCancel').onclick = closeModal;
$('#modal').addEventListener('click', e => { if(e.target.id==='modal') closeModal(); });
document.addEventListener('keydown', e => { if(e.key==='Escape' && !$('#modal').hidden) closeModal(); });
let toastT = 0;
function toast(msg){ const el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, 2200); }
async function shareSite(){
  const url = PROMO.shareUrl;
  try{
    if(navigator.clipboard && window.isSecureContext){
      await navigator.clipboard.writeText(url);
      toast('링크가 복사되었습니다.');
      return;
    }
  }catch(e){}

  try{
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    if(ok){
      toast('링크가 복사되었습니다.');
      return;
    }
  }catch(e){}

  prompt('아래 링크를 복사해 주세요.', url);
}

/* ---------- 글꼴 버튼 / 아이콘 / 팔레트 / 프리셋 / 홍보 타일 ---------- */
const svgIcon = key => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[key]}</svg>`;
for(const lang in FONTS){
  const box = $('#f_'+lang);
  FONTS[lang].forEach(f => {
    const b = document.createElement('button'); b.className = 'o'; b.dataset.set = `${lang}=${f.id}`;
    b.style.fontFamily = `'${f.show}',sans-serif`; b.textContent = f.label; box.appendChild(b);
  });
}
$$('[data-ic]').forEach(b => b.innerHTML = svgIcon(b.dataset.ic));
$$('[data-pal]').forEach(box => {
  GRAD_COLORS.forEach(c => {
    const b = document.createElement('button'); b.className = 'o sw'; b.dataset.set = `${box.dataset.pal}=${c.hex}`; b.dataset.hex = c.hex;
    b.style.background = c.hex; b.title = c.name; b.setAttribute('aria-label', c.name); box.appendChild(b);
  });
  const inp = document.createElement('input'); inp.type = 'text'; inp.dataset.k = box.dataset.pal; inp.maxLength = 7; inp.placeholder = '#000000'; inp.style.width = '100px';
  box.appendChild(inp);
});
const presetBtns = [];
function mkPresets(list, box, full){
  list.forEach(p => {
    const b = document.createElement('button'); b.className = 'o pr'; b.textContent = p.name;
    b.onclick = () => {
      if(full){ const keep = {}; KEEP_ON_PRESET.forEach(k => keep[k] = S[k]); S = {...DEFAULTS, ...keep, ...p.v}; }
      else Object.assign(S, p.v);
      if(src) clampPan(S, src); sync(); draw();
    };
    box.appendChild(b); presetBtns.push({b, p, full});
  });
}
function markPresets(){   // 현재 설정이 프리셋과 완전히 같을 때만 체크 표시
  presetBtns.forEach(({b,p,full}) => {
    const base = full ? {...DEFAULTS, ...p.v} : p.v;
    b.classList.toggle('on', Object.keys(base).every(k => (full && KEEP_ON_PRESET.includes(k)) || S[k]===base[k]));
  });
}
mkPresets(MY_PRESETS, $('#myPresets'), true);
mkPresets(STYLE_PRESETS, $('#stylePresets'), false);

(function buildPromo(){
  const box = $('#promo'), p = document.createElement('p'), grid = document.createElement('div');
  p.textContent = PROMO.text; grid.className = 'tiles';
  const tile = (label, onClick) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tile'; b.title = label; b.setAttribute('aria-label', label); b.onclick = onClick; return b;
  };
  const share = tile('공유', shareSite);
  share.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS.share}</svg>`;
  const lab = (b, t) => { const s = document.createElement('span'); s.textContent = t; b.appendChild(s); };
  lab(share, '공유'); grid.appendChild(share);
  PROMO.links.forEach(l => {
    const b = tile(l.label, () => askGo(l.name, l.url)), i = document.createElement('img');
    i.src = l.icon; i.alt = ''; b.appendChild(i); lab(b, l.label); grid.appendChild(b);
  });
  box.append(p, grid);
})();

$('#reset').onclick = () => {
  if(!confirm('모든 설정을 처음 상태로 되돌립니다. 이미지는 유지되며, 이미지별 위치와 자막 문구도 처음 상태로 돌아갑니다.')) return;
  S = {...DEFAULTS}; images.forEach(m => Object.assign(m, PER_DEF));
  sync(); draw();
};
$('#pick').textContent = `이미지 선택 (최대 ${MAX_IMAGES}장)`;
document.fonts.ready.then(() => { loadedKey=''; draw(); });
sync();
