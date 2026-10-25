/* 6회차 연구 실습실 — 객체 탐지의 수학 (소프트맥스 · IoU · NMS · 정밀도/재현율)
   블랙박스 열기 수업모형 · 김태환. 모든 데이터는 수업용 가상 값이며 결정적(무작위 없음)입니다. */
"use strict";
const $ = id => document.getElementById(id);
const r3 = v => (Math.round(v*1000)/1000).toFixed(3);
const r2 = v => (Math.round(v*100)/100).toFixed(2);

/* ---------- 데이터: 급식판 (이미지 좌표 480×320, y는 아래로 증가) ---------- */
const IMG_W = 480, IMG_H = 320;
const CLS = ["밥","국","김치","계란말이","우유"];
const CC = {"밥":"#7fa8d4","국":"#a99ad4","김치":"#d98a7a","계란말이":"#e7c37a","우유":"#8bc0a4"};
const GT = [
  {id:"g1", cls:"밥",      b:[40,170,170,290]},
  {id:"g2", cls:"국",      b:[200,170,340,290]},
  {id:"g3", cls:"김치",    b:[40,40,140,140]},
  {id:"g4", cls:"계란말이", b:[170,50,240,130]},
  {id:"g5", cls:"계란말이", b:[200,50,270,130]},
  {id:"g6", cls:"우유",    b:[380,60,450,210]}];
const PRED0 = [
  {id:"A", cls:"밥",      s:0.94, b:[45,175,172,288]},
  {id:"B", cls:"밥",      s:0.71, b:[30,158,150,280]},
  {id:"C", cls:"국",      s:0.91, b:[198,168,336,292]},
  {id:"D", cls:"국",      s:0.48, b:[222,192,352,302]},
  {id:"E", cls:"김치",    s:0.83, b:[52,50,150,146]},
  {id:"F", cls:"계란말이", s:0.88, b:[168,52,242,132]},
  {id:"G", cls:"계란말이", s:0.58, b:[203,46,272,128]},
  {id:"H", cls:"김치",    s:0.36, b:[174,56,236,128]},
  {id:"I", cls:"우유",    s:0.77, b:[378,72,446,200]},
  {id:"J", cls:"김치",    s:0.42, b:[360,226,462,262]},
  {id:"K", cls:"우유",    s:0.62, b:[392,42,470,150]}];
const clone = a => a.map(p=>({...p, b:[...p.b]}));

/* ---------- 수학 본체 ---------- */
const area = b => Math.max(0,b[2]-b[0]) * Math.max(0,b[3]-b[1]);
function inter(a,b){
  const x1=Math.max(a[0],b[0]), y1=Math.max(a[1],b[1]), x2=Math.min(a[2],b[2]), y2=Math.min(a[3],b[3]);
  const w=Math.max(0,x2-x1), h=Math.max(0,y2-y1);
  return {x1,y1,x2,y2,w,h,a:w*h};
}
function iou(a,b){ const I=inter(a,b).a; const U=area(a)+area(b)-I; return U>0 ? I/U : 0; }
function softmax(z,T){ const e=z.map(v=>Math.exp(v/T)); const s=e.reduce((x,y)=>x+y,0); return {e,s,p:e.map(v=>v/s)}; }

/* NMS — 같은 종류끼리만 비교, IoU > thr 이면 제거. 단계 기록을 함께 돌려줌 */
function nmsSteps(preds, thr){
  const order=[...preds].sort((a,b)=>b.s-a.s);
  const st={}; preds.forEach(p=>st[p.id]="wait");
  const snap=(o)=>Object.assign({st:{...st}},o);
  const steps=[snap({t:"sort", order:order.map(p=>p.id), line:[0,1]})];
  const rest=[...order];
  while(rest.length){
    const best=rest.shift(); st[best.id]="pick";
    const same=rest.filter(p=>p.cls===best.cls);
    steps.push(snap({t:"pick", best:best.id, same:same.map(p=>p.id), other:rest.length-same.length, line:[2,3,4]}));
    for(const p of same){
      const v=iou(p.b,best.b), del=v>thr;
      if(del){ st[p.id]="del"; rest.splice(rest.indexOf(p),1); }
      steps.push(snap({t:"cmp", best:best.id, cur:p.id, iou:v, del, line:del?[5,6,7]:[5,6]}));
    }
    st[best.id]="keep";
  }
  steps.push(snap({t:"done", keep:order.filter(p=>st[p.id]==="keep").map(p=>p.id), line:[8]}));
  return steps;
}
function nms(preds,thr){ const s=nmsSteps(preds,thr); const last=s[s.length-1]; return preds.filter(p=>last.st[p.id]==="keep"); }

/* 정답 판정 — 신뢰도 순으로 같은 종류·짝 없는 정답 상자 중 IoU 최대와 비교 */
function evaluate(preds, conf, thr){
  const list=preds.filter(p=>p.s>=conf).sort((a,b)=>b.s-a.s);
  const used={}, res={};
  for(const p of list){
    let best=0, bg=null;
    for(const g of GT){ if(g.cls!==p.cls || used[g.id]) continue; const v=iou(p.b,g.b); if(v>best){best=v;bg=g;} }
    if(bg && best>=thr){ used[bg.id]=p.id; res[p.id]={ok:true, gt:bg.id, iou:best, why:"맞힘"}; continue; }
    // 실패 이유
    let why="없는 물체", gt=null, v=0;
    GT.forEach(g=>{ const t=iou(p.b,g.b); if(t>v){ v=t; gt=g.id; } });
    if(bg && best>0){ gt=bg.id; v=best; }
    const dup=GT.find(g=>g.cls===p.cls && used[g.id] && iou(p.b,g.b)>=thr);
    const anyIou=Math.max(0,...GT.map(g=>iou(p.b,g.b)));
    const wrong=GT.filter(g=>g.cls!==p.cls).find(g=>iou(p.b,g.b)>=thr);
    if(dup){ why="중복 ("+used[dup.id]+"가 먼저 맞힘)"; gt=dup.id; v=iou(p.b,dup.b); }
    else if(bg && best>0){ why="위치 부정확"; }
    else if(wrong){ why="종류 틀림 (실제 "+wrong.cls+")"; gt=wrong.id; v=iou(p.b,wrong.b); }
    else if(anyIou>0){ why=GT.find(g=>g.id===gt).cls===p.cls?"위치 부정확":"종류·위치 모두 틀림"; }
    res[p.id]={ok:false, gt, iou:v, why};
  }
  const tp=Object.values(res).filter(r=>r.ok).length, fp=list.length-tp, fn=GT.length-tp;
  return {list, res, used, tp, fp, fn, P: list.length? tp/list.length : null, R: tp/GT.length};
}

/* ---------- 캔버스 도우미 ---------- */
function setup(c){
  const dpr=window.devicePixelRatio||1, w=Math.max(10,c.clientWidth), ratio=+c.dataset.ratio||0.6667, h=Math.round(w*ratio);
  if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){ c.width=Math.round(w*dpr); c.height=Math.round(h*dpr); }
  c.style.height=h+"px";
  const g=c.getContext("2d"); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,w,h);
  return {g,w,h};
}
const FONT = px => px+"px Pretendard,'Malgun Gothic',sans-serif";
function rrect(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }

