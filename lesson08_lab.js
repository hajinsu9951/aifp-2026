/* 8회차 실습실 — k-NN 스마트 화분 (데이터: data/plant_data.js) */
"use strict";
const PD = window.PLANT_DATA;
const PLANTS = PD.plants;
const FEAT = [
  {k:"soil", name:"토양 수분", unit:"%", i:0, rk:"soil"},
  {k:"temp", name:"온도", unit:"℃", i:1, rk:"temp"},
  {k:"lux",  name:"조도", unit:"lux", i:2, rk:"lux", log:true},
  {k:"hum",  name:"습도", unit:"%", i:3, rk:"hum"},
  {k:"noise",name:"소음", unit:"dB", i:4, rk:"noise"}];
const SN = ["건강","주의","위험"];
const SC = ["#8bc0a4","#e7c37a","#d98a7a"];
const LS = "aifp2026_L8lab_";
let cur = "monstera";
try { cur = localStorage.getItem(LS+"plant") || cur; } catch(e){}
if(!PLANTS.find(p=>p.key===cur)) cur = "monstera";

const $ = id => document.getElementById(id);
const P = () => PLANTS.find(p=>p.key===cur);
const rows = () => PD.data[cur];
const fmt = (v,f) => f && f.k==="lux" ? Math.round(v).toLocaleString() : (Math.round(v*10)/10).toString();
const fmtU = (v,f) => fmt(v,f)+(f.unit==="lux"?" lux":f.unit);
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
function shuffle(n, seed){const r=mulberry(seed), a=[...Array(n).keys()];for(let i=n-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

/* ---------- 캔버스 도우미 ---------- */
function cv(id){
  const c=$(id), dpr=window.devicePixelRatio||1, w=c.clientWidth;
  if(!c.dataset.h) c.dataset.h=c.getAttribute("height");
  const h=+c.dataset.h;
  if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);c.style.height=h+"px";}
  const g=c.getContext("2d"); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,w,h);
  g.font="11px Pretendard,'Malgun Gothic',sans-serif"; return {c,g,w,h};
}
function axisVal(f, v, logOn){ return f.log && logOn ? Math.log10(Math.max(v,1)) : v; }
function range(f, logOn, data){
  const vs = data.map(r=>axisVal(f,r[f.i],logOn)); let lo=Math.min(...vs), hi=Math.max(...vs);
  const pad=(hi-lo)*0.05||1; return [lo-pad, hi+pad];
}
function tickLabel(f, v, logOn){ return f.log && logOn ? (10**v>=1000? Math.round(10**v/1000)+"k" : Math.round(10**v)) : (f.k==="lux"? (v>=1000?Math.round(v/1000)+"k":Math.round(v)) : Math.round(v)); }
function drawAxes(g, box, fx, fy, rx, ry, logOn, small){
  const {x0,y0,x1,y1}=box;
  g.strokeStyle="rgba(255,255,255,.08)"; g.fillStyle="#6d6f7d"; g.lineWidth=1;
  const nt = small?2:5;
  for(let i=0;i<=nt;i++){
    const vx=rx[0]+(rx[1]-rx[0])*i/nt, px=x0+(x1-x0)*i/nt;
    const vy=ry[0]+(ry[1]-ry[0])*i/nt, py=y1-(y1-y0)*i/nt;
    if(!small){ g.beginPath();g.moveTo(px,y0);g.lineTo(px,y1);g.stroke(); g.beginPath();g.moveTo(x0,py);g.lineTo(x1,py);g.stroke(); }
    if(!small){ g.textAlign="center"; g.fillText(tickLabel(fx,vx,logOn),px,y1+14); g.textAlign="right"; g.fillText(tickLabel(fy,vy,logOn),x0-5,py+4); }
  }
  g.strokeStyle="rgba(255,255,255,.18)"; g.strokeRect(x0,y0,x1-x0,y1-y0);
  if(!small){ g.fillStyle="#9a9caa"; g.textAlign="center"; g.fillText(fx.name+" ("+fx.unit+(fx.log&&logOn?", 로그":"")+")",(x0+x1)/2,y1+30);
    g.save(); g.translate(x0-36,(y0+y1)/2); g.rotate(-Math.PI/2); g.fillText(fy.name+" ("+fy.unit+(fy.log&&logOn?", 로그":"")+")",0,0); g.restore(); }
}
function optBox(g, box, fx, fy, rx, ry, logOn, p){
  const sx=v=>box.x0+(axisVal(fx,v,logOn)-rx[0])/(rx[1]-rx[0])*(box.x1-box.x0);
  const sy=v=>box.y1-(axisVal(fy,v,logOn)-ry[0])/(ry[1]-ry[0])*(box.y1-box.y0);
  const [a,b]=p[fx.rk], [c,d]=p[fy.rk];
  g.save(); g.beginPath(); g.rect(box.x0,box.y0,box.x1-box.x0,box.y1-box.y0); g.clip();
  g.strokeStyle="rgba(139,192,164,.8)"; g.setLineDash([5,4]); g.lineWidth=1.3;
  g.strokeRect(sx(a),sy(d),sx(b)-sx(a),sy(c)-sy(d)); g.setLineDash([]); g.restore();
}

/* ---------- k-NN 본체 (수업에서 설명하는 그대로) ---------- */
function makeModel(data, feats, opt){
  // feats: FEAT 배열, opt: {log, scale}
  const X = data.map(r=>feats.map(f=>axisVal(f,r[f.i],opt.log)));
  const n=X.length, m=feats.length, mu=Array(m).fill(0), sd=Array(m).fill(1);
  if(opt.scale){
    for(let j=0;j<m;j++){ let s=0; X.forEach(x=>s+=x[j]); mu[j]=s/n; let v=0; X.forEach(x=>v+=(x[j]-mu[j])**2); sd[j]=Math.sqrt(v/n)||1; }
  }
  const Z = X.map(x=>x.map((v,j)=>(v-mu[j])/sd[j]));
  return {feats, opt, mu, sd, Z, y:data.map(r=>r[5]), raw:data,
    tf(r){ return this.feats.map((f,j)=>(axisVal(f,r[f.i],this.opt.log)-this.mu[j])/this.sd[j]); }};
}
function dist(a,b,metric){ let s=0; for(let j=0;j<a.length;j++){ const d=a[j]-b[j]; s+= metric==="m"? Math.abs(d) : d*d; } return metric==="m"? s : Math.sqrt(s); }
function neighbors(model, z, k, metric, skip){
  const ds=[]; for(let i=0;i<model.Z.length;i++){ if(i===skip) continue; ds.push({i, d:dist(z,model.Z[i],metric), y:model.y[i]}); }
  ds.sort((a,b)=>a.d-b.d); return {all:ds, nb:ds.slice(0,k)};
}
function vote(nb){
  const c=[0,0,0]; nb.forEach(n=>c[n.y]++);
  const mx=Math.max(...c); const tied=[0,1,2].filter(s=>c[s]===mx);
  const pred = tied.length===1? tied[0] : nb.find(n=>tied.includes(n.y)).y; // 동점이면 더 가까운 이웃의 상태
  return {c, pred, tied:tied.length>1};
}
function predict(model, r, k, metric){ const z=model.tf(r); const {nb}=neighbors(model,z,k,metric||"e"); return vote(nb); }

/* =====================================================================
   ① k-NN 직접 만들기
   ===================================================================== */