/* 손으로 그린 급식판 (이미지 좌표로 그림) */
function drawTray(g){
  g.fillStyle="#15161d"; g.fillRect(0,0,IMG_W,IMG_H);
  // 식판
  rrect(g,20,24,336,282,18); g.fillStyle="#2a313d"; g.fill(); g.strokeStyle="#3e4858"; g.lineWidth=2; g.stroke();
  [[30,32,120,116],[158,32,126,116],[292,32,56,116],[30,158,150,140],[190,158,158,140]].forEach(([x,y,w,h])=>{ rrect(g,x,y,w,h,12); g.fillStyle="#232934"; g.fill(); });
  // 밥
  g.fillStyle="#ece8dc"; g.beginPath(); g.ellipse(105,232,60,52,0,0,Math.PI*2); g.fill();
  g.fillStyle="#d8d3c4"; for(let i=0;i<26;i++){ const a=i*2.39, r=8+((i*37)%40); g.beginPath(); g.ellipse(105+Math.cos(a)*r,232+Math.sin(a)*r*0.85,3,1.6,a,0,Math.PI*2); g.fill(); }
  // 국
  g.fillStyle="#7c3a2a"; g.beginPath(); g.arc(270,230,62,0,Math.PI*2); g.fill();
  g.fillStyle="#c7613f"; g.beginPath(); g.arc(270,230,52,0,Math.PI*2); g.fill();
  g.fillStyle="#efe6d2"; [[250,214],[284,222],[262,246],[292,250]].forEach(([x,y])=>{ g.fillRect(x,y,11,11); });
  g.fillStyle="#5f8a4a"; [[240,238],[300,232],[276,205]].forEach(([x,y])=>{ g.beginPath(); g.ellipse(x,y,6,2.5,0.6,0,Math.PI*2); g.fill(); });
  // 김치
  for(let i=0;i<14;i++){ const x=52+((i*29)%78), y=52+((i*41)%74); g.fillStyle=i%3? "#c8462f":"#e06a45"; g.beginPath(); g.ellipse(x+6,y+6,15,8,i*0.7,0,Math.PI*2); g.fill(); }
  g.fillStyle="#f1d9b0"; [[70,70],[104,96],[84,118]].forEach(([x,y])=>{ g.beginPath(); g.ellipse(x,y,7,3,0.4,0,Math.PI*2); g.fill(); });
  // 계란말이 두 조각 (겹쳐 놓임)
  [[170,50,70,80],[200,50,70,80]].forEach(([x,y,w,h])=>{
    rrect(g,x,y,w,h,10); g.fillStyle="#f2cf62"; g.fill(); g.strokeStyle="#b8902e"; g.lineWidth=2; g.stroke();
    g.strokeStyle="rgba(150,110,30,.55)"; g.lineWidth=2; g.beginPath();
    for(let t=0;t<14;t+=0.2){ const rr=2+t*1.9, px=x+w/2+Math.cos(t)*rr*1.0, py=y+h/2+Math.sin(t)*rr*1.25; t===0?g.moveTo(px,py):g.lineTo(px,py); } g.stroke();
  });
  // 우유팩
  g.fillStyle="#e9eef3"; g.fillRect(380,90,70,120);
  g.fillStyle="#d6dde6"; g.beginPath(); g.moveTo(380,90); g.lineTo(415,62); g.lineTo(450,90); g.closePath(); g.fill();
  g.fillStyle="#cfd7e1"; g.fillRect(410,58,10,6);
  g.fillStyle="#4f7fc0"; g.fillRect(380,128,70,36);
  g.fillStyle="#fff"; g.font="bold 15px Pretendard,'Malgun Gothic',sans-serif"; g.textAlign="center"; g.fillText("우유",415,152);
  // 숟가락 (모델이 배운 적 없는 물체)
  g.fillStyle="#b9bec7"; g.beginPath(); g.ellipse(382,244,22,14,0,0,Math.PI*2); g.fill();
  g.fillRect(400,240,62,7); g.fillStyle="#d7dbe2"; g.beginPath(); g.ellipse(378,241,12,6,0,0,Math.PI*2); g.fill();
}

/* 상자 그리기 — 화면 픽셀 좌표계에서 (s = 배율) */
function drawBox(g,s,b,o){
  const x=b[0]*s, y=b[1]*s, w=(b[2]-b[0])*s, h=(b[3]-b[1])*s;
  g.save(); g.globalAlpha=o.alpha??1;
  if(o.fill){ g.fillStyle=o.fill; g.fillRect(x,y,w,h); }
  g.strokeStyle=o.color; g.lineWidth=o.lw||1.6; if(o.dash) g.setLineDash(o.dash);
  g.strokeRect(x,y,w,h); g.setLineDash([]);
  if(o.label){
    g.font=FONT(o.fs||11); const tw=g.measureText(o.label).width+8, th=(o.fs||11)+5;
    let ly = o.below ? y+h : y-th; if(ly<0) ly=y; if(ly+th>g.canvas.clientHeight) ly=y+h-th;
    let lx=Math.min(x, g.canvas.clientWidth-tw);
    g.fillStyle=o.color; g.fillRect(lx,ly,tw,th);
    g.fillStyle="#0c0d12"; g.textAlign="left"; g.textBaseline="top"; g.fillText(o.label,lx+4,ly+2.5); g.textBaseline="alphabetic";
  }
  g.restore();
}
function sceneBase(c){
  const {g,w,h}=setup(c), s=w/IMG_W;
  g.save(); g.scale(s,s); drawTray(g); g.restore();
  g.fillStyle="rgba(10,11,16,.28)"; g.fillRect(0,0,w,h);
  return {g,w,h,s};
}
function drawGT(g,s,opt={}){
  GT.forEach(t=>drawBox(g,s,t.b,{color:opt.miss&&opt.miss[t.id]?"#d98a7a":"rgba(255,255,255,.75)", dash:[5,4], lw:opt.miss&&opt.miss[t.id]?2:1.3,
    label: opt.label? (opt.miss&&opt.miss[t.id]? "놓침 · "+t.cls : null) : null, below:true, fs:10}));
}
function toImg(c,e){ const r=c.getBoundingClientRect(), s=r.width/IMG_W; return [(e.clientX-r.left)/s,(e.clientY-r.top)/s]; }
const inside = (b,x,y) => x>=b[0]&&x<=b[2]&&y>=b[1]&&y<=b[3];

/* ================= ① 소프트맥스 ================= */
const SM = {
  n:3, T:1, th:0.5, z:[2.0,1.0,0.1,-0.5,-1.0], note:"",
  init(){
    $("smN").onchange=()=>{ this.n=+$("smN").value; this.note=""; this.build(); this.render(); };
    $("smT").oninput=()=>{ this.T=+$("smT").value; this.note=""; this.render(); };
    $("smTh").oninput=()=>{ this.th=+$("smTh").value; this.render(); };
    document.querySelectorAll("[data-sm]").forEach(b=>b.onclick=()=>this.preset(b.dataset.sm));
    this.build(); this.render();
  },
  build(){
    $("smZ").innerHTML = CLS.slice(0,this.n).map((c,i)=>`<div class="zrow"><span><span class="sw" style="background:${CC[c]}"></span>${c}</span><input type="range" min="-3" max="5" step="0.01" value="${this.z[i]}" data-i="${i}"><span class="v" id="smz${i}"></span></div>`).join("");
    $("smZ").querySelectorAll("input").forEach(inp=>inp.oninput=()=>{ this.z[+inp.dataset.i]=+inp.value; this.note=""; this.render(); });
  },
  sync(){ $("smN").value=this.n; $("smT").value=this.T; this.build(); },
  preset(k){
    if(k==="hand"){ this.n=3; this.T=1; this.z=[2.0,1.0,0.1,-0.5,-1.0]; this.note="hand"; }
    if(k==="plus"){ for(let i=0;i<this.n;i++) this.z[i]=Math.min(5,Math.round((this.z[i]+1)*100)/100); this.note="plus"; }
    if(k==="neg"){ this.n=3; this.T=1; this.z=[1.5,-0.5,-2.0,-0.5,-1.0]; this.note="neg"; }
    if(k==="spoon"){ this.n=5; this.T=1; this.z=[0.3,0.1,1.22,0.2,0.0]; this.note="spoon"; }
    this.sync(); this.render();
  },
  render(){
    const n=this.n, T=this.T, z=this.z.slice(0,n), cls=CLS.slice(0,n), {e,s,p}=softmax(z,T);
    $("smTv").textContent=T.toFixed(2); $("smThv").textContent=this.th.toFixed(2);
    z.forEach((v,i)=>$("smz"+i).textContent=v.toFixed(2));
    const zs=z.reduce((a,b)=>a+b,0), top=p.indexOf(Math.max(...p));
    let h=`<tr><th>종류</th><th>z</th><th>z ÷ T</th><th>e<sup>z/T</sup></th><th>p = e ÷ 합</th><th>그냥 나누기 z÷Σz</th></tr>`;
    cls.forEach((c,i)=>{ const naive = Math.abs(zs)<1e-9 ? "÷0" : (z[i]/zs).toFixed(3);
      h+=`<tr${i===top?' class="sel"':''}><td class="l"><span class="sw" style="background:${CC[c]}"></span>${c}</td><td>${z[i].toFixed(2)}</td><td>${(z[i]/T).toFixed(3)}</td><td>${e[i].toFixed(3)}</td><td><b>${p[i].toFixed(3)}</b></td><td style="color:${(naive!=="÷0"&&(+naive<0||+naive>1))||naive==="÷0"?"var(--rose)":"inherit"}">${naive}</td></tr>`; });
    h+=`<tr><td class="l"><b>합</b></td><td>${zs.toFixed(2)}</td><td></td><td><b>${s.toFixed(3)}</b></td><td><b>${p.reduce((a,b)=>a+b,0).toFixed(3)}</b></td><td></td></tr>`;
    $("smTab").innerHTML=h;
    $("smBars").innerHTML=cls.map((c,i)=>`<div class="vb"><span>${c}</span><div class="tr"><div class="fl" style="width:${(p[i]*100).toFixed(1)}%;background:${CC[c]}"></div><div class="th" style="left:${(this.th*100).toFixed(1)}%"></div></div><span class="v">${p[i].toFixed(3)}</span></div>`).join("");
    const keep = p[top]>=this.th;
    let ex = `<b>지금 계산</b> · 분모 <span class="f">Σe = ${cls.map((c,i)=>e[i].toFixed(3)).join(" + ")} = ${s.toFixed(3)}</span><br>
      1등 <b>${cls[top]}</b>: <span class="f">${e[top].toFixed(3)} ÷ ${s.toFixed(3)} = ${p[top].toFixed(3)}</span> → 임계값 ${this.th.toFixed(2)} ${keep?"<b>이상이라 상자를 남깁니다</b>":"<b>미만이라 상자를 지웁니다</b>"}.`;
    const note={
      hand:"<br><b>손계산 예제</b> · e² ≈ 7.389, e¹ ≈ 2.718, e<sup>0.1</sup> ≈ 1.105, 합 ≈ 11.213 → 0.659, 0.242, 0.099. 점수는 2 : 1 : 0.1 이지만 확률은 약 6.7 : 2.5 : 1 로 1등이 더 벌어집니다.",
      plus:"<br><b>모든 점수에 +1</b> · e열은 모두 약 2.718배가 되었지만 p열은 그대로입니다(슬라이더 끝 5에 닿은 점수가 있으면 예외). 반면 &lsquo;그냥 나누기&rsquo; 열은 바뀌었습니다.",
      neg:"<br><b>음수 점수</b> · &lsquo;그냥 나누기&rsquo;는 합이 음수·0이 되면 음수 확률이나 1보다 큰 값을 내거나 계산이 안 됩니다(빨간 글씨). 지수함수는 언제나 양수라 문제가 없습니다.",
      spoon:"<br><b>함정 · 숟가락</b> · 숟가락은 보기 다섯 개 중 어디에도 없습니다. 점수가 모두 고만고만해도 확률의 합은 1이어야 하므로 김치가 0.420으로 1등이 됩니다. 임계값을 0.4로 낮추면 숟가락이 &lsquo;김치&rsquo;로 화면에 남습니다(⑤ 탭의 상자 J)."
    }[this.note]||"";
    $("smEx").innerHTML = ex + note + (T!==1?`<br><b>온도 T = ${T.toFixed(2)}</b> · ${T<1?"T가 1보다 작아 점수 차이가 커진 효과 → 1등 확률이 커집니다.":"T가 1보다 커 점수 차이가 줄어든 효과 → 확률이 고르게 퍼집니다."}`:"");
  }
};