const K1 = {
  step:0, q:null, model:null, sub:null, timer:null,
  code:[
    "# STEP 1 · 표준화: 단위를 맞춘다",
    "mu, sd = X_train.mean(axis=0), X_train.std(axis=0)",
    "Z_train = (X_train - mu) / sd",
    "z_new   = (x_new   - mu) / sd",
    "# STEP 2 · 거리 계산: 새 점과 모든 점 사이",
    "d = np.sqrt(((Z_train - z_new) ** 2).sum(axis=1))",
    "# STEP 3 · 정렬: 가까운 순서로",
    "order = np.argsort(d)",
    "# STEP 4 · k개 고르기",
    "nb = order[:k]",
    "# STEP 5 · 다수결",
    "votes = np.bincount(y_train[nb], minlength=3)",
    "pred  = votes.argmax()   # 0 건강 · 1 주의 · 2 위험"],
  codeLines:{1:[0,1,2,3],2:[4,5],3:[6,7],4:[8,9],5:[10,11,12]},
  init(){
    ["k1x","k1y"].forEach((id,ii)=>{ const s=$(id); FEAT.forEach(f=>s.add(new Option(f.name+" ("+f.unit+")",f.k))); s.value= ii?"temp":"soil"; });
    ["k1x","k1y","k1m","k1s","k1all"].forEach(id=>$(id).addEventListener("change",()=>{this.rebuild();}));
    $("k1k").addEventListener("input",()=>{ $("k1kv").textContent=$("k1k").value; this.render(); });
    $("k1steps").querySelectorAll("button").forEach(b=>b.onclick=()=>{ this.stop(); this.go(+b.dataset.s); });
    $("k1c").addEventListener("click",e=>this.click(e));
    this.rebuild();
  },
  feats(){ return [FEAT.find(f=>f.k===$("k1x").value), FEAT.find(f=>f.k===$("k1y").value)]; },
  rebuild(){
    const all=rows(); const idx = $("k1all").checked? all.map((_,i)=>i) : shuffle(all.length, 7).slice(0,36);
    this.sub = idx.map(i=>all[i]);
    const [fx,fy]=this.feats();
    this.model = makeModel(this.sub, [fx,fy], {log:false, scale:$("k1s").checked});
    if(!this.q){ const p=P(); this.q=[0,0,0,0,0,5]; FEAT.forEach(f=>this.q[f.i]=(p[f.rk][0]+p[f.rk][1])/2); this.q[0]=p.soil[0]-6; }
    this.render();
  },
  geo(){
    const {w,h}=cv("k1c"); const [fx,fy]=this.feats();
    const data=this.sub.concat([this.q]);
    const rx=range(fx,false,data), ry=range(fy,false,data);
    const box={x0:52,y0:14,x1:w-14,y1:h-44};
    return {w,h,fx,fy,rx,ry,box,
      X:v=>box.x0+(v-rx[0])/(rx[1]-rx[0])*(box.x1-box.x0), Y:v=>box.y1-(v-ry[0])/(ry[1]-ry[0])*(box.y1-box.y0)};
  },
  click(e){
    const r=$("k1c").getBoundingClientRect(), G=this.geo(); const mx=e.clientX-r.left, my=e.clientY-r.top;
    if(mx<G.box.x0||mx>G.box.x1||my<G.box.y0||my>G.box.y1) return;
    this.q[G.fx.i]= G.rx[0]+(mx-G.box.x0)/(G.box.x1-G.box.x0)*(G.rx[1]-G.rx[0]);
    this.q[G.fy.i]= G.ry[0]+(G.box.y1-my)/(G.box.y1-G.box.y0)*(G.ry[1]-G.ry[0]);
    this.stop(); this.step=Math.max(this.step,0); this.render();
  },
  go(s){ this.step=s; this.render(); },
  stop(){ clearInterval(this.timer); this.timer=null; },
  auto(){ this.stop(); this.step=0; this.render(); this.timer=setInterval(()=>{ if(this.step>=5){this.stop();return;} this.go(this.step+1); },1700); },
  preset(name){
    this.stop(); const p=P();
    if(name==="trap"){ $("k1x").value="lux"; $("k1y").value="soil"; $("k1s").checked=false; $("k1k").value=5; this.q=null; }
    if(name==="k1"){ $("k1k").value=1; $("k1s").checked=true; }
    if(name==="border"){ $("k1x").value="soil"; $("k1y").value="temp"; $("k1s").checked=true; $("k1k").value=7; this.q=null;
      this.rebuild(); this.q[0]=p.soil[0]; this.q[1]=p.temp[1]+0.5; }
    $("k1kv").textContent=$("k1k").value; this.rebuild(); this.go(5);
  },
  render(){
    if(!this.model || !$("p1").classList.contains("on")) return;   // 숨긴 탭의 캔버스는 너비가 0
    const G=this.geo(), {g}=cv("k1c"), m=this.model, k=+$("k1k").value, metric=$("k1m").value, p=P();
    const z=m.tf(this.q), {all,nb}=neighbors(m,z,k,metric), v=vote(nb), s=this.step;
    drawAxes(g,G.box,G.fx,G.fy,G.rx,G.ry,false); optBox(g,G.box,G.fx,G.fy,G.rx,G.ry,false,p);
    const qx=G.X(this.q[G.fx.i]), qy=G.Y(this.q[G.fy.i]);
    // 거리선
    if(s>=2){ g.lineWidth=1; all.forEach((n,ii)=>{ const r=m.raw[n.i]; const inNb=ii<k;
      if(s>=4 && !inNb) return; g.strokeStyle= inNb&&s>=4? "rgba(231,195,122,.85)" : "rgba(255,255,255,.07)";
      g.beginPath(); g.moveTo(qx,qy);
      if(metric==="m"){ g.lineTo(G.X(r[G.fx.i]),qy); }
      g.lineTo(G.X(r[G.fx.i]),G.Y(r[G.fy.i])); g.stroke(); }); }
    // k번째 이웃 반경 (표준화 공간의 원 → 화면에서는 타원)
    if(s>=4 && metric==="e"){
      const rad=nb[nb.length-1].d, sx=m.sd[0]*(G.box.x1-G.box.x0)/(G.rx[1]-G.rx[0]), sy=m.sd[1]*(G.box.y1-G.box.y0)/(G.ry[1]-G.ry[0]);
      g.strokeStyle="rgba(231,195,122,.6)"; g.setLineDash([4,4]); g.beginPath(); g.ellipse(qx,qy,Math.max(0,rad*sx),Math.max(0,rad*sy),0,0,Math.PI*2); g.stroke(); g.setLineDash([]);
    }
    // 점
    const nbSet=new Set(nb.map(n=>n.i));
    m.raw.forEach((r,i)=>{ const x=G.X(r[G.fx.i]), y=G.Y(r[G.fy.i]);
      g.fillStyle=SC[r[5]]; g.globalAlpha= s>=4&&!nbSet.has(i)? .3 : .9;
      g.beginPath(); g.arc(x,y, s>=4&&nbSet.has(i)?6:4.2,0,Math.PI*2); g.fill();
      if(s>=4&&nbSet.has(i)){ g.strokeStyle="#fff"; g.lineWidth=1.4; g.stroke(); } });
    g.globalAlpha=1;
    // 새 점
    g.fillStyle= s>=5? SC[v.pred] : "#f3f1ea"; g.strokeStyle="#0c0d12"; g.lineWidth=2;
    g.beginPath(); g.moveTo(qx,qy-9); g.lineTo(qx+9,qy); g.lineTo(qx,qy+9); g.lineTo(qx-9,qy); g.closePath(); g.fill(); g.stroke();
    if(s>=5){ g.fillStyle="#f3f1ea"; g.font="bold 12px Pretendard,sans-serif"; g.textAlign="left"; g.fillText("→ "+SN[v.pred], qx+12, qy-10); }
    // 단계 버튼
    $("k1steps").querySelectorAll("button").forEach(b=>{ const n=+b.dataset.s; b.classList.toggle("on",n===s); b.classList.toggle("done",n<s); });
    // 코드 강조
    const hl=new Set(this.codeLines[s]||[]);
    $("k1code").innerHTML=this.code.map((l,i)=>`<div class="${hl.has(i)?"hl":""}">${l.replace(/</g,"&lt;")}</div>`).join("");
    // 설명 + 표
    const [fx,fy]=[G.fx,G.fy], q=this.q, ex=$("k1ex"), tab=$("k1tab");
    const zq=z.map(x=>x.toFixed(2));
    const qtxt=`새 측정값: ${fx.name} <b>${fmtU(q[fx.i],fx)}</b>, ${fy.name} <b>${fmtU(q[fy.i],fy)}</b>`;
    let html="", th="";
    if(s===0){ html=qtxt+"<br>그래프를 클릭해 새 측정값을 옮기고 STEP 1을 누르세요. 지금 기록은 <b>"+m.raw.length+"개</b>입니다."; }
    if(s===1){
      html = $("k1s").checked
        ? qtxt+`<br>각 변수에서 <b>평균을 빼고 표준편차로 나눕니다</b>. 이제 두 변수 모두 &lsquo;평균에서 몇 걸음 떨어졌나&rsquo;라는 같은 단위가 됩니다.<br>
          <span class="f">${fx.name}: (${fmt(q[fx.i],fx)} − ${fmt(m.mu[0],fx)}) ÷ ${fmt(m.sd[0],fx)} = ${zq[0]}</span><br>
          <span class="f">${fy.name}: (${fmt(q[fy.i],fy)} − ${fmt(m.mu[1],fy)}) ÷ ${fmt(m.sd[1],fy)} = ${zq[1]}</span>`
        : qtxt+`<br><b>표준화를 껐습니다.</b> ${fx.name}의 값 범위는 약 <b>${fmt(G.rx[1]-G.rx[0],fx)}</b>, ${fy.name}는 약 <b>${fmt(G.ry[1]-G.ry[0],fy)}</b>입니다.
          범위가 큰 쪽이 거리를 거의 혼자 결정하게 됩니다. STEP 4에서 이웃이 어느 방향으로 뽑히는지 보세요.`;
      th="<tr><th>기록</th><th>"+fx.name+"</th><th>"+fy.name+"</th><th>z₁</th><th>z₂</th><th>상태</th></tr>";
      th+=m.raw.slice(0,10).map((r,i)=>`<tr><td>#${i+1}</td><td>${fmt(r[fx.i],fx)}</td><td>${fmt(r[fy.i],fy)}</td><td>${m.Z[i][0].toFixed(2)}</td><td>${m.Z[i][1].toFixed(2)}</td><td><span class="dot" style="background:${SC[r[5]]}"></span>${SN[r[5]]}</td></tr>`).join("");
    }
    if(s>=2){
      const n0=all[0], r0=m.raw[n0.i], dz=[m.Z[n0.i][0]-z[0], m.Z[n0.i][1]-z[1]];
      if(s===2) html = qtxt+`<br>새 점과 <b>${m.raw.length}개 기록 모두</b> 사이의 거리를 잽니다. 예를 들어 기록 #${n0.i+1}까지는<br>`+
        (metric==="m" ? `<span class="f">|${dz[0].toFixed(2)}| + |${dz[1].toFixed(2)}| = ${n0.d.toFixed(3)}</span> (맨해튼: 가로·세로로만 걷는 거리)`
          : `<span class="f">√(${dz[0].toFixed(2)}² + ${dz[1].toFixed(2)}²) = ${n0.d.toFixed(3)}</span> (유클리드: 직선 거리)`);
      if(s===3) html = `거리를 <b>작은 순서로 정렬</b>했습니다. 가장 가까운 기록은 #${n0.i+1}(${SN[r0[5]]}), 거리 ${n0.d.toFixed(3)}입니다.<br>
        이것이 k-NN의 계산 비용입니다 — 물어볼 때마다 <b>모든 기록과의 거리</b>를 재고 정렬해야 합니다.`;
      if(s===4) html = `위에서부터 <b>k = ${k}개</b>를 이웃으로 고릅니다(금색 선). 점선은 k번째 이웃까지의 거리입니다.<br>
        이웃의 상태: ${nb.map(n=>`<span class="dot" style="background:${SC[n.y]}"></span>`).join("")}`+
        (!$("k1s").checked? `<br><b>표준화가 꺼져 있습니다.</b> 이웃이 ${G.rx[1]-G.rx[0]>G.ry[1]-G.ry[0]?"세로로 길게":"가로로 길게"} 뽑히지 않았나요?`:"");
      if(s===5) html = `이웃 ${k}개의 투표: 건강 <b>${v.c[0]}</b> · 주의 <b>${v.c[1]}</b> · 위험 <b>${v.c[2]}</b><br>
        → 새 화분은 <b style="color:${SC[v.pred]}">${SN[v.pred]}</b>으로 판정합니다.`+(v.tied?` <span class="mini2">(동점 — 더 가까운 이웃의 상태를 따름)</span>`:"")+
        `<br>문헌의 적정 범위(초록 상자) ${this.inBox()? "<b>안쪽</b>":"<b>바깥</b>"}에 놓인 점입니다. 판정과 맞나요?`;
      const list = s===2? all.slice(0,12).sort((a,b)=>a.i-b.i) : all.slice(0, Math.max(k,12));
      th="<tr><th>"+(s===2?"기록":"순위")+"</th><th>"+fx.name+"</th><th>"+fy.name+"</th><th>거리</th><th>상태</th></tr>";
      th+=list.map((n,ii)=>{ const r=m.raw[n.i]; return `<tr class="${s>=4&&ii<k?"nb":""}"><td>${s===2?"#"+(n.i+1):(ii+1)+"위 · #"+(n.i+1)}</td><td>${fmt(r[fx.i],fx)}</td><td>${fmt(r[fy.i],fy)}</td><td>${n.d.toFixed(3)}</td><td><span class="dot" style="background:${SC[n.y]}"></span>${SN[n.y]}</td></tr>`; }).join("");
    }
    ex.innerHTML=html; tab.innerHTML=th;
    $("k1votes").innerHTML = s>=5 ? [0,1,2].map(c=>`<div class="vb"><span>${SN[c]}</span><div class="tr"><div class="fl" style="width:${v.c[c]/k*100}%;background:${SC[c]}"></div></div><b>${v.c[c]}</b></div>`).join("") : "";
  },
  inBox(){ const p=P(); return this.feats().every(f=>this.q[f.i]>=p[f.rk][0]&&this.q[f.i]<=p[f.rk][1]); }
};

/* =====================================================================
   ② 식물 고르기
   ===================================================================== */
const ROOM = [
  {k:"lux", name:"창가 밝기", unit:"lux", min:300, max:40000, step:100, v:4000},
  {k:"temp", name:"평균 온도", unit:"℃", min:10, max:35, step:1, v:23},
  {k:"hum", name:"습도", unit:"%", min:15, max:90, step:1, v:45},
  {k:"care", name:"물 줄 수 있는 간격", unit:"일", min:1, max:30, step:1, v:7}];