/* ================= ② IoU 손계산 (정수 격자 12×9) ================= */
const IO = {
  GW:12, GH:9, A:[2,1,6,4], B:[4,2,8,6], step:5, drag:null, note:"hand",
  init(){
    const c=$("iouC");
    $("iouSteps").querySelectorAll("button").forEach(b=>b.onclick=()=>{ this.step=+b.dataset.s; this.render(); });
    $("iouNoMax").onchange=()=>this.render();
    document.querySelectorAll("[data-io]").forEach(b=>b.onclick=()=>this.preset(b.dataset.io));
    c.addEventListener("pointerdown",e=>this.down(e));
    c.addEventListener("pointermove",e=>this.move(e));
    c.addEventListener("pointerup",e=>{ this.drag=null; });
    c.addEventListener("pointercancel",()=>{ this.drag=null; });
  },
  geo(){ const c=$("iouC"), w=c.clientWidth, pad=Math.max(22,Math.min(34,w*0.06)), u=(w-2*pad)/this.GW; return {pad,u}; },
  unit(e){ const c=$("iouC"), r=c.getBoundingClientRect(), {pad,u}=this.geo(); return [(e.clientX-r.left-pad)/u,(e.clientY-r.top-pad)/u]; },
  down(e){
    const [x,y]=this.unit(e), tol=0.45;
    for(const k of ["B","A"]){ const b=this[k];
      if(Math.abs(x-b[2])<tol&&Math.abs(y-b[3])<tol){ this.drag={k,mode:"br"}; break; }
      if(Math.abs(x-b[0])<tol&&Math.abs(y-b[1])<tol){ this.drag={k,mode:"tl"}; break; } }
    if(!this.drag) for(const k of ["B","A"]){ const b=this[k]; if(inside(b,x,y)){ this.drag={k,mode:"move",ox:x,oy:y,b0:[...b]}; break; } }
    if(this.drag){ $("iouC").setPointerCapture(e.pointerId); e.preventDefault(); }
  },
  move(e){
    if(!this.drag) return; const [x,y]=this.unit(e), d=this.drag, b=this[d.k];
    const cl=(v,lo,hi)=>Math.max(lo,Math.min(hi,Math.round(v)));
    if(d.mode==="move"){ const w=d.b0[2]-d.b0[0], h=d.b0[3]-d.b0[1];
      const nx=cl(d.b0[0]+x-d.ox,0,this.GW-w), ny=cl(d.b0[1]+y-d.oy,0,this.GH-h); b[0]=nx;b[1]=ny;b[2]=nx+w;b[3]=ny+h; }
    else if(d.mode==="br"){ b[2]=cl(x,b[0]+1,this.GW); b[3]=cl(y,b[1]+1,this.GH); }
    else { b[0]=cl(x,0,b[2]-1); b[1]=cl(y,0,b[3]-1); }
    this.note=""; this.render();
  },
  preset(k){
    const P={hand:[[2,1,6,4],[4,2,8,6]], apart:[[1,1,4,3],[6,5,9,8]], inside:[[1,1,9,8],[3,3,6,6]], small:[[3,3,5,5],[4,3,6,5]], big:[[2,1,8,7],[3,1,9,7]]}[k];
    this.A=[...P[0]]; this.B=[...P[1]]; this.note=k; this.step=5;
    if(k==="apart") $("iouNoMax").checked=true; else $("iouNoMax").checked=false;
    this.render();
  },
  calc(){
    const A=this.A,B=this.B, noMax=$("iouNoMax").checked;
    const aA=(A[2]-A[0])*(A[3]-A[1]), aB=(B[2]-B[0])*(B[3]-B[1]);
    const x1=Math.max(A[0],B[0]), y1=Math.max(A[1],B[1]), x2=Math.min(A[2],B[2]), y2=Math.min(A[3],B[3]);
    const w=noMax? x2-x1 : Math.max(0,x2-x1), h=noMax? y2-y1 : Math.max(0,y2-y1);
    const I=w*h, U=aA+aB-I; return {aA,aB,x1,y1,x2,y2,w,h,I,U,v:U? I/U : 0, noMax};
  },
  render(){
    if(!$("p2").classList.contains("on")) return;
    const c=$("iouC"), {pad,u}=this.geo(), X=v=>pad+v*u, Y=v=>pad+v*u, k=this.calc(), A=this.A, B=this.B, st=this.step;
    const {g:g2}=setupFixed(c, Math.round(pad*2+this.GH*u));   // 높이를 격자에 맞춤
    // 격자
    g2.strokeStyle="rgba(255,255,255,.07)"; g2.lineWidth=1; g2.font=FONT(10); g2.fillStyle="#6d6f7d";
    for(let i=0;i<=this.GW;i++){ g2.beginPath(); g2.moveTo(X(i),Y(0)); g2.lineTo(X(i),Y(this.GH)); g2.stroke(); g2.textAlign="center"; g2.fillText(i,X(i),pad-7); }
    for(let j=0;j<=this.GH;j++){ g2.beginPath(); g2.moveTo(X(0),Y(j)); g2.lineTo(X(this.GW),Y(j)); g2.stroke(); g2.textAlign="right"; g2.fillText(j,pad-5,Y(j)+3.5); }
    g2.fillStyle="#9a9caa"; g2.textAlign="left"; g2.fillText("x→",2,11); g2.fillText("y↓",2,23);
    const rect=(b,col,fill,lw,dash)=>{ g2.save(); if(fill){g2.fillStyle=fill; g2.fillRect(X(b[0]),Y(b[1]),(b[2]-b[0])*u,(b[3]-b[1])*u);} g2.strokeStyle=col; g2.lineWidth=lw||2; if(dash) g2.setLineDash(dash); g2.strokeRect(X(b[0]),Y(b[1]),(b[2]-b[0])*u,(b[3]-b[1])*u); g2.restore(); };
    rect(A,"#7fa8d4", st===1?"rgba(127,168,212,.22)":"rgba(127,168,212,.08)");
    rect(B,"#e7c37a", st===1?"rgba(231,195,122,.22)":"rgba(231,195,122,.08)");
    if(st===4){ rect(A,"#f3f1ea",null,3); rect(B,"#f3f1ea",null,3); }
    // max/min 선
    if(st>=2){
      g2.save(); g2.setLineDash([4,4]); g2.strokeStyle="rgba(243,241,234,.65)"; g2.lineWidth=1.2;
      [[k.x1,"v"],[k.x2,"v"],[k.y1,"h"],[k.y2,"h"]].forEach(([v,t])=>{ g2.beginPath(); if(t==="v"){g2.moveTo(X(v),Y(0));g2.lineTo(X(v),Y(this.GH));} else {g2.moveTo(X(0),Y(v));g2.lineTo(X(this.GW),Y(v));} g2.stroke(); });
      g2.restore();
    }
    if(st>=3 && k.w>0 && k.h>0){ g2.fillStyle=st===5?"rgba(139,192,164,.55)":"rgba(139,192,164,.45)"; g2.fillRect(X(k.x1),Y(k.y1),k.w*u,k.h*u); }
    // 핸들과 이름
    [["A",A,"#7fa8d4"],["B",B,"#e7c37a"]].forEach(([n,b,col])=>{
      g2.fillStyle=col; [[b[0],b[1]],[b[2],b[3]]].forEach(([x,y])=>g2.fillRect(X(x)-5,Y(y)-5,10,10));
      g2.font="bold "+FONT(13); g2.textAlign="left"; g2.fillText(n,X(b[0])+6,Y(b[1])+16);
    });
    // 설명
    $("iouSteps").querySelectorAll("button").forEach(b=>{ const n=+b.dataset.s; b.classList.toggle("on",n===st); b.classList.toggle("done",n<st); });
    const L=(n,html)=>`<div class="${n>st?"dim":(n===st?"now":"")}">${html}</div>`;
    const wtxt = k.noMax? `${k.x2} − ${k.x1} = ${k.x2-k.x1}` : `max(0, ${k.x2} − ${k.x1}) = ${k.w}`;
    const htxt = k.noMax? `${k.y2} − ${k.y1} = ${k.y2-k.y1}` : `max(0, ${k.y2} − ${k.y1}) = ${k.h}`;
    let ex = `<div>A = (${A.join(", ")}), B = (${B.join(", ")})</div>`+
      L(1,`<b>1.</b> 넓이 A = (${A[2]}−${A[0]})×(${A[3]}−${A[1]}) = <b>${k.aA}</b>, 넓이 B = (${B[2]}−${B[0]})×(${B[3]}−${B[1]}) = <b>${k.aB}</b>`)+
      L(2,`<b>2.</b> 교집합 x1 = max(${A[0]}, ${B[0]}) = ${k.x1}, x2 = min(${A[2]}, ${B[2]}) = ${k.x2}<br>&nbsp;&nbsp;&nbsp; y1 = max(${A[1]}, ${B[1]}) = ${k.y1}, y2 = min(${A[3]}, ${B[3]}) = ${k.y2}`)+
      L(3,`<b>3.</b> 폭 = ${wtxt}, 높이 = ${htxt} → 교집합 = <b>${k.I}</b>`)+
      L(4,`<b>4.</b> 합집합 = ${k.aA} + ${k.aB} − ${k.I} = <b>${k.U}</b>`)+
      L(5,`<b>5.</b> IoU = ${k.I} ÷ ${k.U} = <b style="font-size:16px">${r3(k.v)}</b>${k.v>=0.5?" (0.5 이상)":" (0.5 미만)"}`);
    const note={
      hand:"<br><b>손계산 예제</b> · 교집합 4, 합집합 24 → IoU = 1/6 ≈ 0.167. 겹쳐 보이지만 IoU는 생각보다 작습니다.",
      apart:k.noMax&&k.I>0?"<br><b style='color:var(--rose)'>함정</b> · 떨어진 두 상자인데 폭 "+(k.x2-k.x1)+" × 높이 "+(k.y2-k.y1)+" = "+k.I+"로 &lsquo;겹친 넓이&rsquo;가 생겼습니다. 체크를 풀어 max(0, …)를 넣으면 0이 됩니다.":"",
      inside:"<br><b>포함</b> · 작은 상자가 큰 상자 안에 있으면 교집합 = 작은 상자, 합집합 = 큰 상자이므로 IoU = 작은 넓이 ÷ 큰 넓이입니다.",
      small:"<br><b>함정 · 작은 물체</b> · 2×2 상자가 한 칸 어긋나면 IoU = 2 ÷ 6 ≈ 0.333으로 0.5에 못 미칩니다.",
      big:"<br><b>비교 · 큰 물체</b> · 6×6 상자가 똑같이 한 칸 어긋나면 IoU = 30 ÷ 42 ≈ 0.714로 여전히 &lsquo;맞힘&rsquo;입니다."
    }[this.note]||"";
    $("iouEx").innerHTML = ex + note + (k.noMax&&this.note!=="apart"?"<br><b style='color:var(--rose)'>max(0, …) 없이 계산 중</b>":"");
  }
};
function setupFixed(c,h){
  const dpr=window.devicePixelRatio||1, w=c.clientWidth;
  if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){ c.width=Math.round(w*dpr); c.height=Math.round(h*dpr); }
  c.style.height=h+"px"; const g=c.getContext("2d"); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,w,h); return {g,w,h};
}

/* ================= ③ 정답 판정 ================= */
const EV = {
  preds:clone(PRED0), thr:0.5, sel:"B", drag:null,
  init(){
    const c=$("evC");
    $("evThr").oninput=()=>{ this.thr=+$("evThr").value; this.render(); };
    $("evLbl").onchange=()=>this.render();
    $("evReset").onclick=()=>{ this.preds=clone(PRED0); this.render(); };
    document.querySelectorAll("[data-ev]").forEach(b=>b.onclick=()=>{ this.thr=+b.dataset.ev; $("evThr").value=this.thr; if(this.thr===0.7) this.sel="E"; this.render(); });
    c.addEventListener("pointerdown",e=>{
      const [x,y]=toImg(c,e), cur=this.preds.find(p=>p.id===this.sel);
      let hit = cur && inside(cur.b,x,y) ? cur : null;
      if(!hit){ const hs=this.preds.filter(p=>inside(p.b,x,y)).sort((a,b)=>area(a.b)-area(b.b)); hit=hs[0]||null; }
      if(hit){ this.sel=hit.id; this.drag={x,y,b0:[...hit.b]}; c.setPointerCapture(e.pointerId); e.preventDefault(); this.render(); }
    });
    c.addEventListener("pointermove",e=>{
      if(!this.drag) return; const [x,y]=toImg(c,e), p=this.preds.find(p=>p.id===this.sel), b0=this.drag.b0;
      const w=b0[2]-b0[0], h=b0[3]-b0[1];
      const nx=Math.max(0,Math.min(IMG_W-w,Math.round(b0[0]+x-this.drag.x))), ny=Math.max(0,Math.min(IMG_H-h,Math.round(b0[1]+y-this.drag.y)));
      p.b=[nx,ny,nx+w,ny+h]; this.render();
    });
    const up=()=>{ this.drag=null; }; c.addEventListener("pointerup",up); c.addEventListener("pointercancel",up);
  },
  render(){
    $("evThrv").textContent=this.thr.toFixed(2);
    const R=evaluate(this.preds,0,this.thr), lbl=$("evLbl").checked, sp=this.preds.find(p=>p.id===this.sel), rs=R.res[this.sel];
    if($("p3").classList.contains("on")){
      const {g,s}=sceneBase($("evC"));
      const miss={}; GT.forEach(t=>{ if(!R.used[t.id]) miss[t.id]=1; });
      drawGT(g,s,{miss,label:lbl});
      const mate = rs && rs.gt ? GT.find(t=>t.id===rs.gt) : null;
      if(mate){ const I=inter(sp.b,mate.b); if(I.a>0){ g.fillStyle="rgba(139,192,164,.35)"; g.fillRect(I.x1*s,I.y1*s,I.w*s,I.h*s); } drawBox(g,s,mate.b,{color:"#f3f1ea",lw:2.2,dash:[6,3]}); }
      R.list.slice().reverse().forEach(p=>{ const ok=R.res[p.id].ok, on=p.id===this.sel;
        drawBox(g,s,p.b,{color:on?"#e7c37a":(ok?"#8bc0a4":"#d98a7a"), lw:on?3:1.6, alpha:on?1:0.9, label:(lbl||on)? `${p.id} ${p.cls} ${p.s.toFixed(2)}`:null, fs:10.5}); });
    }
    // 지표
    $("evMet").innerHTML=`<div><div class="l">TP 맞힘</div><div class="v" style="color:var(--green)">${R.tp}</div></div><div><div class="l">FP 헛짚음</div><div class="v" style="color:var(--rose)">${R.fp}</div></div><div><div class="l">FN 놓침</div><div class="v">${R.fn}</div></div><div><div class="l">정밀도</div><div class="v">${r3(R.P)}</div><div class="s">${R.tp}/${R.tp+R.fp}</div></div><div><div class="l">재현율</div><div class="v">${r3(R.R)}</div><div class="s">${R.tp}/${GT.length}</div></div>`;
    // 표
    let h=`<tr><th>상자</th><th class="l">종류</th><th>신뢰도</th><th class="l">짝 후보</th><th>IoU</th><th class="l">판정</th></tr>`;
    R.list.forEach(p=>{ const r=R.res[p.id], gt=r.gt?GT.find(t=>t.id===r.gt):null;
      h+=`<tr class="click${p.id===this.sel?" sel":""}" data-id="${p.id}"><td><b>${p.id}</b></td><td class="l"><span class="sw" style="background:${CC[p.cls]}"></span>${p.cls}</td><td>${p.s.toFixed(2)}</td><td class="l">${gt? gt.cls+" ("+gt.id+")":"—"}</td><td>${gt? r3(r.iou):"0.000"}</td><td class="l"><span class="tag2 ${r.ok?"tp":"fp"}">${r.ok?"TP":"FP"}</span> ${r.ok?"":r.why}</td></tr>`; });
    GT.filter(t=>!R.used[t.id]).forEach(t=>{ h+=`<tr><td>${t.id}</td><td class="l">${t.cls}</td><td>—</td><td class="l">정답 상자</td><td></td><td class="l"><span class="tag2 fn">FN</span> 놓침</td></tr>`; });
    $("evTab").innerHTML=h;
    $("evTab").querySelectorAll("tr.click").forEach(tr=>tr.onclick=()=>{ this.sel=tr.dataset.id; this.render(); });
    // 설명 (고른 상자의 IoU 손계산)
    if(sp && rs){
      const gt=rs.gt?GT.find(t=>t.id===rs.gt):null;
      if(gt){ const a=sp.b,b=gt.b,I=inter(a,b),aA=area(a),aB=area(b),U=aA+aB-I.a;
        $("evEx").innerHTML=`<b>상자 ${sp.id}</b> (${sp.cls} ${sp.s.toFixed(2)}) = (${a.join(", ")}) &nbsp;vs&nbsp; <b>정답 ${gt.id}</b> (${gt.cls}) = (${b.join(", ")})<br>
         넓이 ${sp.id} = ${a[2]-a[0]}×${a[3]-a[1]} = ${aA}, 넓이 ${gt.id} = ${b[2]-b[0]}×${b[3]-b[1]} = ${aB}<br>
         교집합 = (min(${a[2]},${b[2]}) − max(${a[0]},${b[0]})) × (min(${a[3]},${b[3]}) − max(${a[1]},${b[1]})) = ${I.w}×${I.h} = ${I.a}<br>
         IoU = ${I.a} ÷ (${aA} + ${aB} − ${I.a}) = ${I.a} ÷ ${U} = <b>${r3(I.a/U)}</b> ${I.a/U>=this.thr?"≥":"<"} ${this.thr.toFixed(2)}<br>
         판정 · <span class="tag2 ${rs.ok?"tp":"fp"}">${rs.ok?"TP":"FP"}</span> ${rs.ok?"같은 종류이고 IoU가 임계값 이상입니다.":rs.why+" — "+({"위치 부정확":"종류는 맞지만 겹침이 부족합니다.","없는 물체":"겹치는 정답 상자가 없습니다.","종류·위치 모두 틀림":"가장 많이 겹친 물체와 종류도 다르고 겹침도 부족합니다."}[rs.why]||(rs.why.startsWith("중복")?"같은 물체는 한 번만 맞힌 것으로 셉니다. 남는 상자는 FP입니다.":"위치는 맞지만 이름이 틀렸습니다."))}`;
      } else $("evEx").innerHTML=`<b>상자 ${sp.id}</b> (${sp.cls} ${sp.s.toFixed(2)}) = (${sp.b.join(", ")})<br>겹치는 정답 상자가 하나도 없습니다(모든 IoU = 0). <span class="tag2 fp">FP</span> 없는 물체 — ${sp.id==="J"?"숟가락은 모델이 배운 음식이 아닌데도 &lsquo;김치&rsquo;라는 이름을 받았습니다.":"상자를 정답 상자 쪽으로 끌어 보세요."}`;
    }
  }
};