const P2 = {
  room:{},
  init(){
    ROOM.forEach(r=>{ this.room[r.k]=r.v; });
    try{ Object.assign(this.room, JSON.parse(localStorage.getItem(LS+"room")||"{}")); }catch(e){}
    $("roomCtl").innerHTML = ROOM.map(r=>`<div><label>${r.name} <b id="rv_${r.k}"></b></label><br><input type="range" id="r_${r.k}" min="${r.min}" max="${r.max}" step="${r.step}" value="${this.room[r.k]}" style="width:100%"></div>`).join("");
    ROOM.forEach(r=>$("r_"+r.k).addEventListener("input",()=>{ this.room[r.k]=+$("r_"+r.k).value; try{localStorage.setItem(LS+"room",JSON.stringify(this.room));}catch(e){} this.render(); }));
    this.render();
  },
  care(p){ return {monstera:7,pothos:7,peacelily:3,snakeplant:25,basil:2,echeveria:14}[p.key]; },
  fit(p){
    const s=(v,[a,b],soft)=> v>=a&&v<=b ? 1 : Math.max(0, 1-(v<a? (a-v):(v-b))/soft);
    const lx=Math.log10(this.room.lux), [la,lb]=[Math.log10(p.lux[0]),Math.log10(p.lux[1])];
    const fl = lx>=la&&lx<=lb?1:Math.max(0,1-(lx<la?la-lx:lx-lb)/0.6);
    const ft = s(this.room.temp,p.temp,6), fh=s(this.room.hum,p.hum,25);
    const need=this.care(p), fc = this.room.care<=need? 1 : Math.max(0,1-(this.room.care-need)/need);
    return Math.round(100*(0.35*fl+0.25*ft+0.15*fh+0.25*fc));
  },
  render(){
    ROOM.forEach(r=>$("rv_"+r.k).textContent=(r.k==="lux"? this.room[r.k].toLocaleString():this.room[r.k])+" "+r.unit);
    const sorted=[...PLANTS].sort((a,b)=>this.fit(b)-this.fit(a));
    const scale={soil:[0,100],temp:[10,35],lux:[2.5,4.8],hum:[20,90]};
    const roomV={temp:this.room.temp,lux:Math.log10(this.room.lux),hum:this.room.hum};
    $("pcards").innerHTML = sorted.map(p=>{
      const bars=[["soil","토양 수분","%"],["temp","온도","℃"],["lux","조도","lux"],["hum","습도","%"]].map(([k,n,u])=>{
        const [a,b]=scale[k], v0=k==="lux"?Math.log10(p.lux[0]):p[k][0], v1=k==="lux"?Math.log10(p.lux[1]):p[k][1];
        const L=(v0-a)/(b-a)*100, W=(v1-v0)/(b-a)*100;
        const mk = roomV[k]!==undefined? `<div class="mk" style="left:${Math.min(100,Math.max(0,(roomV[k]-a)/(b-a)*100))}%"></div>`:"";
        const txt = k==="lux"? `${(p.lux[0]/1000).toFixed(p.lux[0]<10000?1:0)}k~${p.lux[1]/1000}k` : `${p[k][0]}~${p[k][1]}${u}`;
        return `<div class="rbar"><span>${n}</span><div class="tr"><div class="fl" style="left:${L}%;width:${W}%"></div>${mk}</div><span class="v">${txt}</span></div>`;}).join("");
      return `<div class="pcard ${p.key===cur?"on":""}" onclick="setPlant('${p.key}')"><span class="fit">${this.fit(p)}<small style="font-size:11px">점</small></span>
        <h4>${p.name}</h4><div class="sci">${p.sci}</div>${bars}
        <div class="mini2" style="margin-top:8px">💧 ${p.water}<br>☀ ${p.light}</div></div>`; }).join("");
    $("optTab").innerHTML = `<thead><tr><th>식물</th><th>토양 수분</th><th>온도</th><th>조도</th><th>습도</th><th>소음</th><th style="min-width:260px">근거</th></tr></thead><tbody>`+
      PLANTS.map(p=>`<tr${p.key===cur?' style="background:rgba(216,180,90,.07)"':""}><td><b>${p.name}</b></td><td>${p.soil[0]}~${p.soil[1]}%</td><td>${p.temp[0]}~${p.temp[1]}℃</td><td>${p.lux[0].toLocaleString()}~${p.lux[1].toLocaleString()} lux</td><td>${p.hum[0]}~${p.hum[1]}%</td><td style="color:var(--dim)">${p.noise[0]}~${p.noise[1]} dB*</td><td style="font-size:11.5px;color:var(--mut)">${p.src}</td></tr>`).join("")+
      `</tbody><tfoot><tr><td colspan="7" style="font-size:11.5px;color:var(--dim)">* 소음은 생육 요인이 아닌 설치 환경 지표로, 모든 식물에 같은 값을 두었습니다. 점수는 교실 환경과 맞는 정도(조도 35 · 온도 25 · 물주기 25 · 습도 15)입니다.</td></tr></tfoot>`;
  }
};

/* =====================================================================
   ③ 관계 시각화
   ===================================================================== */
const P3 = {
  sel:[0,1], ang:{a:0.7,b:0.35,z:1}, drag:null, raf:null,
  feats(){ return FEAT.filter(f=>f.k!=="noise"||$("p3noise").checked); },
  init(){
    ["p3noise","p3log"].forEach(id=>$(id).addEventListener("change",()=>this.render()));
    $("smx").addEventListener("click",e=>{ const fs=this.feats(), r=$("smx").getBoundingClientRect(), n=fs.length;
      const cw=(r.width-10)/n, ch=(+$("smx").dataset.h-10)/n;
      const ci=Math.floor((e.clientX-r.left-10)/cw), ri=Math.floor((e.clientY-r.top)/ch);
      if(ci>=0&&ci<n&&ri>=0&&ri<n&&ci!==ri){ this.sel=[FEAT.indexOf(fs[ci]),FEAT.indexOf(fs[ri])]; this.big(); }});
    ["d3x","d3y","d3z"].forEach((id,i)=>{ const s=$(id); FEAT.forEach(f=>s.add(new Option(f.name,f.k))); s.value=["temp","lux","soil"][i]; s.onchange=()=>this.draw3(); });
    ["d3box","d3show"].forEach(id=>$(id).onchange=()=>this.draw3());
    const c=$("d3c");
    c.addEventListener("pointerdown",e=>{this.drag={x:e.clientX,y:e.clientY}; c.setPointerCapture(e.pointerId);});
    c.addEventListener("pointermove",e=>{ if(!this.drag) return; this.ang.a+= (e.clientX-this.drag.x)*0.01; this.ang.b=Math.max(-1.5,Math.min(1.5,this.ang.b+(e.clientY-this.drag.y)*0.01)); this.drag={x:e.clientX,y:e.clientY}; this.draw3(); });
    c.addEventListener("pointerup",()=>this.drag=null);
    c.addEventListener("wheel",e=>{ e.preventDefault(); this.ang.z=Math.max(.5,Math.min(2.5,this.ang.z*(e.deltaY<0?1.1:0.9))); this.draw3(); },{passive:false});
    const loop=()=>{ if($("p3").classList.contains("on") && $("d3rot").checked && !this.drag){ this.ang.a+=0.006; this.draw3(); } this.raf=requestAnimationFrame(loop); };
    loop();
  },
  render(){ this.matrix(); this.big(); this.draw3(); },
  matrix(){
    const {g,w,h}=cv("smx"), fs=this.feats(), n=fs.length, data=rows(), lg=$("p3log").checked, p=P();
    const cw=(w-10)/n, ch=(h-10)/n;
    fs.forEach((fy,ri)=>fs.forEach((fx,ci)=>{
      const box={x0:10+ci*cw+3,y0:ri*ch+3,x1:10+(ci+1)*cw-3,y1:(ri+1)*ch-3};
      const rx=range(fx,lg,data), ry=range(fy,lg,data);
      g.strokeStyle="rgba(255,255,255,.12)"; g.strokeRect(box.x0,box.y0,box.x1-box.x0,box.y1-box.y0);
      if(ri===ci){ // 히스토그램
        const B=14, hs=[0,1,2].map(()=>Array(B).fill(0));
        data.forEach(r=>{ const b=Math.min(B-1,Math.floor((axisVal(fx,r[fx.i],lg)-rx[0])/(rx[1]-rx[0])*B)); hs[r[5]][b]++; });
        const mx=Math.max(...hs.flat(),1);
        [0,1,2].forEach(s=>{ g.strokeStyle=SC[s]; g.lineWidth=1.6; g.beginPath();
          hs[s].forEach((v,b)=>{ const x=box.x0+(b+.5)/B*(box.x1-box.x0), y=box.y1-v/mx*(box.y1-box.y0-14); b?g.lineTo(x,y):g.moveTo(x,y); }); g.stroke(); });
        g.fillStyle="#e7c37a"; g.font="bold 12px Pretendard,sans-serif"; g.textAlign="left"; g.fillText(fx.name,box.x0+5,box.y0+14); g.font="11px Pretendard,sans-serif";
        return;
      }
      const sel = FEAT.indexOf(fx)===this.sel[0] && FEAT.indexOf(fy)===this.sel[1];
      if(sel){ g.strokeStyle="#e7c37a"; g.lineWidth=2; g.strokeRect(box.x0,box.y0,box.x1-box.x0,box.y1-box.y0); g.lineWidth=1; }
      optBox(g,box,fx,fy,rx,ry,lg,p);
      data.forEach(r=>{ g.fillStyle=SC[r[5]]; g.globalAlpha=.65;
        g.fillRect(box.x0+(axisVal(fx,r[fx.i],lg)-rx[0])/(rx[1]-rx[0])*(box.x1-box.x0)-1.2, box.y1-(axisVal(fy,r[fy.i],lg)-ry[0])/(ry[1]-ry[0])*(box.y1-box.y0)-1.2,2.4,2.4); });
      g.globalAlpha=1;
    }));
  },
  big(){
    this.matrix();
    const {g,w,h}=cv("sbig"), fx=FEAT[this.sel[0]], fy=FEAT[this.sel[1]], data=rows(), lg=$("p3log").checked, p=P();
    const box={x0:56,y0:12,x1:w-12,y1:h-42}, rx=range(fx,lg,data), ry=range(fy,lg,data);
    drawAxes(g,box,fx,fy,rx,ry,lg); optBox(g,box,fx,fy,rx,ry,lg,p);
    data.forEach(r=>{ g.fillStyle=SC[r[5]]; g.globalAlpha=.8; g.beginPath();
      g.arc(box.x0+(axisVal(fx,r[fx.i],lg)-rx[0])/(rx[1]-rx[0])*(box.x1-box.x0), box.y1-(axisVal(fy,r[fy.i],lg)-ry[0])/(ry[1]-ry[0])*(box.y1-box.y0),3,0,Math.PI*2); g.fill(); });
    g.globalAlpha=1;
    // 상관계수
    const xs=data.map(r=>axisVal(fx,r[fx.i],lg)), ys=data.map(r=>axisVal(fy,r[fy.i],lg));
    const mx=xs.reduce((a,b)=>a+b)/xs.length, my=ys.reduce((a,b)=>a+b)/ys.length;
    let sxy=0,sxx=0,syy=0; xs.forEach((x,i)=>{sxy+=(x-mx)*(ys[i]-my);sxx+=(x-mx)**2;syy+=(ys[i]-my)**2;});
    const rr=sxy/Math.sqrt(sxx*syy);
    const inside=data.filter(r=>[fx,fy].every(f=>r[f.i]>=p[f.rk][0]&&r[f.i]<=p[f.rk][1]));
    const hIn=inside.filter(r=>r[5]===0).length, hAll=data.filter(r=>r[5]===0).length;
    const noise = fx.k==="noise"||fy.k==="noise";
    $("sbigex").innerHTML = `<b>${fx.name} × ${fy.name}</b> · 상관계수 r = <b>${rr.toFixed(2)}</b> — 두 변수 사이에 직선 관계는 ${Math.abs(rr)<0.2?"거의 없습니다":"조금 있습니다"}.
      <br>초록 점선 상자(두 변수 모두 적정) 안의 기록 <b>${inside.length}개</b> 중 건강은 <b>${hIn}개</b>(${inside.length?Math.round(hIn/inside.length*100):0}%)이고,
      건강한 기록 전체 ${hAll}개 중 <b>${hAll?Math.round(hIn/hAll*100):0}%</b>가 이 상자 안에 있습니다.`+
      (noise? `<br><b>소음 축을 따라 보면 초록 점이 위아래(좌우)로 고르게 퍼져 있습니다.</b> 소음 값을 알아도 상태를 가늠할 수 없다는 뜻 — 관계없는 변수입니다.`
       : `<br>상자 안에도 노란·빨간 점이 있는 것은 <b>나머지 변수</b>가 어긋났기 때문입니다. 두 변수만으로는 부족하다는 증거입니다.`);
  },
  draw3(){
    if(!$("p3").classList.contains("on")) return;
    const {g,w,h}=cv("d3c"), fs=["d3x","d3y","d3z"].map(id=>FEAT.find(f=>f.k===$(id).value)), data=rows(), lg=$("p3log").checked, p=P(), show=$("d3show").value;
    const rs=fs.map(f=>range(f,lg,data));
    const nrm=(f,j,v)=>((axisVal(f,v,lg)-rs[j][0])/(rs[j][1]-rs[j][0])-0.5)*2;
    const {a,b,z}=this.ang, ca=Math.cos(a), sa=Math.sin(a), cb=Math.cos(b), sb=Math.sin(b), S=Math.min(w,h)*0.3*z;
    const pr=(x,y,zz)=>{ // x→가로, z(높이)→세로, y→깊이
      const X=x*ca - y*sa, Y=x*sa + y*ca; const Yb=Y*cb - zz*sb, Z=Y*sb + zz*cb;
      const persp=3/(3+Yb); return [w/2+X*S*persp, h/2-Z*S*persp, Yb]; };
    const line=(p1,p2,col,dash)=>{ const A=pr(...p1),B=pr(...p2); g.strokeStyle=col; g.setLineDash(dash||[]); g.beginPath(); g.moveTo(A[0],A[1]); g.lineTo(B[0],B[1]); g.stroke(); g.setLineDash([]); };
    // 바깥 상자 + 축
    g.lineWidth=1; const c=[-1,1];
    c.forEach(i=>c.forEach(j=>{ line([-1,i,j],[1,i,j],"rgba(255,255,255,.09)"); line([i,-1,j],[i,1,j],"rgba(255,255,255,.09)"); line([i,j,-1],[i,j,1],"rgba(255,255,255,.09)"); }));
    g.lineWidth=1.6; line([-1,-1,-1],[1,-1,-1],"#7fa8d4"); line([-1,-1,-1],[-1,1,-1],"#a99ad4"); line([-1,-1,-1],[-1,-1,1],"#e7c37a");
    g.fillStyle="#d8dae4"; g.font="12px Pretendard,sans-serif"; g.textAlign="center";
    [[[1.25,-1,-1],fs[0]],[[-1,1.25,-1],fs[1]],[[-1,-1,1.2],fs[2]]].forEach(([q,f])=>{ const P_=pr(...q); g.fillText(f.name+" ("+f.unit+")",P_[0],P_[1]); });
    // 적정 범위 상자
    if($("d3box").checked){
      const lo=fs.map((f,j)=>Math.max(-1,Math.min(1,nrm(f,j,p[f.rk][0])))), hi=fs.map((f,j)=>Math.max(-1,Math.min(1,nrm(f,j,p[f.rk][1]))));
      g.lineWidth=1.4; const col="rgba(139,192,164,.9)";
      [0,1].forEach(i=>[0,1].forEach(j=>{
        const v=(t,u,s)=>[t?hi[0]:lo[0], u?hi[1]:lo[1], s?hi[2]:lo[2]];
        line(v(0,i,j),v(1,i,j),col,[4,3]); line(v(i,0,j),v(i,1,j),col,[4,3]); line(v(i,j,0),v(i,j,1),col,[4,3]); }));
    }
    // 점 (깊이 순 정렬)
    const pts=data.filter(r=>show==="all"||r[5]===+show).map(r=>{ const q=pr(nrm(fs[0],0,r[fs[0].i]),nrm(fs[1],1,r[fs[1].i]),nrm(fs[2],2,r[fs[2].i])); return [q,r[5]]; });
    pts.sort((A,B)=>B[0][2]-A[0][2]);
    pts.forEach(([q,s])=>{ const d=(1-q[2])/2; g.fillStyle=SC[s]; g.globalAlpha=0.45+0.5*Math.max(0,Math.min(1,d)); g.beginPath(); g.arc(q[0],q[1],2.2+1.6*Math.max(0,d),0,Math.PI*2); g.fill(); });
    g.globalAlpha=1;
    g.textAlign="left"; g.fillStyle="#9a9caa"; g.fillText(P().name+" · "+pts.length+"개 기록", 12, 20);
  }
};