/* ================= ④ NMS 단계별 ================= */
const NM = {
  thr:0.5, i:0, steps:[], timer:null,
  CODE:["order = sorted(boxes, key=lambda b: b.score, reverse=True)","keep = []","while order:","    best = order.pop(0)          # 남은 것 중 신뢰도 1등","    keep.append(best)","    for b in order[:]:","        if b.cls == best.cls and iou(b, best) > thr:","            order.remove(b)          # 겹침이 커서 중복으로 보고 제거","return keep"],
  init(){
    $("nmThr").oninput=()=>{ this.thr=+$("nmThr").value; this.rebuild(); };
    $("nmFirst").onclick=()=>{ this.stop(); this.i=0; this.render(); };
    $("nmPrev").onclick=()=>{ this.stop(); this.i=Math.max(0,this.i-1); this.render(); };
    $("nmNext").onclick=()=>{ this.stop(); this.i=Math.min(this.steps.length-1,this.i+1); this.render(); };
    $("nmLast").onclick=()=>{ this.stop(); this.i=this.steps.length-1; this.render(); };
    $("nmPlay").onclick=()=>{ if(this.timer){ this.stop(); return; } if(this.i>=this.steps.length-1) this.i=0; $("nmPlay").textContent="❚❚ 멈춤";
      this.timer=setInterval(()=>{ if(this.i>=this.steps.length-1){ this.stop(); return; } this.i++; this.render(); },900); };
    document.querySelectorAll("[data-nm]").forEach(b=>b.onclick=()=>{ this.thr=+b.dataset.nm; $("nmThr").value=this.thr; this.rebuild(); });
    this.rebuild();
  },
  stop(){ if(this.timer){ clearInterval(this.timer); this.timer=null; } $("nmPlay").textContent="▶ 자동 재생"; },
  rebuild(){ this.stop(); this.steps=nmsSteps(PRED0,this.thr); this.i=0; $("nmThrv").textContent=this.thr.toFixed(2); this.render(); },
  render(){
    const S=this.steps[this.i], st=S.st, P=id=>PRED0.find(p=>p.id===id);
    $("nmCode").innerHTML=this.CODE.map((l,k)=>`<div class="${S.line.includes(k)?"hl":""}">${l.replace(/#.*/,m=>`<span class="c">${m}</span>`)}</div>`).join("");
    if($("p4").classList.contains("on")){
      const {g,s}=sceneBase($("nmC"));
      drawGT(g,s);
      const ord=[...PRED0].sort((a,b)=>a.s-b.s);
      ord.forEach(p=>{ const v=st[p.id]; if(v==="del") drawBox(g,s,p.b,{color:"#6d6f7d",dash:[3,3],alpha:.6}); });
      ord.forEach(p=>{ const v=st[p.id]; if(v==="del") return;
        const isBest=S.best===p.id, isCur=S.cur===p.id;
        if(isBest||isCur) return;
        drawBox(g,s,p.b,{color:v==="keep"?"#8bc0a4":CC[p.cls], lw:v==="keep"?2.2:1.4, alpha:v==="keep"?1:.75, label:`${p.id} ${p.s.toFixed(2)}`, fs:10}); });
      if(S.cur){ const a=P(S.best).b,b=P(S.cur).b,I=inter(a,b); if(I.a>0){ g.fillStyle=S.del?"rgba(217,138,122,.45)":"rgba(127,168,212,.35)"; g.fillRect(I.x1*s,I.y1*s,I.w*s,I.h*s); }
        drawBox(g,s,b,{color:S.del?"#d98a7a":"#7fd4ff",lw:2.6,label:`${S.cur} ${P(S.cur).s.toFixed(2)} · IoU ${r3(S.iou)}`,fs:11,below:true}); }
      if(S.best) drawBox(g,s,P(S.best).b,{color:"#e7c37a",lw:3.2,label:`${S.best} ${P(S.best).cls} ${P(S.best).s.toFixed(2)} (남김)`,fs:11});
    }
    // 설명
    let ex="";
    if(S.t==="sort") ex=`<b>단계 1 · 정렬</b> · 상자 11개를 신뢰도가 높은 순서로 줄 세웁니다.<br><span style="font-family:var(--mono);font-size:12px;color:var(--tx)">${S.order.map(id=>id+" "+P(id).s.toFixed(2)).join(" &gt; ")}</span>`;
    if(S.t==="pick") ex=`<b>남은 것 중 1등 · ${S.best} (${P(S.best).cls} ${P(S.best).s.toFixed(2)})</b>을(를) 확정합니다.<br>`+(S.same.length?`같은 종류 ${S.same.join(", ")}와(과) 차례로 IoU를 재어 ${this.thr.toFixed(2)}보다 크면 지웁니다.`:`남은 상자 중 같은 종류(${P(S.best).cls})가 없어 비교할 것이 없습니다.`)+(S.other?` 다른 종류 ${S.other}개는 건너뜁니다.`:"");
    if(S.t==="cmp"){ const a=P(S.best).b,b=P(S.cur).b,I=inter(a,b),U=area(a)+area(b)-I.a;
      ex=`<b>비교 · ${S.best} vs ${S.cur}</b> (${P(S.cur).cls})<br>교집합 ${I.w}×${I.h} = ${I.a}, 합집합 ${area(a)} + ${area(b)} − ${I.a} = ${U}<br>IoU = ${I.a} ÷ ${U} = <b>${r3(S.iou)}</b> ${S.del?">":"≤"} ${this.thr.toFixed(2)} → ${S.del?`<span class="tag2 del">제거</span> ${S.best}와(과) 같은 물체를 가리킨다고 봅니다.`:`<span class="tag2 keep">유지</span> 다른 물체일 수 있다고 보고 남겨 둡니다.`}`;
      if(S.cur==="G"&&S.del) ex+=`<br><b style="color:var(--rose)">함정</b> · G는 실제로 두 번째 계란말이(g5)를 가리키는 상자였습니다. 임계값이 낮아 진짜 물체가 사라졌습니다.`;
      if((S.cur==="B"||S.cur==="D")&&!S.del) ex+=`<br><b style="color:var(--rose)">주의</b> · ${S.cur}는 같은 음식을 가리키는 중복 상자인데 임계값이 높아 살아남았습니다.`;
    }
    if(S.t==="done") ex=`<b>끝</b> · 남은 상자 ${S.keep.length}개: <span class="f">${S.keep.join(", ")}</span><br>지운 상자: ${PRED0.filter(p=>st[p.id]==="del").map(p=>p.id).join(", ")||"없음"}. ⑤ 탭의 &lsquo;NMS 먼저 적용&rsquo;은 임계값 0.5로 이 결과를 씁니다.`;
    $("nmEx").innerHTML=`<div class="mini2" style="margin-bottom:4px">단계 ${this.i+1} / ${this.steps.length}</div>`+ex;
    // 표
    const order=[...PRED0].sort((a,b)=>b.s-a.s), nm={wait:["wait","대기"],pick:["pick","선택"],keep:["keep","확정"],del:["del","제거"]};
    let h=`<tr><th>순위</th><th>상자</th><th class="l">종류</th><th>신뢰도</th><th class="l">상태</th></tr>`;
    order.forEach((p,k)=>{ const v=st[p.id]; h+=`<tr class="${p.id===S.best||p.id===S.cur?"sel":""}"><td>${k+1}</td><td><b>${p.id}</b></td><td class="l"><span class="sw" style="background:${CC[p.cls]}"></span>${p.cls}</td><td>${p.s.toFixed(2)}</td><td class="l"><span class="tag2 ${nm[v][0]}">${p.id===S.cur?(S.del?"제거":"비교 · 유지"):nm[v][1]}</span></td></tr>`; });
    $("nmTab").innerHTML=h;
    // 기록
    const lines=this.steps.slice(1,this.i+1).map(t=> t.t==="pick"?`${t.best} 확정`: t.t==="cmp"?`&nbsp;&nbsp;${t.best}–${t.cur} IoU ${r3(t.iou)} → ${t.del?"제거":"유지"}`: `완료 · 남은 상자 ${t.keep.join(", ")}`);
    $("nmLog").innerHTML = (["정렬"].concat(lines)).map((l,k,a)=>`<div class="${k===a.length-1?"cur":""}">${l}</div>`).join("");
    $("nmLog").scrollTop=$("nmLog").scrollHeight;
  }
};