/* =====================================================================
   ④ 모델 설계·평가
   ===================================================================== */
const P4 = {
  runs:[], inp:null,
  init(){
    $("p4feat").innerHTML = FEAT.map(f=>`<span class="chk"><input type="checkbox" id="pf_${f.k}" ${f.k!=="noise"?"checked":""}>${f.name}</span>`).join("");
    FEAT.forEach(f=>$("pf_"+f.k).addEventListener("change",()=>this.run()));
    ["p4log","p4scale","p4seed"].forEach(id=>$(id).addEventListener("change",()=>this.run()));
    $("p4k").addEventListener("input",()=>{ $("p4kv").textContent=$("p4k").value; this.run(); });
    $("p4t").addEventListener("input",()=>{ $("p4tv").textContent=$("p4t").value+"%"; this.run(); });
    this.resetInput();
  },
  resetInput(){
    const p=P(); this.inp=[0,0,0,0,0];
    FEAT.forEach(f=>this.inp[f.i]= f.log? Math.round(Math.sqrt(p.lux[0]*p.lux[1])) : Math.round((p[f.rk][0]+p[f.rk][1])/2));
    this.inp[0]=p.soil[0]-5;
    const lim={soil:[0,100,1],temp:[5,40,0.5],lux:[100,80000,100],hum:[10,95,1],noise:[20,90,1]};
    $("p4in").innerHTML = FEAT.map(f=>`<div class="rbar" style="grid-template-columns:70px 1fr 82px;margin-bottom:8px"><span>${f.name}</span>
      <input type="range" id="pi_${f.k}" min="${lim[f.k][0]}" max="${lim[f.k][1]}" step="${lim[f.k][2]}" value="${this.inp[f.i]}">
      <span class="v" id="piv_${f.k}"></span></div>`).join("")+
      `<div class="mini2">초록 글씨 = ${p.name}의 적정 범위 안 · 소음은 모델 설계에서 뺐다면 판정에 쓰이지 않습니다.</div>`;
    FEAT.forEach(f=>$("pi_"+f.k).addEventListener("input",()=>{ this.inp[f.i]=+$("pi_"+f.k).value; this.predictView(); }));
  },
  feats(){ return FEAT.filter(f=>$("pf_"+f.k).checked); },
  split(){
    const data=rows(), n=data.length, nt=Math.round(n*(+$("p4t").value)/100);
    // 상태 비율을 유지하며 나누기(층화)
    const order=shuffle(n, +$("p4seed").value||0), test=new Set();
    [0,1,2].forEach(s=>{ const ids=order.filter(i=>data[i][5]===s); const t=Math.round(ids.length*nt/n); ids.slice(0,t).forEach(i=>test.add(i)); });
    return {tr:data.filter((_,i)=>!test.has(i)), te:data.filter((_,i)=>test.has(i))};
  },
  evaluate(tr, te, k, feats, opt){
    const m=makeModel(tr,feats,opt), cm=[[0,0,0],[0,0,0],[0,0,0]];
    te.forEach(r=>{ cm[r[5]][predict(m,r,k).pred]++; });
    let ok=0; for(let s=0;s<3;s++) ok+=cm[s][s];
    return {m, cm, acc: ok/te.length};
  },
  run(record){
    const feats=this.feats(); if(!feats.length){ $("p4met").innerHTML="<div>변수를 하나 이상 고르세요</div>"; return; }
    const k=+$("p4k").value, opt={log:$("p4log").checked, scale:$("p4scale").checked};
    const {tr,te}=this.split(), E=this.evaluate(tr,te,k,feats,opt); this.model=E.m; this.k=k;
    const cm=E.cm, sumR=cm.map(r=>r.reduce((a,b)=>a+b)), sumC=[0,1,2].map(c=>cm[0][c]+cm[1][c]+cm[2][c]);
    const rec=[0,1,2].map(s=>sumR[s]?cm[s][s]/sumR[s]:0), pre=[0,1,2].map(s=>sumC[s]?cm[s][s]/sumC[s]:0);
    const base=Math.max(...sumR)/te.length;
    $("p4met").innerHTML=`<div><div class="l">훈련 / 시험</div><div class="v">${tr.length} / ${te.length}</div></div>
      <div><div class="l">정확도</div><div class="v" style="color:var(--accent)">${(E.acc*100).toFixed(1)}%</div></div>
      <div><div class="l">위험 재현율</div><div class="v">${(rec[2]*100).toFixed(0)}%</div></div>
      <div><div class="l">위험→건강 놓침</div><div class="v" style="color:${cm[2][0]?"var(--rose)":"var(--green)"}">${cm[2][0]}건</div></div>
      <div><div class="l">찍기 기준선</div><div class="v" style="color:var(--dim)">${(base*100).toFixed(0)}%</div></div>`;
    let h=`<div></div>`+SN.map(s=>`<div class="h">예측<br>${s}</div>`).join("");
    const mx=Math.max(...cm.flat(),1);
    for(let a=0;a<3;a++){ h+=`<div class="h">실제<br>${SN[a]}</div>`;
      for(let p=0;p<3;p++){ const v=cm[a][p], al=0.08+0.5*v/mx, col= a===p? "139,192,164" : (a===2&&p===0? "217,138,122":"216,180,90");
        h+=`<div class="c ${a===p?"diag":""} ${a===2&&p===0?"worst":""}" style="background:rgba(${col},${al})" onclick="P4.explain(${a},${p})">${v}<small>${a===p?"맞힘":"틀림"}</small></div>`; } }
    $("p4cm").innerHTML=h; this.cm=cm; this.explain(2,0,true);
    $("p4rep").innerHTML=`<tr><th>상태</th><th>실제 개수</th><th>재현율</th><th>정밀도</th></tr>`+
      [0,1,2].map(s=>`<tr><td><span class="dot" style="background:${SC[s]}"></span>${SN[s]}</td><td>${sumR[s]}</td><td>${(rec[s]*100).toFixed(0)}%</td><td>${(pre[s]*100).toFixed(0)}%</td></tr>`).join("");
    this.curve(tr,te,feats,opt);
    this.predictView();
    if(record){
      this.runs.push({plant:P().name, feats:feats.map(f=>f.name).join("·"), log:opt.log, scale:opt.scale, k, t:$("p4t").value, acc:E.acc, rec:rec[2], miss:cm[2][0]});
      $("p4runs").innerHTML=`<tr><th>#</th><th>식물</th><th>변수</th><th>로그</th><th>표준화</th><th>k</th><th>시험</th><th>정확도</th><th>위험 재현율</th><th>위험→건강 놓침</th></tr>`+
        this.runs.map((r,i)=>`<tr><td>${i+1}</td><td>${r.plant}</td><td style="text-align:left">${r.feats}</td><td>${r.log?"○":"×"}</td><td>${r.scale?"○":"×"}</td><td>${r.k}</td><td>${r.t}%</td><td><b>${(r.acc*100).toFixed(1)}%</b></td><td>${(r.rec*100).toFixed(0)}%</td><td>${r.miss}</td></tr>`).join("");
    }
  },
  explain(a,p,silent){
    const v=this.cm[a][p], tot=this.cm[a].reduce((x,y)=>x+y);
    const msg = a===p ? `실제 <b>${SN[a]}</b>인 화분 ${tot}개 중 <b>${v}개</b>를 ${SN[a]}으로 맞혔습니다. 이 비율(${tot?Math.round(v/tot*100):0}%)이 ${SN[a]}의 <b>재현율</b>입니다.`
      : a===2&&p===0 ? `<b>가장 위험한 실수</b>입니다. 실제로는 <b>위험</b>한 화분 ${v}개를 <b>건강</b>하다고 판정했습니다. 자동화 장치는 이 화분을 그냥 둡니다 — 식물은 시듭니다.
        <br>정확도가 높아도 이 칸이 0이 아니면 안심할 수 없습니다. 교과서의 False Negative와 같은 자리입니다.`
      : a===0&&p===2 ? `실제 <b>건강</b>한 화분 ${v}개를 <b>위험</b>으로 판정했습니다. 헛경보입니다. 괜히 물을 주면 과습이 될 수 있지만, 사람이 한 번 더 확인하면 피해는 작습니다.`
      : `실제 <b>${SN[a]}</b>을 <b>${SN[p]}</b>으로 판정한 ${v}건. 이웃한 상태끼리의 혼동은 경계 근처에서 자주 일어납니다 — 상태가 사람이 정한 구간이기 때문입니다.`;
    $("p4cmex").innerHTML = (silent?"<span class='mini2'>칸을 눌러 보세요 · 지금은 빨간 테두리 칸</span><br>":"")+msg;
  },
  curve(tr,te,feats,opt){
    const {g,w,h}=cv("p4curve"), box={x0:38,y0:10,x1:w-10,y1:h-26}, ks=[];
    for(let k=1;k<=25;k+=2) ks.push(k);
    const m=makeModel(tr,feats,opt);
    const trA=ks.map(k=>{ let ok=0; tr.forEach((r,i)=>{ const {nb}=neighbors(m,m.Z[i],k,"e"); if(vote(nb).pred===r[5]) ok++; }); return ok/tr.length; });
    const teA=ks.map(k=>{ let ok=0; te.forEach(r=>{ if(predict(m,r,k).pred===r[5]) ok++; }); return ok/te.length; });
    g.strokeStyle="rgba(255,255,255,.08)"; g.fillStyle="#6d6f7d"; g.textAlign="right";
    [0.4,0.6,0.8,1].forEach(v=>{ const y=box.y1-(v-0.3)/0.7*(box.y1-box.y0); g.beginPath(); g.moveTo(box.x0,y); g.lineTo(box.x1,y); g.stroke(); g.fillText(v.toFixed(1),box.x0-4,y+4); });
    g.textAlign="center"; ks.forEach((k,i)=>{ const x=box.x0+i/(ks.length-1)*(box.x1-box.x0); g.fillText(k,x,box.y1+15); });
    const X=i=>box.x0+i/(ks.length-1)*(box.x1-box.x0), Y=v=>box.y1-(Math.max(0.3,v)-0.3)/0.7*(box.y1-box.y0);
    [[trA,"#e7c37a"],[teA,"#8bc0a4"]].forEach(([arr,col])=>{ g.strokeStyle=col; g.lineWidth=2; g.beginPath(); arr.forEach((v,i)=>i?g.lineTo(X(i),Y(v)):g.moveTo(X(i),Y(v))); g.stroke();
      arr.forEach((v,i)=>{ g.fillStyle=col; g.beginPath(); g.arc(X(i),Y(v),2.5,0,Math.PI*2); g.fill(); }); });
    const ki=ks.indexOf(+$("p4k").value); if(ki>=0){ g.strokeStyle="rgba(255,255,255,.4)"; g.setLineDash([3,3]); g.beginPath(); g.moveTo(X(ki),box.y0); g.lineTo(X(ki),box.y1); g.stroke(); g.setLineDash([]); }
  },
  predictView(){
    if(!this.model) return;
    const p=P();
    FEAT.forEach(f=>{ const v=this.inp[f.i], ok=v>=p[f.rk][0]&&v<=p[f.rk][1]; const el=$("piv_"+f.k);
      el.textContent=fmtU(v,f); el.style.color= f.k==="noise"? "var(--dim)" : ok? "var(--green)":"var(--rose)"; });
    const r=[...this.inp,0], z=this.model.tf(r), {nb}=neighbors(this.model,z,this.k,"e"), v=vote(nb);
    $("p4pred").innerHTML=`<div><div class="l">판정</div><div class="v" style="color:${SC[v.pred]}">${SN[v.pred]}</div></div>`+
      [0,1,2].map(s=>`<div><div class="l">${SN[s]} 확률</div><div class="v">${Math.round(v.c[s]/this.k*100)}%</div></div>`).join("");
    $("p4votes").innerHTML=[0,1,2].map(c=>`<div class="vb"><span>${SN[c]}</span><div class="tr"><div class="fl" style="width:${v.c[c]/this.k*100}%;background:${SC[c]}"></div></div><b>${v.c[c]}</b></div>`).join("");
    const fs=this.model.feats;
    $("p4nb").innerHTML=`<tr><th>이웃</th>${fs.map(f=>`<th>${f.name}</th>`).join("")}<th>거리</th><th>상태</th></tr>`+
      nb.map((n,i)=>{ const rr=this.model.raw[n.i]; return `<tr><td>${i+1}</td>${fs.map(f=>`<td>${fmt(rr[f.i],f)}</td>`).join("")}<td>${n.d.toFixed(2)}</td><td><span class="dot" style="background:${SC[n.y]}"></span>${SN[n.y]}</td></tr>`; }).join("");
  }
};