/* ================= ⑤ 정밀도·재현율 ================= */
const PR = {
  conf:0.5, iouT:0.5,
  init(){
    $("prConf").oninput=()=>{ this.conf=+$("prConf").value; this.render(); };
    $("prIou").oninput=()=>{ this.iouT=+$("prIou").value; this.render(); };
    $("prNms").onchange=()=>this.render();
    document.querySelectorAll("[data-pr]").forEach(b=>b.onclick=()=>{ this.conf=+b.dataset.pr; $("prConf").value=this.conf; this.render(); });
  },
  base(){ return $("prNms").checked ? nms(PRED0,0.5) : PRED0; },
  render(){
    const base=this.base(), R=evaluate(base,this.conf,this.iouT);
    $("prConfv").textContent=this.conf.toFixed(2); $("prIouv").textContent=this.iouT.toFixed(2);
    $("prMet").innerHTML=`<div><div class="l">남긴 상자</div><div class="v">${R.list.length}</div></div><div><div class="l">TP</div><div class="v" style="color:var(--green)">${R.tp}</div></div><div><div class="l">FP</div><div class="v" style="color:var(--rose)">${R.fp}</div></div><div><div class="l">FN</div><div class="v">${R.fn}</div></div><div><div class="l">정밀도</div><div class="v">${R.P===null?"—":r3(R.P)}</div><div class="s">${R.tp}/${R.tp+R.fp}</div></div><div><div class="l">재현율</div><div class="v">${r3(R.R)}</div><div class="s">${R.tp}/${GT.length}</div></div>`;
    // 곡선용 점 (각 신뢰도마다)
    const ths=[...new Set(base.map(p=>p.s))].sort((a,b)=>b-a);
    const pts=ths.map(t=>{ const e=evaluate(base,t,this.iouT); return {t,P:e.P,R:e.R}; });
    if($("p5").classList.contains("on")){
      const {g,s}=sceneBase($("prC")); const miss={}; GT.forEach(t=>{ if(!R.used[t.id]) miss[t.id]=1; });
      drawGT(g,s,{miss,label:true});
      R.list.slice().reverse().forEach(p=>{ const ok=R.res[p.id].ok; drawBox(g,s,p.b,{color:ok?"#8bc0a4":"#d98a7a",lw:2,label:`${p.id} ${p.cls} ${p.s.toFixed(2)}`,fs:10.5}); });
      // P-R 그래프
      const {g:q,w,h}=setup($("prPlot")), L=40,T=14,Rr=w-14,B=h-34, X=v=>L+v*(Rr-L), Y=v=>B-v*(B-T);
      q.strokeStyle="rgba(255,255,255,.08)"; q.fillStyle="#6d6f7d"; q.font=FONT(10);
      for(let i=0;i<=5;i++){ const v=i/5; q.beginPath(); q.moveTo(X(v),T); q.lineTo(X(v),B); q.stroke(); q.beginPath(); q.moveTo(L,Y(v)); q.lineTo(Rr,Y(v)); q.stroke();
        q.textAlign="center"; q.fillText(v.toFixed(1),X(v),B+13); q.textAlign="right"; q.fillText(v.toFixed(1),L-5,Y(v)+3); }
      q.fillStyle="#9a9caa"; q.textAlign="center"; q.fillText("재현율 (찾아낸 비율)",(L+Rr)/2,B+28);
      q.save(); q.translate(11,(T+B)/2); q.rotate(-Math.PI/2); q.fillText("정밀도 (맞힌 비율)",0,0); q.restore();
      const vp=pts.filter(p=>p.P!==null);
      q.strokeStyle="rgba(139,192,164,.7)"; q.lineWidth=1.6; q.beginPath(); vp.forEach((p,k)=>k?q.lineTo(X(p.R),Y(p.P)):q.moveTo(X(p.R),Y(p.P))); q.stroke();
      vp.forEach(p=>{ q.fillStyle="#8bc0a4"; q.beginPath(); q.arc(X(p.R),Y(p.P),3.2,0,Math.PI*2); q.fill(); });
      if(R.P!==null){ q.fillStyle="#e7c37a"; q.beginPath(); q.arc(X(R.R),Y(R.P),6.5,0,Math.PI*2); q.fill(); q.strokeStyle="#0c0d12"; q.lineWidth=1.5; q.stroke();
        q.fillStyle="#f3f1ea"; q.font=FONT(11); q.textAlign=X(R.R)>w*0.7?"right":"left"; q.fillText(`임계값 ${this.conf.toFixed(2)}`,X(R.R)+(X(R.R)>w*0.7?-10:10),Y(R.P)+(Y(R.P)<T+12?14:-8)); }
    }
    const fps=R.list.filter(p=>!R.res[p.id].ok).map(p=>`${p.id}(${R.res[p.id].why})`), fns=GT.filter(t=>!R.used[t.id]).map(t=>`${t.cls} ${t.id}`);
    $("prEx").innerHTML=`<b>신뢰도 ≥ ${this.conf.toFixed(2)}</b>인 상자 ${R.list.length}개를 남겼습니다${$("prNms").checked?" (NMS 0.5 적용 후)":" (NMS 없이)"}.<br>
      정밀도 = TP ÷ (TP + FP) = ${R.tp} ÷ ${R.tp+R.fp} = <b>${R.P===null?"계산 불가(남긴 상자 없음)":r3(R.P)}</b>, 재현율 = TP ÷ (TP + FN) = ${R.tp} ÷ ${GT.length} = <b>${r3(R.R)}</b><br>
      헛짚음(FP): ${fps.join(", ")||"없음"} · 놓침(FN): ${fns.join(", ")||"없음"}`+
      (this.conf<=0.42&&R.list.some(p=>p.id==="J")?`<br><b style="color:var(--rose)">함정</b> · 숟가락 위의 &lsquo;김치 0.42&rsquo;(J)가 나타났습니다. 모델이 모르는 물체도 보기 중 하나로 우겨 넣습니다.`:"")+
      (this.conf>0.58&&this.conf<=0.62&&$("prNms").checked?`<br><b>맞교환</b> · 임계값이 G(0.58)보다 높아 두 번째 계란말이를 놓쳤지만, 우유 중복 상자 K(0.62)는 아직 남아 있습니다. 한쪽을 줄이면 다른 쪽이 늘어납니다.`:"");
  }
};

/* ================= ⑥ 확인 문제 ================= */
const QZ = [
  {q:"밥·국·김치의 점수가 z = (2.0, 1.0, 0.1)일 때, 소프트맥스(T = 1)로 구한 &lsquo;밥&rsquo;의 확률에 가장 가까운 값은?", o:["0.53","0.66","0.71","0.90"], a:1,
   w:"e² ≈ 7.389, e¹ ≈ 2.718, e<sup>0.1</sup> ≈ 1.105이므로 합은 약 11.213, 밥의 확률은 7.389 ÷ 11.213 ≈ <b>0.659</b>입니다. 점수를 그냥 나누면 2 ÷ 3.1 ≈ 0.645로 소프트맥스 값과 다릅니다."},
  {q:"모든 음식의 점수에 똑같이 3을 더하면 소프트맥스 확률은 어떻게 되나?", o:["모두 3배가 된다","1등 확률만 커진다","변하지 않는다","합이 1보다 커진다"], a:2,
   w:"e<sup>z+3</sup> = e³ × e<sup>z</sup>이므로 분자와 분모에 똑같이 e³이 곱해져 약분됩니다. 확률을 정하는 것은 점수의 <b>차이</b>입니다."},
  {q:"상자 A = (2, 1, 6, 4), B = (4, 2, 8, 6)의 IoU는? (좌표는 (x1, y1, x2, y2))", o:["1/7","1/6","1/3","4/12"], a:1,
   w:"넓이 A = 4×3 = 12, B = 4×4 = 16. 교집합 x: max(2,4)=4 ~ min(6,8)=6 → 2, y: max(1,2)=2 ~ min(4,6)=4 → 2, 교집합 = 4. 합집합 = 12 + 16 − 4 = 24. IoU = 4/24 = <b>1/6</b>."},
  {q:"NMS의 IoU 임계값을 0.5에서 0.3으로 낮추었더니, 겹쳐 놓인 계란말이 두 조각 중 하나(G)가 사라졌다. 가장 알맞은 설명은?", o:["G의 신뢰도가 0.3보다 낮기 때문이다","F와 G의 IoU(0.344)가 0.3보다 커서 G를 F의 중복으로 판단했기 때문이다","NMS는 종류가 다른 상자를 지우기 때문이다","IoU 임계값을 낮추면 정밀도가 항상 떨어지기 때문이다"], a:1,
   w:"G의 신뢰도는 0.58입니다. NMS는 같은 종류끼리 IoU가 임계값보다 크면 지우므로, 0.344 &gt; 0.3인 G가 지워집니다. 실제로는 다른 물체였으므로 <b>재현율</b>이 떨어집니다."},
  {q:"신뢰도 임계값 0.5에서 남긴 상자가 8개, 그중 맞힌 상자(TP)가 6개, 실제 물체가 6개이다. 정밀도와 재현율은?", o:["정밀도 0.75, 재현율 1.0","정밀도 1.0, 재현율 0.75","정밀도 0.75, 재현율 0.75","정밀도 6/14, 재현율 6/8"], a:0,
   w:"정밀도 = TP ÷ 남긴 상자 = 6 ÷ 8 = <b>0.75</b>, 재현율 = TP ÷ 실제 물체 = 6 ÷ 6 = <b>1.0</b>. (⑤ 탭에서 NMS를 끄고 임계값 0.50으로 두면 이 상황입니다.)"}];
function quiz(){
  const box=$("quiz"), st=QZ.map(()=>null);
  box.innerHTML='<div class="qh">CHECK · 5문항</div>'+QZ.map((q,i)=>`<div class="qitem" data-i="${i}"><div class="q"><span class="qn">Q${i+1}.</span>${q.q}</div><div class="opts">${q.o.map((o,j)=>`<button class="opt" data-j="${j}"><span class="mk">${"①②③④"[j]}</span><span>${o}</span></button>`).join("")}</div><div class="why">${q.w}</div></div>`).join("")+'<div class="qscore" id="qsc"></div>';
  const score=()=>{ const done=st.filter(v=>v!==null).length, ok=st.filter(v=>v===true).length; $("qsc").innerHTML=`푼 문항 ${done} / ${QZ.length} · 맞힌 문항 <b>${ok}</b> <button class="tbtn ghost" id="qre" style="margin-left:10px">다시 풀기</button>`; $("qre").onclick=quiz; };
  box.querySelectorAll(".qitem").forEach(it=>{ const i=+it.dataset.i;
    it.querySelectorAll(".opt").forEach(b=>b.onclick=()=>{ if(st[i]!==null) return; const j=+b.dataset.j; st[i]= j===QZ[i].a;
      it.querySelectorAll(".opt").forEach((o,k)=>{ if(k===QZ[i].a) o.classList.add("right"); else if(k===j) o.classList.add("wrong"); });
      it.querySelector(".why").classList.add("show"); score(); }); });
  score();
}

/* ================= 탭 ================= */
function refresh(id){ if(id==="p2") IO.render(); if(id==="p3") EV.render(); if(id==="p4") NM.render(); if(id==="p5") PR.render(); if(id==="p1") SM.render(); }
function showPane(id){
  document.querySelectorAll("#tabs .tab").forEach(t=>t.classList.toggle("active",t.dataset.p===id));
  document.querySelectorAll("section.pane").forEach(s=>s.classList.toggle("on",s.id===id));
  try{ localStorage.setItem("aifp2026_lab06_tab",id); }catch(e){}
  if(id!=="p4") NM.stop();
  refresh(id);
}
window.addEventListener("DOMContentLoaded",()=>{
  SM.init(); IO.init(); EV.init(); NM.init(); PR.init(); quiz();
  document.querySelectorAll("#tabs .tab").forEach(t=>t.onclick=()=>showPane(t.dataset.p));
  let start="p1"; try{ const v=localStorage.getItem("aifp2026_lab06_tab"); if(v&&$(v)) start=v; }catch(e){}
  const hash=location.hash.replace("#",""); if(hash&&$(hash)&&$(hash).classList.contains("pane")) start=hash;
  showPane(start);
  let rt; window.addEventListener("resize",()=>{ clearTimeout(rt); rt=setTimeout(()=>refresh(document.querySelector("section.pane.on").id),120); });
});
/* 검산용으로 노출 (교사용 콘솔 확인) */
window.LAB06 = {GT, PRED0, iou, inter, area, softmax, nms, nmsSteps, evaluate};