/* =====================================================================
   ⑤ 최적 조건 분석
   ===================================================================== */
const P5 = {
  derived:{},
  feats(){ return FEAT.filter(f=>f.k!=="noise"); },
  init(){
    $("p5k").addEventListener("input",()=>{ $("p5kv").textContent=$("p5k").value; this.render(); });
    $("p5th").addEventListener("input",()=>{ $("p5thv").textContent=$("p5th").value+"%"; this.render(); });
    ["p5hx","p5hy"].forEach((id,i)=>{ const s=$(id); this.feats().forEach(f=>s.add(new Option(f.name,f.k))); s.value=i?"temp":"soil"; s.onchange=()=>this.heat(); });
    $("p5curves").innerHTML=this.feats().map(f=>`<div><canvas class="cv" id="pc_${f.k}" height="190"></canvas></div>`).join("");
  },
  base(){ const p=P(), r=[0,0,0,0,0,0]; FEAT.forEach(f=>r[f.i]= f.log? Math.sqrt(p.lux[0]*p.lux[1]) : (p[f.rk][0]+p[f.rk][1])/2); return r; },
  probH(m,r,k){ const {nb}=neighbors(m,m.tf(r),k,"e"); return nb.filter(n=>n.y===0).length/k; },
  sweep(f){ const data=rows(); const vs=data.map(r=>r[f.i]); let lo=Math.min(...vs), hi=Math.max(...vs);
    const N=60, out=[]; for(let i=0;i<N;i++){ const t=i/(N-1); out.push(f.log? 10**(Math.log10(lo)+t*(Math.log10(hi)-Math.log10(lo))) : lo+t*(hi-lo)); } return out; },
  render(){
    const m=makeModel(rows(),this.feats(),{log:true,scale:true}); this.m=m;
    const k=+$("p5k").value, th=+$("p5th").value/100, p=P(), base=this.base();
    this.derived={};
    this.feats().forEach(f=>{
      const xs=this.sweep(f), ps=xs.map(x=>{ const r=[...base]; r[f.i]=x; return this.probH(m,r,k); });
      const ok=xs.filter((x,i)=>ps[i]>=th); this.derived[f.k]= ok.length? [Math.min(...ok),Math.max(...ok)] : null;
      const {g,w,h}=cv("pc_"+f.k), box={x0:40,y0:22,x1:w-10,y1:h-30};
      const lg=!!f.log, ax=v=>lg?Math.log10(v):v, A=ax(xs[0]), B=ax(xs[xs.length-1]);
      const X=v=>box.x0+(ax(v)-A)/(B-A)*(box.x1-box.x0), Y=v=>box.y1-v*(box.y1-box.y0);
      g.fillStyle="rgba(139,192,164,.12)"; g.fillRect(X(Math.max(p[f.rk][0],xs[0])),box.y0,X(Math.min(p[f.rk][1],xs[xs.length-1]))-X(Math.max(p[f.rk][0],xs[0])),box.y1-box.y0);
      g.strokeStyle="rgba(255,255,255,.12)"; g.strokeRect(box.x0,box.y0,box.x1-box.x0,box.y1-box.y0);
      g.strokeStyle="rgba(231,195,122,.5)"; g.setLineDash([4,3]); g.beginPath(); g.moveTo(box.x0,Y(th)); g.lineTo(box.x1,Y(th)); g.stroke(); g.setLineDash([]);
      g.strokeStyle="#8bc0a4"; g.lineWidth=2; g.beginPath(); xs.forEach((x,i)=>i?g.lineTo(X(x),Y(ps[i])):g.moveTo(X(x),Y(ps[i]))); g.stroke(); g.lineWidth=1;
      const d=this.derived[f.k]; if(d){ g.fillStyle="#e7c37a"; g.fillRect(X(d[0]),box.y1-4,Math.max(2,X(d[1])-X(d[0])),4); }
      g.fillStyle="#6d6f7d"; g.textAlign="center";
      for(let i=0;i<=4;i++){ const v=lg? 10**(A+(B-A)*i/4) : A+(B-A)*i/4; g.fillText(f.k==="lux"? Math.round(v/100)/10+"k": Math.round(v), box.x0+(box.x1-box.x0)*i/4, box.y1+14); }
      g.textAlign="right"; ["0","50%","100%"].forEach((t,i)=>g.fillText(t,box.x0-4,Y(i/2)+4));
      g.textAlign="left"; g.fillStyle="#e7c37a"; g.font="bold 12px Pretendard,sans-serif"; g.fillText(f.name+" ("+f.unit+") → 건강 확률",box.x0,14);
    });
    const show=(f,a)=>a? `${fmt(a[0],f)} ~ ${fmt(a[1],f)}` : "<span style='color:var(--rose)'>기준 넘는 구간 없음</span>";
    $("p5tab").innerHTML=`<thead><tr><th>변수</th><th>문헌 적정 범위</th><th>모델이 찾은 범위 (건강 확률 ≥ ${Math.round(th*100)}%)</th><th>차이 읽기</th></tr></thead><tbody>`+
      this.feats().map(f=>{ const L=p[f.rk], d=this.derived[f.k]; let note="—";
        if(d){ const dl=d[0]-L[0], dh=d[1]-L[1]; note = Math.abs(dl)<=(L[1]-L[0])*0.15 && Math.abs(dh)<=(L[1]-L[0])*0.15 ? "문헌과 거의 일치" : (d[1]-d[0] < L[1]-L[0] ? "모델이 더 좁게 봄 (보수적)" : "모델이 더 넓게 봄"); }
        return `<tr><td><b>${f.name}</b></td><td>${fmt(L[0],f)} ~ ${fmt(L[1],f)} ${f.unit}</td><td><b style="color:var(--accent)">${show(f,d)}</b> ${d?f.unit:""}</td><td>${note}</td></tr>`; }).join("")+"</tbody>";
    this.heat();
  },
  heat(){
    if(!this.m) return;
    const fx=FEAT.find(f=>f.k===$("p5hx").value), fy=FEAT.find(f=>f.k===$("p5hy").value), k=+$("p5k").value, p=P();
    const {g,w,h}=cv("p5heat"), box={x0:56,y0:12,x1:w-14,y1:h-42};
    if(fx===fy){ g.fillStyle="#9a9caa"; g.fillText("서로 다른 두 변수를 고르세요",box.x0,box.y0+20); return; }
    const xs=this.sweep(fx), ys=this.sweep(fy), N=xs.length, base=this.base();
    const cw=(box.x1-box.x0)/N, ch=(box.y1-box.y0)/N;
    for(let i=0;i<N;i+=1) for(let j=0;j<N;j+=1){ const r=[...base]; r[fx.i]=xs[i]; r[fy.i]=ys[j]; const pr=this.probH(this.m,r,k);
      g.fillStyle=`rgba(${Math.round(40+100*pr)},${Math.round(40+152*pr)},${Math.round(50+114*pr)},1)`; g.fillRect(box.x0+i*cw,box.y1-(j+1)*ch,cw+0.6,ch+0.6); }
    const rx=[fx.log?Math.log10(xs[0]):xs[0], fx.log?Math.log10(xs[N-1]):xs[N-1]], ry=[fy.log?Math.log10(ys[0]):ys[0], fy.log?Math.log10(ys[N-1]):ys[N-1]];
    drawAxes(g,box,fx,fy,rx,ry,true,false); optBox(g,box,fx,fy,rx,ry,true,p);
    const dx=this.derived[fx.k], dy=this.derived[fy.k];
    if(dx&&dy){ const sx=v=>box.x0+(axisVal(fx,v,true)-rx[0])/(rx[1]-rx[0])*(box.x1-box.x0), sy=v=>box.y1-(axisVal(fy,v,true)-ry[0])/(ry[1]-ry[0])*(box.y1-box.y0);
      g.strokeStyle="#e7c37a"; g.lineWidth=1.6; g.strokeRect(sx(dx[0]),sy(dy[1]),sx(dx[1])-sx(dx[0]),sy(dy[0])-sy(dy[1])); g.lineWidth=1; }
  },
  send(){
    const p=P(), d=this.derived, L=(k)=>d[k]||p[k];
    S6.setRule({soilOn:Math.round(L("soil")[0]), soilOff:Math.round(Math.min(L("soil")[1], L("soil")[0]+ (L("soil")[1]-L("soil")[0])*0.8)),
      tempHi:Math.round(L("temp")[1]), luxLo:Math.round(L("lux")[0]/100)*100, humLo:Math.round(L("hum")[0]), humHi:Math.round(L("hum")[1])});
    showPane("p6"); S6.run(true);
  }
};

/* =====================================================================
   ⑥ 자동화 시뮬레이터
   ===================================================================== */
const S6 = {
  rule:null, res:null, runs:[],
  RULES:[
    {k:"soilOn", name:"급수 시작 (수분 아래로)", unit:"%", min:5, max:80},
    {k:"soilOff", name:"급수 멈춤 (수분 위로)", unit:"%", min:10, max:95},
    {k:"tempHi", name:"환기팬 켜기 (온도 위로)", unit:"℃", min:18, max:35},
    {k:"luxLo", name:"식물등 켜기 (조도 아래로)", unit:"lux", min:200, max:30000, step:100},
    {k:"humLo", name:"가습기 켜기 (습도 아래로)", unit:"%", min:15, max:80},
    {k:"humHi", name:"환기팬 켜기 (습도 위로)", unit:"%", min:30, max:95},
    {k:"cap", name:"하루 급수량 상한", unit:"mL", min:50, max:800, step:10}],
  defRule(){ const p=P(); return {soilOn:p.soil[0], soilOff:Math.round(p.soil[0]+(p.soil[1]-p.soil[0])*0.8), tempHi:p.temp[1], luxLo:p.lux[0], humLo:p.hum[0], humHi:p.hum[1], cap:this.potSpec().cap}; },
  potSpec(){ return {s:{vol:400,cap:120,dose:30},m:{vol:900,cap:240,dose:40},l:{vol:2000,cap:480,dose:60}}[$("s6pot").value]; },  // dose = 펌프 3초에 나오는 물(mL)
  init(){
    this.rule=this.defRule(); this.drawRule();
    ["s6mode","s6place","s6pot","s6hys","s6cap","s6san","s6avg","e_heat","e_rain","e_fail","e_weekend","e_noise"].forEach(id=>$(id).addEventListener("change",()=>{ if(id==="s6pot"){ this.rule.cap=this.potSpec().cap; this.drawRule(); } this.run(); }));
    $("s6t").addEventListener("input",()=>this.scrub());
    $("s6c").addEventListener("click",e=>{ const r=$("s6c").getBoundingClientRect(); const t=Math.round((e.clientX-r.left-60)/(r.width-74)*1007); if(t>=0&&t<=1007){ $("s6t").value=t; this.scrub(); } });
  },
  setRule(r){ Object.assign(this.rule,r); this.drawRule(); },
  drawRule(){
    $("s6rule").innerHTML=this.RULES.map(r=>`<div class="card"><h4>${r.name}</h4>
      <input type="range" id="sr_${r.k}" min="${r.min}" max="${r.max}" step="${r.step||1}" value="${this.rule[r.k]}" style="width:100%">
      <b id="srv_${r.k}" style="font-family:var(--serif)">${this.rule[r.k].toLocaleString()} ${r.unit}</b></div>`).join("");
    this.RULES.forEach(r=>$("sr_"+r.k).addEventListener("input",()=>{ this.rule[r.k]=+$("sr_"+r.k).value; $("srv_"+r.k).textContent=this.rule[r.k].toLocaleString()+" "+r.unit; this.run(); }));
  },
  // ---- 환경과 화분 모델 ----
  simulate(mode){
    const p=P(), R=this.rule, pot=this.potSpec(), place=$("s6place").value;
    const ev={heat:$("e_heat").checked, rain:$("e_rain").checked, fail:$("e_fail").checked, weekend:$("e_weekend").checked, noise:$("e_noise").checked};
    const opt={hys:$("s6hys").checked, cap:$("s6cap").checked, san:$("s6san").checked, avg:$("s6avg").checked};
    const rnd=mulberry(11), gauss=()=>{ let u=0,v=0; while(!u)u=rnd(); v=rnd(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };
    const peak={window:30000, room:6000, dark:900}[place];
    const N=1008, out=[]; let soil=(p.soil[0]+p.soil[1])/2, tank= ev.weekend? 99999 : 99999;
    let pumpLeft=0, armed=true, watering=false, lastPulse=-99, waterToday=0, day=-1, hist=[], log=[], lastGood=soil, jumps=0, pumpCount=0;
    let fan=false, lamp=false, humid=false, pump=false, knnState=0, knnWhy="";
    const knnM = mode==="knn"? this.deviceModel() : null;   // 마이크로비트에 넣는 것과 같은 모델
    for(let t=0;t<N;t++){
      const d=Math.floor(t/144), hr=(t%144)/6;
      if(d!==day){ day=d; waterToday=0; if(ev.weekend&&d===5) tank=1000; }
      // 바깥 환경
      const sun=Math.max(0,Math.sin(Math.PI*(hr-6)/13));
      let lux= hr>=6&&hr<=19 ? peak*sun : 0;
      if(hr>=8&&hr<17&&d<5) lux+= place==="dark"? 250 : 350;   // 수업 중 교실 조명
      let temp=22.5+3.2*Math.sin(Math.PI*(hr-9)/12)+(place==="window"?1.5*sun:0);
      let hum=52-10*Math.sin(Math.PI*(hr-9)/12);
      if(ev.heat&&(d===2||d===3)) { temp+=7*(0.5+0.5*sun); hum-=8; }
      if(ev.rain&&(d===4||d===5)) { lux*=0.3; hum+=25; temp-=1.5; }
      const noise= hr>=8&&hr<17&&d<5 ? 55+8*rnd() : 32+5*rnd();
      // 장치가 환경을 바꿈
      if(lamp) lux+=12000*(place==="dark"?1:0.9);
      if(fan){ temp-=2.5; hum-=4; }
      if(humid) hum+=15;
      hum=Math.max(15,Math.min(95,hum));
      // 증발: 온도·빛이 높고 습도가 낮을수록 빨리 마른다 (10분당 %)
      const et = (0.055 + 0.012*Math.max(0,temp-18) + 0.06*Math.min(1,lux/20000)) * (1.25-hum/100) * (900/pot.vol)**0.6 * 0.5;
      soil-=et;
      let mlNow=0;
      if(pump){ mlNow=Math.min(pot.dose, tank); tank-=mlNow; waterToday+=mlNow; soil+=mlNow/(pot.vol*0.45)*100; }
      if(soil>88){ soil-= (soil-88)*0.5; }   // 넘친 물은 배수구로
      soil=Math.max(2,Math.min(95,soil));
      // 센서가 읽은 값
      const nz= ev.noise? 4 : 1.2;
      let sSoil = soil + gauss()*nz;
      if(ev.fail && d===1 && hr>=20 && hr<23) sSoil=0;
      const sTemp=temp+gauss()*0.3*(ev.noise?2:1), sLux=Math.max(0,lux*(1+gauss()*0.05)), sHum=hum+gauss()*1.5;
      // 필터와 이상 감지
      let mSoil=sSoil, anomaly=false;
      if(opt.san && (sSoil<=0.5 || (Math.abs(sSoil-lastGood)>25 && jumps<5))){ anomaly=true; mSoil=lastGood; if(sSoil>0.5) jumps++; }
      else { lastGood=sSoil; jumps=0; }
      hist.push(mSoil); if(hist.length>3) hist.shift();
      if(opt.avg) mSoil=hist.reduce((a,b)=>a+b)/hist.length;
      // ---- 제어 ----
      pump=false;
      const capOK = !opt.cap || waterToday + pot.dose <= R.cap;
      const hh=hr.toFixed(1);
      const L=(msg)=>{ if(log.length<400) log.push(`${d+1}일 ${String(Math.floor(hr)).padStart(2,"0")}:${String(Math.round((hr%1)*60)).padStart(2,"0")}  ${msg}`); };
      if(anomaly && (t===0||!out[t-1].anomaly)) L(`⚠ 수분 센서 이상값 ${sSoil.toFixed(0)}% — 무시하고 직전 값 사용`);
      if(mode==="timer"){
        if(t%144===54){ pumpLeft=2; L(`⏰ 오전 9시 — 센서와 상관없이 ${pot.dose*2}mL 급수`); }
      } else if(mode==="book"){
        if(mSoil>=70) armed=true;
        const need = mSoil<45 || (mSoil<=55 && ((sTemp>26 && sLux>20000) || noise>60));
        if(need&&armed&&pumpLeft===0&&capOK){ pumpLeft=1; armed=false; L(`💧 교과서 규칙: 수분 ${mSoil.toFixed(0)}% → 3초 급수 (재급수 잠금)`); }
      } else if(mode==="rule" || mode==="knn"){
        // 급수 상태 기계: 시작 기준 아래로 → '급수 중' → 30분마다 3초씩 → 멈춤 기준에 닿으면 끝
        const on=R.soilOn, off= opt.hys? R.soilOff : R.soilOn;
        let start = mSoil<on;
        if(mode==="knn" && t%3===0){
          const r=[mSoil,sTemp,Math.max(100,sLux),sHum,noise,0];
          knnState = predict(knnM, r, 7).pred;
          const out_=[]; FEAT.filter(f=>f.k!=="noise").forEach(f=>{ const v=r[f.i]; if(v<p[f.rk][0]) out_.push(f.k+"↓"); if(v>p[f.rk][1]) out_.push(f.k+"↑"); });
          knnWhy=out_.join(" ");
        }
        if(mode==="knn") start = start && knnState>0;
        if(!watering && start){ watering=true; L(mode==="knn"? `🤖 k-NN: ${SN[knnState]} · 원인 ${knnWhy||"-"} → 급수 시작` : `💧 수분 ${mSoil.toFixed(0)}% < ${on}% → 급수 시작`); }
        if(watering && mSoil>=off){ watering=false; L(`✔ 수분 ${mSoil.toFixed(0)}% ≥ ${off}% → 급수 끝`); }
        if(watering && pumpLeft===0 && capOK && t-lastPulse>=3){ pumpLeft=1; lastPulse=t; }  // 30분 스며들기
      }
      if(pumpLeft>0 && tank>0){ pump=true; pumpLeft--; pumpCount++; }
      if(!capOK && pumpLeft>0){ pumpLeft=0; L(`⛔ 하루 급수 상한 ${R.cap}mL 도달 — 급수 중지`); }
      if(tank<=0 && pumpLeft>0){ L("⛔ 물통이 비었습니다"); pumpLeft=0; }
      // 팬·식물등·가습기 (타이머·교과서 방식에는 없음)
      if(mode==="rule"||mode==="knn"){
        const hysT = opt.hys? 1.5 : 0;
        if(!fan && (sTemp>R.tempHi || sHum>R.humHi)){ fan=true; L(sTemp>R.tempHi? `🌀 온도 ${sTemp.toFixed(1)}℃ > ${R.tempHi}℃ → 환기팬` : `🌀 습도 ${sHum.toFixed(0)}% > ${R.humHi}% → 환기팬`); }
        else if(fan && sTemp<R.tempHi-hysT-2.5 && sHum<R.humHi-(opt.hys?5:0)-4){ fan=false; }
        const day_ = hr>=6&&hr<20;
        const luxNoLamp = sLux-(lamp?12000*(place==="dark"?1:0.9):0);
        if(!lamp && day_ && luxNoLamp<R.luxLo){ lamp=true; L(`💡 조도 ${Math.round(luxNoLamp)}lux < ${R.luxLo} → 식물등`); }
        else if(lamp && (!day_ || luxNoLamp>R.luxLo*(opt.hys?1.4:1))){ lamp=false; }
        if(!humid && sHum<R.humLo){ humid=true; L(`💨 습도 ${sHum.toFixed(0)}% < ${R.humLo}% → 가습기`); } else if(humid && sHum>Math.min(R.humHi-2, R.humLo+(opt.hys?8:0)+15)){ humid=false; }
      } else { fan=false; lamp=false; humid=false; }
      const inS=soil>=p.soil[0]&&soil<=p.soil[1], inT=temp>=p.temp[0]&&temp<=p.temp[1], inH=hum>=p.hum[0]&&hum<=p.hum[1];
      const dayLux = hr>=7&&hr<18; const inL = !dayLux || (lux>=p.lux[0]&&lux<=p.lux[1]*1.3);
      out.push({t,d,hr,soil,sSoil,mSoil,temp,lux,hum,noise,pump,fan,lamp,humid,anomaly,inS,inT,inH,inL,tank,knnState,knnWhy,ml:mlNow,water:waterToday});
    }
    return {out,log,pumpCount};
  },
  metrics(sim){
    const o=sim.out, n=o.length, p=P();
    const allOk=o.filter(r=>r.inS&&r.inT&&r.inH&&r.inL).length/n, soilOk=o.filter(r=>r.inS).length/n;
    const wet=o.filter(r=>r.soil>p.soil[1]+5).length/6, dry=o.filter(r=>r.soil<p.soil[0]-5).length/6;
    let water=0; o.forEach(r=>{ water+=r.ml; });
    return {allOk,soilOk,wet,dry,water,pumps:o.filter(r=>r.pump).length,lamp:o.filter(r=>r.lamp).length/6,fan:o.filter(r=>r.fan).length/6};
  },
  evText(){ return [["e_heat","폭염"],["e_rain","장마"],["e_fail","센서불량"],["e_weekend","주말"],["e_noise","잡음"]].filter(([id])=>$(id).checked).map(x=>x[1]).join("·")||"없음"; },
  run(record){
    const mode=$("s6mode").value; this.res=this.simulate(mode); const M=this.metrics(this.res); this.M=M;
    $("s6met").innerHTML=`<div><div class="l">모두 적정 유지</div><div class="v" style="color:var(--accent)">${(M.allOk*100).toFixed(0)}%</div></div>
      <div><div class="l">토양 수분 적정</div><div class="v">${(M.soilOk*100).toFixed(0)}%</div></div>
      <div><div class="l">과습 시간</div><div class="v" style="color:${M.wet>12?"var(--rose)":"inherit"}">${M.wet.toFixed(0)}h</div></div>
      <div><div class="l">건조 시간</div><div class="v" style="color:${M.dry>12?"var(--rose)":"inherit"}">${M.dry.toFixed(0)}h</div></div>
      <div><div class="l">물 사용</div><div class="v">${(M.water/1000).toFixed(2)}L</div></div>
      <div><div class="l">펌프 작동</div><div class="v">${M.pumps}회</div></div>
      <div><div class="l">식물등 · 팬</div><div class="v">${M.lamp.toFixed(0)}h · ${M.fan.toFixed(0)}h</div></div>`;
    this.chart(); this.scrub(); this.code();
    $("s6log").innerHTML=this.res.log.length? this.res.log.join("<br>") : "기록된 제어 동작이 없습니다.";
    if(record){ this.runs.push({plant:P().name, mode:$("s6mode").selectedOptions[0].text.split(" — ")[0], ev:this.evText(), ...M}); this.table(); }
  },
  table(){
    $("s6runs").innerHTML=`<tr><th>#</th><th>식물</th><th>방식</th><th>사건</th><th>모두 적정</th><th>수분 적정</th><th>과습 시간</th><th>건조 시간</th><th>물 사용</th><th>펌프</th><th>식물등</th><th>팬</th></tr>`+
      this.runs.map((r,i)=>`<tr><td>${i+1}</td><td>${r.plant}</td><td style="text-align:left">${r.mode}</td><td>${r.ev}</td><td><b>${(r.allOk*100).toFixed(0)}%</b></td><td>${(r.soilOk*100).toFixed(0)}%</td><td>${r.wet.toFixed(0)}h</td><td>${r.dry.toFixed(0)}h</td><td>${(r.water/1000).toFixed(2)}L</td><td>${r.pumps}</td><td>${r.lamp.toFixed(0)}h</td><td>${r.fan.toFixed(0)}h</td></tr>`).join("");
  },
  compare(){ const keep=$("s6mode").value; ["timer","book","rule","knn"].forEach(m=>{ $("s6mode").value=m; this.run(true); }); $("s6mode").value=keep; this.run(); },
  chart(){
    const {g,w,h}=cv("s6c"), o=this.res.out, p=P(), N=o.length;
    const L=60, Rr=14, tracks=[
      {k:"soil", name:"토양 수분 %", lo:0, hi:100, rng:p.soil, col:"#7fa8d4", sensor:true},
      {k:"temp", name:"온도 ℃", lo:10, hi:38, rng:p.temp, col:"#d98a7a"},
      {k:"lux", name:"조도 lux(로그)", lo:2, hi:4.8, rng:[Math.log10(p.lux[0]),Math.log10(p.lux[1])], col:"#e7c37a", log:true},
      {k:"hum", name:"습도 %", lo:10, hi:100, rng:p.hum, col:"#a99ad4"}];
    const th=(h-70)/tracks.length, X=t=>L+t/(N-1)*(w-L-Rr);
    // 밤 음영
    for(let t=0;t<N;t++){ const hr=o[t].hr; if(hr<6||hr>=19){ g.fillStyle="rgba(255,255,255,.025)"; g.fillRect(X(t),0,(w-L-Rr)/N+0.5,h-46); } }
    tracks.forEach((tr,ti)=>{
      const y0=8+ti*th, y1=y0+th-12, Y=v=>y1-(Math.max(tr.lo,Math.min(tr.hi,v))-tr.lo)/(tr.hi-tr.lo)*(y1-y0);
      g.fillStyle="rgba(139,192,164,.10)"; g.fillRect(L,Y(tr.rng[1]),w-L-Rr,Y(tr.rng[0])-Y(tr.rng[1]));
      g.strokeStyle="rgba(255,255,255,.1)"; g.strokeRect(L,y0,w-L-Rr,y1-y0);
      g.fillStyle="#9a9caa"; g.textAlign="right"; g.fillText(tr.name.split(" ")[0],L-6,(y0+y1)/2+4);
      g.fillStyle="#6d6f7d"; g.fillText(tr.log?"10k":tr.hi,L-6,y0+9); g.fillText(tr.log?"100":tr.lo,L-6,y1);
      if(tr.k==="soil"&&$("s6mode").value==="rule"){ g.strokeStyle="rgba(231,195,122,.6)"; g.setLineDash([3,3]);
        [this.rule.soilOn, $("s6hys").checked?this.rule.soilOff:null].forEach(v=>{ if(v==null) return; g.beginPath(); g.moveTo(L,Y(v)); g.lineTo(w-Rr,Y(v)); g.stroke(); }); g.setLineDash([]); }
      if(tr.sensor){ g.strokeStyle="rgba(127,168,212,.35)"; g.lineWidth=1; g.beginPath(); o.forEach((r,t)=>t?g.lineTo(X(t),Y(r.sSoil)):g.moveTo(X(t),Y(r.sSoil))); g.stroke(); }
      g.strokeStyle=tr.col; g.lineWidth=1.6; g.beginPath(); o.forEach((r,t)=>{ const v=tr.log?Math.log10(Math.max(100,r.lux)):r[tr.k]; t?g.lineTo(X(t),Y(v)):g.moveTo(X(t),Y(v)); }); g.stroke(); g.lineWidth=1;
      if(tr.k==="soil") o.forEach((r,t)=>{ if(r.anomaly){ g.fillStyle="rgba(217,138,122,.8)"; g.fillRect(X(t)-1,y0,2,6); } });
    });
    // 장치 막대
    const yA=h-58, acts=[["pump","#7fa8d4","펌프"],["lamp","#e7c37a","식물등"],["fan","#8bc0a4","팬"],["humid","#a99ad4","가습"]];
    acts.forEach(([k,col,nm],i)=>{ const y=yA+i*7-8; g.fillStyle="#6d6f7d"; g.textAlign="right"; g.font="9.5px Pretendard,sans-serif"; g.fillText(nm,L-6,y+6); g.fillStyle=col;
      o.forEach((r,t)=>{ if(r[k]) g.fillRect(X(t),y,Math.max(1.5,(w-L-Rr)/N+0.5),5); }); });
    g.font="11px Pretendard,sans-serif";
    g.fillStyle="#9a9caa"; g.textAlign="center"; for(let d=0;d<7;d++) g.fillText((d+1)+"일",X(d*144+72),h-6);
    this.cursorX=X;
  },
  scrub(){
    if(!this.res) return;
    const t=+$("s6t").value, r=this.res.out[t], p=P();
    this.chart(); const {g}={g:$("s6c").getContext("2d")}; const X=this.cursorX(t), H=+$("s6c").dataset.h;
    g.strokeStyle="rgba(255,255,255,.55)"; g.beginPath(); g.moveTo(X,0); g.lineTo(X,H-16); g.stroke();
    const face = r.pump? "arrow" : (r.inS? (r.soil>p.soil[1]?"surprised":"happy") : "sad");
    const F={happy:"0000001010000001000101110",sad:"0000001010000000111010001",arrow:"0010000100101010111000100",surprised:"0101000000001000101000100"}[face];
    $("s6led").innerHTML=[...F].map(c=>`<i class="${c==="1"?"on":""}"></i>`).join("");
    const hh=Math.floor(r.hr), mm=Math.round((r.hr%1)*60);
    $("s6now").innerHTML=`<b style="color:var(--tx)">${r.d+1}일차 ${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}</b><br>
      토양 수분 <b style="color:${r.inS?"var(--green)":"var(--rose)"}">${r.soil.toFixed(1)}%</b> <span class="mini2">(센서 ${r.sSoil.toFixed(0)}%${r.anomaly?" ⚠ 이상값":""})</span> ·
      온도 <b style="color:${r.inT?"var(--green)":"var(--rose)"}">${r.temp.toFixed(1)}℃</b><br>
      조도 <b>${Math.round(r.lux).toLocaleString()} lux</b> · 습도 <b style="color:${r.inH?"var(--green)":"var(--rose)"}">${r.hum.toFixed(0)}%</b> · 소음 ${r.noise.toFixed(0)}dB`+
      ($("s6mode").value==="knn"? `<br>k-NN 판정 <b style="color:${SC[r.knnState]}">${SN[r.knnState]}</b> ${r.knnWhy?"· 원인 "+r.knnWhy:""}`:"")+
      `<br>오늘 준 물 ${Math.round(r.water)}mL`;
    $("s6acts").innerHTML=[["pump","펌프 P1"],["lamp","식물등 P2"],["fan","환기팬 P8"],["humid","가습기 P12"]].map(([k,n])=>`<div class="${r[k]?"on":""}">${n}<b>${r[k]?"ON":"off"}</b></div>`).join("");
  },
  // ---- 마이크로비트 코드 생성 ----
  // 마이크로비트 안에 넣을 k-NN: 내장 센서로 잴 수 있는 수분·온도·조도만, 상태별로 고르게 90개
  deviceModel(){
    const data=rows(), pick=[];
    [0,1,2].forEach(s=>{ shuffle(data.length,5).filter(i=>data[i][5]===s).slice(0,30).forEach(i=>pick.push(data[i])); });
    return makeModel(pick, FEAT.filter(f=>["soil","temp","lux"].includes(f.k)), {log:true, scale:true});
  },
  code(){
    const R=this.rule, p=P(), mode=$("s6mode").value, pot=this.potSpec();
    const o={hys:$("s6hys").checked||mode==="book", cap:$("s6cap").checked, san:$("s6san").checked, avg:$("s6avg").checked};
    const on= mode==="book"?45:R.soilOn, off= mode==="book"?70:(o.hys?R.soilOff:R.soilOn);
    const L=[
`# smartpot.py — ${p.name} 스마트 화분 (8회차 실습실에서 자동 생성)`,
`# 제어 방식: ${$("s6mode").selectedOptions[0].text}`,
`from microbit import *`,
`import music`,
`import math`,
``,
`# ---------- 1. 보정값: 반드시 직접 재서 바꾸세요 ----------`,
`DRY = 820            # 마른 흙에 꽂았을 때 pin0 값`,
`WET = 380            # 물을 흠뻑 준 흙에서 pin0 값`,
`LUX_PER_LEVEL = 60   # 스마트폰 조도계 lux ÷ display.read_light_level()`,
`ML_PER_RUN = ${pot.dose}      # 펌프 3초에 나오는 물의 양 (컵에 받아 재기)`,
``];
    if(mode==="timer"){
      L.push(
`# ---------- 2. 타이머 방식: 센서를 보지 않는다 ----------`,
`# 마이크로비트에는 시계가 없어서, 전원을 켠 순간부터 24시간마다 급수합니다.`,
`pump = pin1`,
`pump.write_digital(0)`,
`tick = 0                     # 2초마다 1 → 43200이면 하루`,
``,
`def water():`,
`    display.show(Image.ARROW_S)`,
`    pump.write_digital(1)`,
`    sleep(3000)`,
`    pump.write_digital(0)`,
``,
`while True:`,
`    if tick % 43200 == 0:       # 하루에 한 번`,
`        water()`,
`        sleep(1000)`,
`        water()                  # 3초씩 두 번 = ${pot.dose*2}mL`,
`    soil = (DRY - pin0.read_analog()) * 100 // (DRY - WET)`,
`    print((soil,))               # 수분은 기록만 한다 — 비교용`,
`    display.show(Image.CLOCK12 if tick % 2 else Image.CLOCK6)`,
`    tick += 1`,
`    sleep(2000)`,
``,
`# 생각해 보기: 비 오는 날에도, 폭염에도 같은 양을 줍니다. 시뮬레이터의 과습 시간을 확인해 보세요.`);
    } else {
      L.push(
`# ---------- 2. 제어 기준 (실습실 ⑤·⑥에서 찾은 값) ----------`,
`SOIL_ON  = ${on}     # 이 값 아래로 내려가면 급수`,
`SOIL_OFF = ${off}     # ${mode==="book"?"이 값 위로 올라와야 다시 급수 허용":"급수 중 이 값에 닿으면 멈춤"}`,
`TEMP_HI  = ${R.tempHi}     # 이 값 위로 올라가면 환기팬`,
`LUX_LO   = ${R.luxLo}   # 낮에 이 값 아래면 식물등`,
`HUM_LO   = ${R.humLo}     # 습도가 이 값 아래면 가습기 (센서가 있을 때)`,
`HUM_HI   = ${R.humHi}     # 습도가 이 값 위면 환기팬 (센서가 있을 때)`,
`DAILY_CAP_ML = ${o.cap?R.cap:99999}   # 하루 급수량 상한`,
``);
      if(mode==="knn"){
        const m=this.deviceModel(), r3=v=>Math.round(v*100)/100;
        L.push(
`# ---------- 3. k-NN 모델 — 실습실 데이터에서 고른 기록 ${m.Z.length}개 ----------`,
`# 내장 센서로 잴 수 있는 토양 수분·온도·조도(로그)만 씁니다. 숫자는 표준화한 값입니다.`,
`MU = (${m.mu.map(r3).join(", ")})`,
`SD = (${m.sd.map(r3).join(", ")})`,
`K = 7`,
`DATA = (`);
        for(let i=0;i<m.Z.length;i+=3) L.push("    "+m.Z.slice(i,i+3).map((z,j)=>`(${z.map(r3).join(", ")}, ${m.y[i+j]})`).join(", ")+",");
        L.push(
`)`,
``,
`def knn(soil, temp, lux):`,
`    z = ((soil - MU[0]) / SD[0],`,
`         (temp - MU[1]) / SD[1],`,
`         (math.log(max(lux, 1)) / 2.302585 - MU[2]) / SD[2])   # log10`,
`    near = []`,
`    for a, b, c, s in DATA:                                     # STEP 2 거리`,
`        near.append(((a - z[0]) ** 2 + (b - z[1]) ** 2 + (c - z[2]) ** 2, s))`,
`    near.sort()                                                 # STEP 3 정렬`,
`    votes = [0, 0, 0]`,
`    for d, s in near[:K]:                                       # STEP 4 k개`,
`        votes[s] += 1`,
`    return votes.index(max(votes))                              # STEP 5 다수결 (0 건강·1 주의·2 위험)`,
``);
      }
      L.push(
`pump, lamp, fan, humidifier = pin1, pin2, pin8, pin12`,
`for p in (pump, lamp, fan, humidifier):`,
`    p.write_digital(0)`,
``,
`def read_soil():`,
`    raw = pin0.read_analog()`,
`    pct = (DRY - raw) * 100 // (DRY - WET)       # 값이 작을수록 젖은 흙`,
`    return max(0, min(100, pct)), raw`,
``,
`def read_lux():`,
`    return display.read_light_level() * LUX_PER_LEVEL`,
``,
`def read_humidity():`,
`    # 온습도 센서(예: BME280, I2C)를 달았다면 여기서 읽어 % 값을 돌려주세요.`,
`    # 센서가 없으면 None → 습도 제어는 건너뜁니다.`,
`    return None`,
``,
`def water():`,
`    global water_today`,
`    display.show(Image.ARROW_S)`,
`    pump.write_digital(1)`,
`    sleep(3000)                 # 한 번에 3초만 — 물이 퍼질 시간을 준다`,
`    pump.write_digital(0)`,
`    water_today += ML_PER_RUN`,
``,
`history = []`,
`last_good = None`,
`jumps = 0`,
`armed = True`,
`watering = False`,
`SOAK = 900                 # 급수 사이 기다림: 900 × 2초 = 30분 (물이 스며들 시간)`,
`last_pulse = -SOAK`,
`water_today = 0`,
`fan_on = False`,
`lamp_on = False`,
`tick = 0                   # 2초마다 1 → 43200이면 하루`,
``,
`while True:`,
`    soil, raw = read_soil()`,
`    temp = temperature()`,
`    lux = read_lux()`,
`    hum = read_humidity()`,
``);
      if(o.san) L.push(
`    # ---------- 안전장치 ① 센서 이상 감지 ----------`,
`    if raw < 30 or raw > 1000:`,
`        display.show("!")        # 선이 빠졌거나 센서가 흙 밖에 있음 → 급수하지 않는다`,
`        music.play(music.BA_DING, wait=False)`,
`        sleep(2000)`,
`        continue`,
`    if last_good is not None and abs(soil - last_good) > 25 and jumps < 5:`,
`        jumps += 1               # 갑자기 튄 값은 5번 연속일 때만 믿는다`,
`        sleep(2000)`,
`        continue`,
`    jumps = 0`,
`    last_good = soil`,
``);
      if(o.avg) L.push(
`    # ---------- 안전장치 ② 이동평균 (최근 3회) ----------`,
`    history.append(soil)`,
`    if len(history) > 3:`,
`        history.pop(0)`,
`    soil = sum(history) / len(history)`,
``);
      if(mode==="knn") L.push(
`    # ---------- k-NN 판정 → 원인이 수분일 때만 급수 ----------`,
`    state = knn(soil, temp, lux)`,
`    need = state > 0 and soil < SOIL_ON`,
``);
      else if(mode==="book") L.push(
`    # ---------- 교과서 규칙 (126쪽) ----------`,
`    sound = microphone.sound_level()`,
`    need = (soil < 45) or (45 <= soil <= 55 and ((temp > 26 and lux > 20000) or sound > 60))`,
``);
      else L.push(`    need = soil < SOIL_ON`, ``);
      if(mode==="book") L.push(
`    # ---------- 급수: 교과서 방식 — 한 번 주고 70%가 될 때까지 잠금 ----------`,
`    if soil >= SOIL_OFF:`,
`        armed = True`,
`    if need and armed and water_today + ML_PER_RUN <= DAILY_CAP_ML:`,
`        water()`,
`        armed = False   # 생각해 보기: 3초 급수로 70%에 못 닿으면 어떻게 될까?`,
``);
      else L.push(
`    # ---------- 급수: ${o.hys?"히스테리시스 — SOIL_ON 아래에서 시작, SOIL_OFF에 닿으면 끝":"단일 기준 — 같은 값에서 켜고 끈다"} ----------`,
`    if not watering and need:`,
`        watering = True`,
`    if watering and soil >= SOIL_OFF:`,
`        watering = False`,
`    if watering and tick - last_pulse >= SOAK and water_today + ML_PER_RUN <= DAILY_CAP_ML:`,
`        water()                  # 3초 주고 SOAK 동안 스며들기를 기다린 뒤 다시 잰다`,
`        last_pulse = tick`,
``);
      if(mode!=="book") L.push(
`    # ---------- 환기팬: 덥거나 습하면 ----------`,
`    too_humid = hum is not None and hum > HUM_HI`,
`    if temp > TEMP_HI or too_humid:`,
`        fan_on = True`,
`    elif temp < TEMP_HI - ${o.hys?2:0} and not too_humid:`,
`        fan_on = False`,
`    fan.write_digital(1 if fan_on else 0)`,
``,
`    # ---------- 가습기 ----------`,
`    if hum is not None:`,
`        if hum < HUM_LO:`,
`            humidifier.write_digital(1)`,
`        elif hum > HUM_LO + ${o.hys?15:1}:`,
`            humidifier.write_digital(0)`,
``,
`    # ---------- 식물등: 빛이 부족할 때만 ----------`,
`    if not lamp_on and lux < LUX_LO:`,
`        lamp_on = True`,
`    elif lamp_on and lux > LUX_LO * ${o.hys?1.4:1}:   # 식물등 빛까지 포함된 값이라 여유를 둔다`,
`        lamp_on = False`,
`    lamp.write_digital(1 if lamp_on else 0)`,
``);
      L.push(`    # ---------- 상태 표시 ----------`);
      if(mode==="knn") L.push(`    display.show((Image.HAPPY, Image.CONFUSED, Image.SAD)[state])`);
      else L.push(
`    if need:`,
`        display.show(Image.SAD)`,
`    elif soil > SOIL_OFF + 10:`,
`        display.show(Image.SURPRISED)   # 과습 경고`,
`    else:`,
`        display.show(Image.HAPPY)`);
      L.push(
``,
`    # ---------- 기록 (USB로 연결하면 편집기의 데이터 로거로 볼 수 있다) ----------`,
`    print((soil, temp, lux, 1 if fan_on else 0, 1 if lamp_on else 0, water_today))`,
``,
`    tick += 1`,
`    if tick >= 43200:            # 하루가 지나면 급수량 초기화`,
`        tick = 0`,
`        water_today = 0`,
`    sleep(2000)`);
    }
    this.src=L.join("\n");
    $("mbCode").innerHTML=this.src.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/(#[^\n]*)/g,'<span class="c">$1</span>');
  },
  copy(){ navigator.clipboard.writeText(this.src).then(()=>{ const b=event.target; const t=b.textContent; b.textContent="복사됨"; setTimeout(()=>b.textContent=t,1200); }); }
};

/* =====================================================================
   공통: 탭 · 식물 바꾸기
   ===================================================================== */
function showPane(id){
  document.querySelectorAll("#tabs .tab").forEach(t=>t.classList.toggle("active",t.dataset.p===id));
  document.querySelectorAll("section.pane").forEach(s=>s.classList.toggle("on",s.id===id));
  try{ localStorage.setItem(LS+"pane",id); }catch(e){}
  window.scrollTo({top:document.querySelector(".bar").offsetTop,behavior:"smooth"});
  refresh(id);
}
function refresh(id){
  if(id==="p1") K1.render();
  if(id==="p2") P2.render();
  if(id==="p3") P3.render();
  if(id==="p4") P4.run();
  if(id==="p5") P5.render();
  if(id==="p6") S6.run();
}
function setPlant(key){
  cur=key; try{ localStorage.setItem(LS+"plant",key); }catch(e){}
  $("plantSel").value=key;
  K1.q=null; K1.rebuild(); P4.resetInput(); S6.rule=S6.defRule(); S6.drawRule();
  refresh(document.querySelector("section.pane.on").id);
  if(document.querySelector("section.pane.on").id==="p2") P2.render();
}
function boot(){
  PLANTS.forEach(p=>$("plantSel").add(new Option(p.name,p.key))); $("plantSel").value=cur;
  $("plantSel").onchange=()=>setPlant($("plantSel").value);
  document.querySelectorAll("#tabs .tab").forEach(t=>t.onclick=()=>showPane(t.dataset.p));
  K1.init(); P2.init(); P3.init(); P4.init(); P5.init(); S6.init();
  let pane="p1"; try{ pane=localStorage.getItem(LS+"pane")||"p1"; }catch(e){}
  document.querySelectorAll("#tabs .tab").forEach(t=>t.classList.toggle("active",t.dataset.p===pane));
  document.querySelectorAll("section.pane").forEach(s=>s.classList.toggle("on",s.id===pane));
  refresh(pane);
  let rt; window.addEventListener("resize",()=>{ clearTimeout(rt); rt=setTimeout(()=>refresh(document.querySelector("section.pane.on").id),150); });
}
boot();
