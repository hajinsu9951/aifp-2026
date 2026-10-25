/* 5회차 연구 실습실 — 낙상 감지의 수학: 벡터의 크기와 신호 다듬기
   신호는 모두 교육용 가상 데이터입니다(씨앗 고정 난수로 매번 같은 값이 만들어집니다). */
"use strict";

/* =====================================================================
   0. 공통 도구
   ===================================================================== */
const FS = 20;            // 표본화 주파수(Hz) — 50ms마다 한 번
const DT = 1000 / FS;     // 50ms
const LEN = 160;          // 한 시행 8초
const $ = id => document.getElementById(id);
const r1 = v => Math.round(v);
const nf = v => Math.round(v).toLocaleString("ko-KR");
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
function gauss(r){let u=0;while(!u)u=r();const v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
const U = (r,a,b) => a + (b-a)*r();
const D2R = Math.PI/180;
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;");

/* =====================================================================
   1. 교육용 가상 가속도 데이터
   - 크기 윤곽 m(t)와 자세(기울기 θ, 방위 φ)를 먼저 정하고
     a = m·u(θ,φ) + 잡음 으로 세 축 값을 만듭니다.
   - 똑바로 서서 허리에 찼을 때 중력은 −y 방향(약 −1000mg)으로 읽힙니다.
   ===================================================================== */
const SCN = [
  {k:"stand", name:"가만히 서 있기",       fall:false, n:10, d:"제자리에 서서 숨만 쉽니다."},
  {k:"walk",  name:"걷기",                 fall:false, n:10, d:"보통 빠르기로 복도를 걷습니다."},
  {k:"run",   name:"달리기",               fall:false, n:10, d:"발이 땅에서 떨어지는 순간이 있습니다."},
  {k:"sit",   name:"의자에 털썩 앉기",     fall:false, n:10, d:"힘을 빼고 의자에 주저앉습니다."},
  {k:"jump",  name:"제자리 점프",          fall:false, n:10, d:"공중에 떠 있다가 착지합니다."},
  {k:"lie",   name:"천천히 눕기",          fall:false, n:10, d:"침대에 천천히 누워 자세만 바뀝니다."},
  {k:"drop",  name:"기기 떨어뜨리기",      fall:false, n:10, d:"손에 든 마이크로비트를 약 1m 높이에서 떨어뜨립니다."},
  {k:"fallH", name:"낙상 · 세게 넘어짐",   fall:true,  n:20, d:"걷다가 미끄러져 바닥에 세게 넘어집니다."},
  {k:"fallS", name:"낙상 · 주저앉듯 쓰러짐", fall:true, n:20, d:"어지러워 무릎이 꺾이며 천천히 쓰러집니다."}
];
// 충격 뒤 출렁임: 정점 앞 1개, 정점, 그 뒤 7개 (정점 초과분에 곱하는 배율)
const RING = [0.38, 1, 0.42, 0.74, 0.3, 0.5, 0.16, 0.26, 0.06];

function genTrace(si, trial){
  const sc = SCN[si], r = mulberry(1000*(si+1) + trial*7919 + 5);
  const m = new Array(LEN).fill(1000), th = new Array(LEN).fill(0), sg = new Array(LEN).fill(12);
  const ph0 = U(r,0,360), ph = new Array(LEN).fill(ph0);
  const sway = U(r,1,3), swf = U(r,0.2,0.4), sw0 = U(r,0,6.28);
  for(let i=0;i<LEN;i++) th[i] = sway*Math.sin(2*Math.PI*swf*i/FS + sw0);
  const tE = Math.round(U(r,2.6,3.4)*FS);                         // 사건 시작 표본
  const walk = (i0,i1,f,A,tilt) => { const p0=U(r,0,6.28);
    for(let i=i0;i<i1;i++){ const t=i/FS;
      m[i] = 1000 + A*Math.sin(2*Math.PI*f*t+p0) + 0.35*A*Math.sin(4*Math.PI*f*t+p0*1.7);
      th[i] = tilt + 5*Math.sin(Math.PI*f*t+p0); sg[i]=35; } };
  const ramp = (arr,i0,i1,a,b) => { for(let i=i0;i<=i1&&i<LEN;i++){ if(i<0)continue; arr[i] = a + (b-a)*(i1===i0?1:(i-i0)/(i1-i0)); } };
  const fill = (arr,i0,i1,v) => { for(let i=Math.max(0,i0);i<i1&&i<LEN;i++) arr[i]=v; };
  const ring = (ip,P,k) => { RING.forEach((g,j)=>{ const i=ip-1+j; if(i>=0&&i<LEN) m[i] = 1000 + (P-1000)*g*(k??1)*U(r,0.9,1.1); sg[i]=45; }); return ip-1+RING.length; };
  const still = (i0,tilt,phv) => { for(let i=i0;i<LEN;i++){ m[i]=1000; th[i]=tilt+U(r,-0.6,0.6); if(phv!=null) ph[i]=phv; sg[i]=10; } };

  switch(sc.k){
    case "stand": break;
    case "walk": walk(0,LEN,U(r,1.7,2.0),U(r,260,380),3); break;
    case "run": { const f=U(r,2.5,2.9); let cyc=-1, low=500, pk=2200; const p0=r();
      for(let i=0;i<LEN;i++){ const x=i/FS*f+p0, c=Math.floor(x), p=x-c;
        if(c!==cyc){ cyc=c; low=U(r,460,720); pk=U(r,1900,2700); }
        const K=[[0,1050],[0.15,low],[0.4,low+60],[0.5,pk],[0.62,1350],[0.8,1000],[1,1050]];
        let v=1000; for(let j=0;j<K.length-1;j++) if(p>=K[j][0]&&p<=K[j+1][0]){ v=K[j][1]+(K[j+1][1]-K[j][1])*(p-K[j][0])/(K[j+1][0]-K[j][0]); break; }
        m[i]=v; th[i]=8+6*Math.sin(2*Math.PI*x); sg[i]=55; } break; }
    case "sit": { const dip=U(r,520,720), P=U(r,1650,2350), lean=U(r,18,32), dn=Math.round(U(r,5,7));
      ramp(m,tE,tE+2,1000,dip); fill(m,tE+2,tE+dn,dip); ramp(th,tE,tE+dn,0,lean*0.6);
      const e=ring(tE+dn+1,P,0.8); ramp(th,tE+dn,e,lean*0.6,lean); still(e,lean); break; }
    case "jump": { const P=U(r,2800,3900), air=Math.round(U(r,7,10));
      ramp(m,tE,tE+3,1000,700); ramp(m,tE+3,tE+5,700,U(r,1650,2000));
      ramp(m,tE+5,tE+6,1700,U(r,20,80)); fill(m,tE+6,tE+6+air,U(r,20,80));
      const e=ring(tE+6+air+1,P); for(let i=e;i<LEN;i++){ m[i]=1000; sg[i]=14; } break; }
    case "lie": { const dur=Math.round(U(r,40,52)), tilt=U(r,82,96);
      for(let i=tE;i<tE+dur&&i<LEN;i++){ const q=(i-tE)/dur; th[i]=tilt*(0.5-0.5*Math.cos(Math.PI*q)); m[i]=1000+60*Math.sin(2*Math.PI*q*1.5); sg[i]=22; }
      still(tE+dur,tilt); break; }
    case "drop": { const P=U(r,3600,6000), ff=Math.round(U(r,8,9)), lv=U(r,8,30), tilt0=U(r,5,20);
      for(let i=0;i<tE;i++){ th[i]+=tilt0; sg[i]=18; }
      ramp(m,tE,tE+1,1000,lv); fill(m,tE+1,tE+ff,lv); ramp(th,tE,tE+ff,tilt0,tilt0+U(r,40,140));
      const e=ring(tE+ff+1,P,1.1); still(e,U(r,86,94),180); break; }
    case "fallH": { walk(0,tE,U(r,1.7,2.0),U(r,260,380),3);
      const ff=Math.round(U(r,6,9)), lv=U(r,120,360), P=U(r,2500,4300), tilt=U(r,80,100);
      ramp(m,tE,tE+2,1000,lv); fill(m,tE+2,tE+ff,lv); ramp(th,tE,tE+ff,3,tilt*0.65);
      const e=ring(tE+ff+1,P); ramp(th,tE+ff,tE+ff+3,tilt*0.65,tilt); still(e,tilt); break; }
    case "fallS": { if(r()<0.5) walk(0,tE,U(r,1.5,1.8),U(r,200,300),3);
      const ff=Math.round(U(r,8,12)), lv=U(r,280,680), P=U(r,1500,2450), tilt=U(r,65,95);
      ramp(m,tE,tE+3,1000,lv); fill(m,tE+3,tE+ff,lv); ramp(th,tE,tE+ff,3,tilt*0.6);
      const e=ring(tE+ff+1,P,0.85); ramp(th,tE+ff,tE+ff+4,tilt*0.6,tilt); still(e,tilt); break; }
  }
  const x=[],y=[],z=[];
  for(let i=0;i<LEN;i++){
    const t=th[i]*D2R, p=ph[i]*D2R, mm=Math.max(0,m[i]);
    x.push(r1(mm*Math.sin(t)*Math.sin(p) + gauss(r)*sg[i]));
    y.push(r1(-mm*Math.cos(t)          + gauss(r)*sg[i]));
    z.push(r1(mm*Math.sin(t)*Math.cos(p) + gauss(r)*sg[i]));
  }
  return {si, trial, x, y, z, tE};
}
const DATA = SCN.map((s,si)=>Array.from({length:s.n},(_,t)=>genTrace(si,t)));

const mag3 = (x,y,z) => Math.sqrt(x*x+y*y+z*z);
// 측정 범위(±2g면 각 축이 ±2048에서 잘립니다)
function view(tr, range, rot){
  const lim = range==="2g" ? 2048 : 8192, c = v => Math.max(-lim, Math.min(lim, v));
  const X=[],Y=[],Z=[],M=[];
  for(let i=0;i<LEN;i++){
    let x=tr.x[i], y=tr.y[i], z=tr.z[i];
    if(rot){ const t=x; x=-y; y=t; }            // 기기를 옆으로 90° 돌려 찬 경우 (z축 기준 회전)
    x=c(x); y=c(y); z=c(z);
    X.push(x); Y.push(y); Z.push(z); M.push(mag3(x,y,z));
  }
  return {x:X,y:Y,z:Z,m:M};
}

/* =====================================================================
   2. 판정기 — 생성되는 MicroPython 코드와 한 줄씩 같은 순서로 계산합니다.
   ===================================================================== */
const DEF = {T_ON:2000, hys:false, T_OFF:1500, K:1, M:1, ff:false, FF:400, posture:false, range:"2g"};
const S = Object.assign({}, DEF);
try { const sv = JSON.parse(localStorage.getItem("aifp2026_lab05_set")||"null"); if(sv) Object.assign(S, sv); } catch(e){}
const save = () => { try{ localStorage.setItem("aifp2026_lab05_set", JSON.stringify(S)); }catch(e){} };
const FFW = 20;       // 자유낙하 뒤 1초(20표본) 안에 충격이 와야 함
const STILL = 200;    // 충격 뒤 '가만히 있음' 허용 폭(mg)
const COS45 = 0.707;  // 자세가 45° 넘게 바뀌었는가

function detect(v, s){
  const tOff = s.hys ? Math.min(s.T_OFF, s.T_ON) : s.T_ON;
  const buf = new Array(s.K).fill(1000), hist = [];
  let count=0, armed=true, ffLeft=0, wait=0, pre=null, post=[];
  const out = {avg:[], impacts:[], alarms:[], rejects:[], ffOn:[]};
  for(let i=0;i<LEN;i++){
    const x=v.x[i], y=v.y[i], z=v.z[i];
    const mag = Math.sqrt(x*x+y*y+z*z);
    buf.shift(); buf.push(mag);
    let sum=0; for(const b of buf) sum+=b;
    const avg = sum / s.K;
    out.avg.push(avg);
    hist.push([x,y,z]); if(hist.length>30) hist.shift();
    if(s.ff){ if(mag < s.FF) ffLeft = FFW; else if(ffLeft>0) ffLeft -= 1; }
    out.ffOn.push(s.ff ? ffLeft>0 : true);
    const ffOK = s.ff ? ffLeft>0 : true;
    if(armed){
      if(avg > s.T_ON && ffOK) count += 1; else count = 0;
      if(count >= s.M){
        armed=false; count=0; out.impacts.push(i);
        if(s.posture){
          if(wait===0){ pre = meanVec(hist.slice(0,10)); wait = 40; post = []; }
        } else out.alarms.push(i);
      }
    } else if(avg < tOff){ armed = true; }
    if(s.posture && wait>0){
      wait -= 1;
      if(wait < 20) post.push([x,y,z]);
      if(wait === 0){
        const q = meanVec(post);
        const okStill = post.every(p => Math.abs(Math.sqrt(p[0]*p[0]+p[1]*p[1]+p[2]*p[2]) - 1000) < STILL);
        const c = cosAng(pre, q);
        if(okStill && c < COS45) out.alarms.push(i); else out.rejects.push({i, okStill, c});
      }
    }
  }
  return out;
}
function meanVec(a){ let x=0,y=0,z=0; for(const p of a){x+=p[0];y+=p[1];z+=p[2];} const n=a.length||1; return [x/n,y/n,z/n]; }
function cosAng(a,b){ const d=a[0]*b[0]+a[1]*b[1]+a[2]*b[2], n=Math.hypot(...a)*Math.hypot(...b); return n? d/n : 1; }

function evaluate(s){
  const rows = SCN.map((sc,si)=>{ let hit=0, total=0;
    DATA[si].forEach(tr=>{ const o=detect(view(tr,s.range,false), s); if(o.alarms.length) hit++; total+=o.alarms.length; });
    return {sc, n:sc.n, hit, total}; });
  const F = rows.filter(r=>r.sc.fall), N = rows.filter(r=>!r.sc.fall);
  const sum = (a,k) => a.reduce((t,r)=>t+r[k],0);
  return {rows, TP:sum(F,"hit"), FN:sum(F,"n")-sum(F,"hit"), FP:sum(N,"hit"), TN:sum(N,"n")-sum(N,"hit"),
          nF:sum(F,"n"), nN:sum(N,"n"), alarms:sum(rows,"total")};
}

/* 노드에서 검산할 때 쓰는 내보내기 */
if(typeof module!=="undefined"){ module.exports = {SCN, DATA, genTrace, view, detect, evaluate, DEF, LEN, FS, mag3}; }

/* =====================================================================
   3. MicroPython 코드 생성 — detect()와 같은 순서
   ===================================================================== */
function genCode(s){
  const L=[], P=(t)=>L.push(t);
  const tOff = s.hys ? Math.min(s.T_OFF, s.T_ON) : s.T_ON;
  P("# 낙상 감지 — 5회차 연구 실습실에서 자동 생성 (단위: mg, 1g ≈ 1000mg)");
  P("from microbit import *");
  P("import music");
  P("");
  P("T_ON = "+s.T_ON+"        # 충격 임계값: 이동평균이 이 값을 넘으면 충격");
  P(s.hys ? "T_OFF = "+tOff+"       # 히스테리시스: 이 값 아래로 내려와야 다음 충격을 다시 봄"
          : "T_OFF = T_ON     # 히스테리시스 없음 (기준이 하나)");
  P("K = "+s.K+"            # 이동평균 창 크기 (최근 K개 평균)");
  P("M = "+s.M+"            # 임계값을 연속으로 넘어야 하는 표본 수");
  if(s.ff){ P("FF = "+s.FF+"         # 자유낙하 기준: 크기가 이 값보다 작으면 '떨어지는 중'");
            P("FFW = 20         # 자유낙하 뒤 충격을 기다리는 표본 수 (20 x 50ms = 1초)"); }
  if(s.posture){ P("STILL = 200      # 충격 뒤 '가만히 있음'으로 볼 허용 폭 (1000 ± 200)");
                 P("COS45 = 0.707    # cos 45° — 자세가 45° 넘게 바뀌었는지 비교"); }
  P("");
  if(s.range==="8g") P("accelerometer.set_range(8)   # 측정 범위 ±8g (기본 ±2g에서는 축마다 약 2048에서 잘림)");
  P("buf = [1000] * K   # 이동평균용 최근 값 (처음엔 정지 상태 1000으로 채움)");
  P("count = 0");
  P("armed = True       # True: 새 충격을 기다리는 중");
  P("sos = False");
  if(s.ff) P("ff_left = 0        # 자유낙하 뒤 남은 기다림 표본 수");
  if(s.posture){ P("hist = []          # 최근 30개 (x, y, z) — 충격 전 자세를 기억");
                 P("wait = 0           # 자세 확인까지 남은 표본 수");
                 P("pre = None");
                 P("post = []"); }
  P("");
  if(s.posture){
    P("def mean_vec(pts):");
    P("    n = len(pts)");
    P("    return (sum(p[0] for p in pts) / n,");
    P("            sum(p[1] for p in pts) / n,");
    P("            sum(p[2] for p in pts) / n)");
    P("");
    P("def size(v):");
    P("    return (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) ** 0.5");
    P("");
    P("def cos_angle(a, b):");
    P("    # 두 벡터가 이루는 각의 코사인 = 내적 / (크기 x 크기)");
    P("    dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]");
    P("    n = size(a) * size(b)");
    P("    if n == 0:");
    P("        return 1");
    P("    return dot / n");
    P("");
  }
  P("def raise_sos():");
  P("    global sos");
  P("    if not sos:");
  P("        sos = True");
  P("        display.scroll('SOS', wait=False, loop=True)");
  P("        music.play(music.POWER_UP, wait=False)");
  P("");
  P("display.show('-')");
  P("while True:");
  P("    x = accelerometer.get_x()");
  P("    y = accelerometer.get_y()");
  P("    z = accelerometer.get_z()");
  P("    mag = (x * x + y * y + z * z) ** 0.5   # 벡터의 크기");
  P("    buf.pop(0)");
  P("    buf.append(mag)");
  P("    avg = sum(buf) / K                      # 이동평균");
  if(s.posture){ P("    hist.append((x, y, z))");
                 P("    if len(hist) > 30:");
                 P("        hist.pop(0)"); }
  if(s.ff){ P("    if mag < FF:");
            P("        ff_left = FFW");
            P("    elif ff_left > 0:");
            P("        ff_left -= 1"); }
  P("    if armed:");
  P("        if avg > T_ON"+(s.ff?" and ff_left > 0":"")+":");
  P("            count += 1");
  P("        else:");
  P("            count = 0");
  P("        if count >= M:");
  P("            armed = False");
  P("            count = 0");
  if(s.posture){ P("            if wait == 0:              # 충격! 1~2초 뒤 자세를 확인");
                 P("                pre = mean_vec(hist[0:10])   # 1.5~1초 전의 자세");
                 P("                wait = 40");
                 P("                post = []"); }
  else P("            raise_sos()");
  P("    elif avg < T_OFF:");
  P("        armed = True");
  if(s.posture){
    P("    if wait > 0:");
    P("        wait -= 1");
    P("        if wait < 20:");
    P("            post.append((x, y, z))");
    P("        if wait == 0:");
    P("            q = mean_vec(post)");
    P("            still = all(abs(size(p) - 1000) < STILL for p in post)");
    P("            if still and cos_angle(pre, q) < COS45:");
    P("                raise_sos()");
  }
  P("    if sos and button_a.was_pressed():     # A 버튼 = 알림 취소");
  P("        sos = False");
  P("        display.show('-')");
  P("    sleep(50)                               # 약 20Hz");
  return L.join("\n");
}
if(typeof module!=="undefined"){ module.exports.genCode = genCode; }

/* =====================================================================
   4. 화면 (브라우저에서만)
   ===================================================================== */
if(typeof document!=="undefined"){

const COL = {x:"#7fa8d4", y:"#8bc0a4", z:"#d98a7a", m:"#e7c37a", dim:"#6d6f7d", grid:"rgba(255,255,255,.07)", txt:"#6d6f7d", vio:"#a99ad4"};
function cv(id){
  const c=$(id), dpr=window.devicePixelRatio||1, w=c.clientWidth||300;
  if(!c.dataset.h) c.dataset.h=c.getAttribute("height");
  const h=+c.dataset.h;
  if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);c.style.height=h+"px";}
  const g=c.getContext("2d"); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,w,h);
  g.font="11px Pretendard,'Malgun Gothic',sans-serif"; return {c,g,w,h};
}
function niceStep(span){ for(const s of [50,100,200,250,500,1000,2000,2500,5000]) if(span/s<=6) return s; return 10000; }
function runs(b){ const out=[]; let s=-1; b.forEach((v,i)=>{ if(v&&s<0)s=i; if(!v&&s>=0){out.push([s,i-1]);s=-1;} }); if(s>=0) out.push([s,b.length-1]); return out; }
/* o: {series:[{d,c,w,dash}], ymin,ymax, hl:[{v,c,dash,t}], shade:[{i0,i1,c}], vm:[{i,c}], pts:[{i,v,c,sym}], sel, yl} */
function lineChart(id, o){
  const {c,g,w,h}=cv(id), n=o.n||LEN;
  const x0=46, x1=w-10, y0=10, y1=h-24;
  const sx=i=>x0+(x1-x0)*i/(n-1), sy=v=>y1-(v-o.ymin)/(o.ymax-o.ymin)*(y1-y0);
  c._m={x0,x1,n};
  (o.shade||[]).forEach(s=>{ g.fillStyle=s.c; g.fillRect(sx(s.i0)-2,y0,Math.max(4,sx(s.i1)-sx(s.i0)+4),y1-y0); });
  const st=niceStep(o.ymax-o.ymin); g.lineWidth=1; g.fillStyle=COL.txt; g.textAlign="right";
  for(let v=Math.ceil(o.ymin/st)*st; v<=o.ymax; v+=st){ g.strokeStyle=v===0?"rgba(255,255,255,.2)":COL.grid; g.beginPath(); g.moveTo(x0,sy(v)); g.lineTo(x1,sy(v)); g.stroke(); g.fillText(v,x0-5,sy(v)+4); }
  g.textAlign="center";
  const tstep = w<480 ? 2 : 1;
  for(let t=0;t<=n/FS;t+=tstep){ const px=sx(t*FS); if(px>x1+1) break; g.strokeStyle=COL.grid; g.beginPath(); g.moveTo(px,y0); g.lineTo(px,y1); g.stroke(); g.fillText(t+"초",px,y1+15); }
  g.save(); g.beginPath(); g.rect(x0,y0,x1-x0,y1-y0); g.clip();
  (o.hl||[]).forEach(l=>{ g.strokeStyle=l.c; g.setLineDash(l.dash?[5,4]:[]); g.lineWidth=1.2; g.beginPath(); g.moveTo(x0,sy(l.v)); g.lineTo(x1,sy(l.v)); g.stroke(); g.setLineDash([]);
    if(l.t){ g.fillStyle=l.c; g.textAlign="right"; g.fillText(l.t,x1-4,sy(l.v)-4); } });
  (o.vm||[]).forEach(l=>{ g.strokeStyle=l.c; g.setLineDash([3,3]); g.beginPath(); g.moveTo(sx(l.i),y0); g.lineTo(sx(l.i),y1); g.stroke(); g.setLineDash([]); });
  (o.series||[]).forEach(s=>{ g.strokeStyle=s.c; g.lineWidth=s.w||1.5; g.setLineDash(s.dash||[]); g.beginPath();
    s.d.forEach((v,i)=>{ const px=sx(i), py=sy(v); i?g.lineTo(px,py):g.moveTo(px,py); }); g.stroke(); g.setLineDash([]); });
  (o.pts||[]).forEach(p=>{ const px=sx(p.i), py=Math.max(y0+16,Math.min(y1-4,sy(p.v))); g.fillStyle=p.c; g.strokeStyle=p.c; g.lineWidth=2;
    if(p.sym==="tri"){ g.beginPath(); g.moveTo(px-6,py-14); g.lineTo(px+6,py-14); g.lineTo(px,py-5); g.closePath(); g.fill(); }
    else if(p.sym==="x"){ g.beginPath(); g.moveTo(px-5,py-5); g.lineTo(px+5,py+5); g.moveTo(px+5,py-5); g.lineTo(px-5,py+5); g.stroke(); }
    else { g.beginPath(); g.arc(px,py,6,0,7); g.fill(); } });
  if(o.sel!=null){ g.strokeStyle="rgba(255,255,255,.55)"; g.lineWidth=1; g.beginPath(); g.moveTo(sx(o.sel),y0); g.lineTo(sx(o.sel),y1); g.stroke(); }
  g.restore();
  g.strokeStyle="rgba(255,255,255,.16)"; g.lineWidth=1; g.strokeRect(x0,y0,x1-x0,y1-y0);
  if(o.yl){ g.save(); g.fillStyle=COL.txt; g.translate(11,(y0+y1)/2); g.rotate(-Math.PI/2); g.textAlign="center"; g.fillText(o.yl,0,0); g.restore(); }
}
function pickIndex(id, ev){ const c=$(id), m=c._m; if(!m) return null; const r=c.getBoundingClientRect(); const px=ev.clientX-r.left;
  return Math.max(0,Math.min(m.n-1,Math.round((px-m.x0)/(m.x1-m.x0)*(m.n-1)))); }
function fillSel(sel, list){ sel.innerHTML=""; list.forEach((t,i)=>sel.add(new Option(t,i))); }
function scnSel(scId, trId, def){
  const a=$(scId), b=$(trId);
  fillSel(a, SCN.map(s=>s.name+(s.fall?" ★":""))); a.value=def;
  const upd=()=>{ const n=SCN[+a.value].n, keep=+b.value||0; fillSel(b, Array.from({length:n},(_,i)=>(i+1)+"번")); b.value=Math.min(keep,n-1); };
  upd(); a.addEventListener("change",()=>{ b.value=0; upd(); });
  return ()=>DATA[+a.value][+b.value];
}

/* ---------------- ① 벡터 크기 손계산 ---------------- */
const V1 = {
  v:[600,0,-800], step:3, q:null,
  QS:[[1,2,2],[2,3,6],[1,4,8],[4,4,7],[2,6,9],[6,6,7],[3,4,12],[8,9,12],[12,9,20],[2,10,11],[6,10,15],[0,6,8]],
  init(){
    ["x","y","z"].forEach((k,j)=>{ const r=$("v"+k), n=$("v"+k+"n");
      r.oninput=()=>{ this.v[j]=+r.value; n.value=r.value; this.render(); };
      n.oninput=()=>{ const v=Math.max(-2048,Math.min(2048,Math.round(+n.value||0))); this.v[j]=v; r.value=v; this.render(); }; });
    document.querySelectorAll("#p1 [data-v]").forEach(b=>b.onclick=()=>{ this.set(b.dataset.v.split(",").map(Number)); this.render(); });
    document.querySelectorAll("#v3steps button").forEach(b=>b.onclick=()=>{ this.step=+b.dataset.s; this.render(); });
    $("v3yaw").oninput=()=>this.draw();
    $("qchk").onclick=()=>this.check(); $("qnew").onclick=()=>this.newQ();
    $("qa").addEventListener("keydown",e=>{ if(e.key==="Enter") this.check(); });
    this.set(this.v); this.newQ();
  },
  set(v){ this.v=v.slice(); ["x","y","z"].forEach((k,j)=>{ $("v"+k).value=v[j]; $("v"+k+"n").value=v[j]; }); this.step=1; },
  render(){
    const [x,y,z]=this.v, s=this.step, X=x*x, Y=y*y, Z=z*z, d2=X+Y, m2=d2+Z, m=Math.sqrt(m2), d=Math.sqrt(d2);
    document.querySelectorAll("#v3steps button").forEach(b=>b.classList.toggle("on",+b.dataset.s<=s));
    const p=v=>v<0?"("+v+")":v;
    const rows=[
      [1,`x² = ${p(x)}² = ${nf(X)}`],[1,`y² = ${p(y)}² = ${nf(Y)}`],[1,`z² = ${p(z)}² = ${nf(Z)}`],
      [2,`d² = x² + y² = ${nf(X)} + ${nf(Y)} = ${nf(d2)}`],[2,`   (바닥 대각선 d ≈ ${nf(d)})`],
      [2,`|a|² = d² + z² = ${nf(d2)} + ${nf(Z)} = ${nf(m2)}`],
      [3,`|a| = √${nf(m2)} ≈ ${(Math.round(m*10)/10).toLocaleString("ko-KR")} mg  ≈ ${(m/1000).toFixed(2)} g`]];
    $("v3calc").innerHTML=rows.map(([k,t])=>`<div class="${k<s?"on":k===s?"gold":""}">${k<=s?esc(t):" "}</div>`).join("");
    const pct=Math.min(100,m/4000*100);
    $("v3gauge").innerHTML=`<div class="fl" style="width:${pct}%;${m>S.T_ON?"background:linear-gradient(90deg,#e7c37a,#d98a7a)":""}"></div>`+
      `<div class="mk" style="left:25%"><span>1000 (중력)</span></div><div class="mk" style="left:${Math.min(100,S.T_ON/40)}%;background:#d98a7a"><span>T ${S.T_ON}</span></div>`;
    let ex;
    if(s===1) ex="<b>STEP 1 · 제곱하기</b> — 음수도 제곱하면 양수가 됩니다. 그래서 방향(부호)은 사라지고 <b>얼마나 센지</b>만 남습니다.";
    else if(s===2) ex="<b>STEP 2 · 더하기</b> — 바닥에서 피타고라스 한 번(x, y → 파란 d), 그 d와 높이 z로 한 번 더. 두 개의 직각삼각형이 겹쳐 있습니다.";
    else { ex=`<b>STEP 3 · 제곱근</b> — 크기 <b>${nf(m)}mg</b>. `;
      if(m<400) ex+="거의 0입니다. 센서가 무게를 느끼지 못하는 <b>자유낙하</b> 상태입니다.";
      else if(Math.abs(m-1000)<80) ex+="중력 1g와 거의 같습니다. <b>가만히 있는 상태</b>입니다. 세 축 값이 어떻게 나뉘어 있든 상관없습니다.";
      else if(m>S.T_ON) ex+=`임계값 ${S.T_ON}을 넘습니다. 교과서 코드라면 <b>SOS</b>를 띄웁니다. 그런데 이것이 정말 낙상일까요? ②에서 확인합니다.`;
      else ex+="중력보다 크거나 작습니다. 몸이 <b>가속하거나 감속하는 중</b>입니다(걷기·흔들기).";
    }
    $("v3ex").innerHTML=ex; this.draw();
  },
  draw(){
    const {g,w,h}=cv("v3c"), [x,y,z]=this.v, yaw=+$("v3yaw").value*D2R, el=22*D2R;
    const R=Math.max(1200,Math.abs(x),Math.abs(y),Math.abs(z))*1.15, sc=Math.min(w,h)/2/R*0.92, cx=w/2, cy=h/2+10, G=Math.ceil(R/500)*500;
    const P=(a,b,c)=>{ const X=a*Math.cos(yaw)-b*Math.sin(yaw), Yd=a*Math.sin(yaw)+b*Math.cos(yaw); return [cx+X*sc, cy-(c*Math.cos(el)+Yd*Math.sin(el))*sc]; };
    const line=(a,b,col,wd,dash)=>{ g.strokeStyle=col; g.lineWidth=wd; g.setLineDash(dash||[]); g.beginPath(); g.moveTo(a[0],a[1]); g.lineTo(b[0],b[1]); g.stroke(); g.setLineDash([]); };
    for(let k=-G;k<=G;k+=G/2){ line(P(k,-G,0),P(k,G,0),"rgba(255,255,255,.05)",1); line(P(-G,k,0),P(G,k,0),"rgba(255,255,255,.05)",1); }
    [["x",[R,0,0]],["y",[0,R,0]],["z",[0,0,R]]].forEach(([n,v])=>{ const a=P(-v[0],-v[1],-v[2]), b=P(v[0],v[1],v[2]); line(a,b,"rgba(255,255,255,.22)",1);
      g.fillStyle="#9a9caa"; g.font="bold 12px sans-serif"; g.fillText(n,b[0]+4,b[1]-2); });
    const s=this.step;
    if(s>=2){ line(P(x,0,0),P(x,y,0),"rgba(255,255,255,.25)",1,[3,3]); line(P(0,y,0),P(x,y,0),"rgba(255,255,255,.25)",1,[3,3]);
      line(P(0,0,0),P(x,y,0),COL.x,2.5,[6,4]); line(P(x,y,0),P(x,y,z),COL.y,2.5,[6,4]); }
    g.strokeStyle="rgba(231,195,122,.18)"; g.setLineDash([2,4]); g.beginPath(); g.arc(cx,cy,1000*sc,0,7); g.stroke(); g.setLineDash([]);
    const o=P(0,0,0), e=P(x,y,z); line(o,e,COL.m,3);
    const ang=Math.atan2(e[1]-o[1],e[0]-o[0]); if(Math.hypot(e[0]-o[0],e[1]-o[1])>6){ g.fillStyle=COL.m; g.beginPath(); g.moveTo(e[0],e[1]);
      g.lineTo(e[0]-11*Math.cos(ang-0.4),e[1]-11*Math.sin(ang-0.4)); g.lineTo(e[0]-11*Math.cos(ang+0.4),e[1]-11*Math.sin(ang+0.4)); g.fill(); }
    g.fillStyle=COL.txt; g.font="11px sans-serif"; g.fillText("점선 원 = 크기 1000mg(1g)",10,h-10);
    g.fillStyle=COL.m; g.font="bold 13px sans-serif"; g.fillText("|a| = "+nf(mag3(x,y,z))+" mg",10,20);
  },
  newQ(){ let q; do{ q=this.QS[Math.floor(Math.random()*this.QS.length)]; }while(this.q && q===this.q.b);
    const sg=()=>Math.random()<0.4?-1:1, v=q.map(a=>a*100*sg()).sort(()=>Math.random()-0.5);
    this.q={b:q,v,ans:Math.round(mag3(v[0],v[1],v[2]))}; $("qv").textContent="("+v.join(", ")+")"; $("qa").value=""; $("qmsg").textContent=""; },
  check(){ const a=+$("qa").value, q=this.q; const sq=q.v.map(t=>(t/100)**2);
    $("qmsg").innerHTML = a===q.ans ? `<span class="ok">정답!</span> 100으로 나누면 ${sq.join(" + ")} = ${sq.reduce((s,t)=>s+t,0)} = ${q.ans/100}², 다시 100을 곱해 ${nf(q.ans)}mg`
      : `<span class="ng">다시 해 보세요.</span> 먼저 각 값을 100으로 나누고 제곱해 더해 보세요.`; }
};

/* ---------------- ② 시나리오 신호 ---------------- */
const P2 = {
  sel:null,
  init(){ this.get=scnSel("s2sc","s2tr",7);
    ["s2sc","s2tr","s2rot","s2clip"].forEach(id=>$(id).addEventListener("change",()=>{ if(id==="s2sc"||id==="s2tr") this.sel=null; this.render(); }));
    ["s2ax","s2mg"].forEach(id=>$(id).addEventListener("click",e=>{ this.sel=pickIndex(id,e); this.render(); }));
    $("s2send").onclick=()=>{ const v=this.v; if(!v) return; const i=this.sel??this.peak; V1.set([v.x[i],v.y[i],v.z[i]]); V1.step=3; showPane("p1"); };
  },
  render(){
    const tr=this.get(), v=view(tr, $("s2clip").checked?"2g":"8g", $("s2rot").checked); this.v=v;
    const sc=SCN[tr.si]; $("s2desc").innerHTML=`<b style="color:var(--tx)">${sc.name}</b> — ${sc.d} ${sc.fall?'<span class="pill r">실제 낙상</span>':''}`;
    const peak=v.m.indexOf(Math.max(...v.m)); this.peak=peak; const i=this.sel??peak;
    const allAx=[...v.x,...v.y,...v.z], lo=Math.min(-1200,...allAx), hi=Math.max(1200,...allAx);
    lineChart("s2ax",{ymin:lo-100,ymax:hi+100,series:[{d:v.x,c:COL.x},{d:v.y,c:COL.y},{d:v.z,c:COL.z}],sel:i,yl:"mg",
      hl:$("s2clip").checked?[{v:2048,c:"rgba(217,138,122,.4)",dash:1,t:"+2048"},{v:-2048,c:"rgba(217,138,122,.4)",dash:1,t:"−2048"}]:[]});
    const shade=[...runs(v.m.map(a=>a<400)).map(([a,b])=>({i0:a,i1:b,c:"rgba(127,168,212,.22)"})),...runs(v.m.map(a=>a>2000)).map(([a,b])=>({i0:a,i1:b,c:"rgba(217,138,122,.25)"}))];
    lineChart("s2mg",{ymin:0,ymax:Math.max(2600,Math.max(...v.m)+200),series:[{d:v.m,c:COL.m,w:2}],hl:[{v:1000,c:"rgba(255,255,255,.35)",dash:1,t:"1000"}],shade,sel:i,yl:"|a| mg"});
    const x=v.x[i],y=v.y[i],z=v.z[i];
    $("s2read").innerHTML=[`t = ${(i/FS).toFixed(2)}초 (${i}번째 표본)${i===peak?"  ← 최댓값":""}`,`x = ${x},  y = ${y},  z = ${z}`,
      `|a| = √(${nf(x*x)} + ${nf(y*y)} + ${nf(z*z)})`,`    = √${nf(x*x+y*y+z*z)} ≈ ${nf(v.m[i])} mg`].map((t,k)=>`<div class="${k===3?"gold":"on"}">${esc(t)}</div>`).join("");
    const rng=a=>Math.max(...a)-Math.min(...a), ffn=v.m.filter(a=>a<400).length;
    $("s2met").innerHTML=[["x축 변동 폭",nf(rng(v.x))],["y축 변동 폭",nf(rng(v.y))],["z축 변동 폭",nf(rng(v.z))],["크기 최댓값",nf(Math.max(...v.m))],["자유낙하 표본",ffn+"개 · "+(ffn*DT/1000).toFixed(2)+"초"]]
      .map(([l,t])=>`<div><div class="l">${l}</div><div class="v" style="font-size:17px">${t}</div></div>`).join("");
    this.drawAll();
  },
  drawAll(){
    const {g,w,h}=cv("s2all"), cols=w<520?2:3, rowsN=Math.ceil(SCN.length/cols), cw=w/cols, ch=h/rowsN;
    const clip=$("s2clip").checked?"2g":"8g";
    SCN.forEach((sc,k)=>{ const v=view(DATA[k][0],clip,false), ox=(k%cols)*cw, oy=Math.floor(k/cols)*ch;
      const x0=ox+8,x1=ox+cw-8,y0=oy+20,y1=oy+ch-8, top=4500, sy=a=>y1-Math.min(a,top)/top*(y1-y0);
      g.lineWidth=1; g.strokeStyle="rgba(255,255,255,.08)"; g.strokeRect(x0,y0,x1-x0,y1-y0);
      g.strokeStyle="rgba(255,255,255,.25)"; g.setLineDash([3,3]); g.beginPath(); g.moveTo(x0,sy(1000)); g.lineTo(x1,sy(1000)); g.stroke(); g.setLineDash([]);
      g.strokeStyle="rgba(217,138,122,.5)"; g.beginPath(); g.moveTo(x0,sy(S.T_ON)); g.lineTo(x1,sy(S.T_ON)); g.stroke();
      g.strokeStyle=sc.fall?COL.z:COL.m; g.lineWidth=1.4; g.beginPath(); v.m.forEach((a,i)=>{ const px=x0+(x1-x0)*i/(LEN-1); i?g.lineTo(px,sy(a)):g.moveTo(px,sy(a)); }); g.stroke();
      g.fillStyle=sc.fall?COL.z:"#9a9caa"; g.font="11.5px Pretendard,'Malgun Gothic',sans-serif"; g.fillText(sc.name,x0,oy+14); });
  }
};

/* ---------------- ③ 이동평균 ---------------- */
function movAvg(a,k){ const buf=new Array(k).fill(1000), out=[]; for(const v of a){ buf.shift(); buf.push(v); out.push(buf.reduce((s,t)=>s+t,0)/k); } return out; }
function std(a){ const m=a.reduce((s,t)=>s+t,0)/a.length; return Math.sqrt(a.reduce((s,t)=>s+(t-m)**2,0)/a.length); }
const P3 = {
  init(){ this.get=scnSel("s3sc","s3tr",7);
    ["s3sc","s3tr"].forEach(id=>$(id).addEventListener("change",()=>this.render()));
    $("s3k").oninput=()=>{ S.K=+$("s3k").value; save(); this.render(); };
  },
  render(){
    $("s3k").value=S.K; $("s3kv").textContent=S.K; const k=S.K;
    const tr=this.get(), v=view(tr,S.range,false), f=movAvg(v.m,k);
    const pr=v.m.indexOf(Math.max(...v.m)), pf=f.indexOf(Math.max(...f));
    lineChart("s3c",{ymin:0,ymax:Math.max(2600,v.m[pr]+200),series:[{d:v.m,c:COL.dim,w:1.3},{d:f,c:COL.m,w:2.2}],
      hl:[{v:S.T_ON,c:COL.z,t:"T "+S.T_ON},{v:1000,c:"rgba(255,255,255,.3)",dash:1}],vm:[{i:pr,c:"#9a9caa"},{i:pf,c:COL.m}],yl:"|a| mg"});
    const st=view(DATA[0][0],S.range,false).m.slice(20), sr=std(st), sf=std(movAvg(st,k).slice(k));
    const lost=(1-f[pf]/v.m[pr])*100;
    $("s3met").innerHTML=[
      ["원신호 최댓값",nf(v.m[pr])+" mg",(pr/FS).toFixed(2)+"초"],
      ["이동평균 최댓값",nf(f[pf])+" mg",(pf/FS).toFixed(2)+"초 · "+(lost>0.5?"−"+lost.toFixed(0)+"%":"그대로")],
      ["반응 지연 (이론)",((k-1)/2*DT).toFixed(0)+" ms","(k−1)/2 = "+((k-1)/2)+"표본 × 50ms"],
      ["서 있기 잡음 σ",sr.toFixed(1)+" → "+sf.toFixed(1),"이론 σ/√k = "+(sr/Math.sqrt(k)).toFixed(1)],
      ["임계값 판정",(f[pf]>S.T_ON?"넘음":"못 넘음"),"원신호는 "+(v.m[pr]>S.T_ON?"넘음":"못 넘음")+" · T = "+S.T_ON]
    ].map(([l,t,s])=>`<div><div class="l">${l}</div><div class="v" style="font-size:16px">${t}</div><div class="s">${s}</div></div>`).join("");
    let rows="<tr><th>표본</th><th>시각</th><th>|a|</th></tr>", sum=0;
    for(let j=pf-k+1;j<=pf;j++){ const val=j>=0?v.m[j]:1000; sum+=val; rows+=`<tr${j===pr?' class="hl"':''}><td>${j>=0?j+"번":"(초깃값)"}</td><td>${j>=0?(j/FS).toFixed(2)+"초":"—"}</td><td>${nf(val)}</td></tr>`; }
    rows+=`<tr class="hl"><td><b>평균</b></td><td>${nf(sum)} ÷ ${k}</td><td><b>${nf(sum/k)}</b></td></tr>`;
    $("s3win").innerHTML=rows;
    const sc=SCN[tr.si];
    let ex=`창 크기 <b>k = ${k}</b>: 최근 ${k}개 값(${(k*DT/1000).toFixed(2)}초 분량)의 평균입니다. `;
    if(k===1) ex+="k = 1은 필터가 없는 것과 같습니다(교과서 코드). k를 올려 보세요.";
    else { ex+=`충격 최댓값이 ${nf(v.m[pr])} → ${nf(f[pf])}로 <b>${lost.toFixed(0)}% 낮아지고</b>, 정점이 ${((pf-pr)*DT).toFixed(0)}ms 늦게 나타납니다. `;
      if(sc.fall && v.m[pr]>S.T_ON && f[pf]<=S.T_ON) ex+=`<b style="color:var(--rose)">원신호는 임계값을 넘었는데 이동평균은 못 넘습니다 — 필터가 낙상을 지웠습니다.</b>`;
      else if(!sc.fall && v.m[pr]>S.T_ON && f[pf]<=S.T_ON) ex+=`<b style="color:var(--green)">원신호로는 거짓 경보였던 것을 이동평균이 걸러 냈습니다.</b> 같은 k가 낙상에는 어떤지 [낙상] 시나리오로 바꿔 보세요.`;
      else ex+="잡음은 줄었습니다. 대신 무엇을 잃었는지 표의 숫자로 확인하세요."; }
    $("s3ex").innerHTML=ex;
  }
};

/* ---------------- ④ 임계값 판정기 ---------------- */
const P4 = {
  PRE:{tb:{...DEF},low:{...DEF,T_ON:1000},high:{...DEF,T_ON:4000},ff:{...DEF,ff:true},all:{...DEF,T_ON:1600,posture:true,hys:true,T_OFF:1200,range:"8g"}},
  init(){ this.get=scnSel("t4sc","t4tr",7);
    const bind=(id,key,num)=>{ const el=$(id); el.addEventListener(el.type==="checkbox"?"change":"input",()=>{ S[key]= el.type==="checkbox"?el.checked:(num?+el.value:el.value);
      if(S.T_OFF>S.T_ON) S.T_OFF=S.T_ON; save(); this.schedule(); }); };
    bind("t4on","T_ON",1); bind("t4m","M",1); bind("t4k","K",1); bind("t4hys","hys"); bind("t4off","T_OFF",1); bind("t4ff","ff"); bind("t4ffv","FF",1); bind("t4post","posture");
    $("t4range").addEventListener("change",()=>{ S.range=$("t4range").value; save(); this.schedule(); });
    document.querySelectorAll("#p4 [data-pre]").forEach(b=>b.onclick=()=>{ Object.assign(S,this.PRE[b.dataset.pre]); save(); this.render(); });
    ["t4sc","t4tr"].forEach(id=>$(id).addEventListener("change",()=>this.one()));
  },
  schedule(){ if(this._t) return; this._t=requestAnimationFrame(()=>{ this._t=0; this.render(); }); },
  sync(){ $("t4on").value=S.T_ON; $("t4onv").textContent=S.T_ON; $("t4m").value=S.M; $("t4mv").textContent=S.M; $("t4k").value=S.K; $("t4kv").textContent=S.K;
    $("t4hys").checked=S.hys; $("t4off").value=S.T_OFF; $("t4off").disabled=!S.hys; $("t4offv").textContent=S.hys?Math.min(S.T_OFF,S.T_ON):"(= T)";
    $("t4ff").checked=S.ff; $("t4ffv").value=S.FF; $("t4ffv").disabled=!S.ff; $("t4ffvv").textContent=S.FF; $("t4post").checked=S.posture; $("t4range").value=S.range; },
  render(){
    this.sync(); const e=evaluate(S); this.e=e;
    const rec=e.TP/e.nF, far=e.FP/e.nN;
    $("t4met").innerHTML=[["낙상 감지율",(rec*100).toFixed(0)+"%",e.TP+" / "+e.nF+" 시행"],["놓친 낙상",e.FN+"건","가장 위험한 실수"],
      ["거짓 경보",(far*100).toFixed(0)+"%",e.FP+" / "+e.nN+" 시행"],["경보 총 횟수",e.alarms+"번","같은 사건에 여러 번 울린 것 포함"]]
      .map(([l,t,s],k)=>`<div><div class="l">${l}</div><div class="v" style="color:${k===1&&e.FN?"var(--rose)":k===0?"var(--green)":"var(--tx)"}">${t}</div><div class="s">${s}</div></div>`).join("");
    $("t4tab").innerHTML="<tr><th>동작</th><th>시행</th><th>경보 울린 시행</th><th>경보 횟수</th></tr>"+e.rows.map(r=>
      `<tr class="${r.sc.fall?"fall":""}"><td>${r.sc.name}</td><td>${r.n}</td><td>${r.hit}<span class="mbar" style="width:${r.hit/r.n*50}px;background:${r.sc.fall?"var(--green)":"var(--rose)"}"></span></td><td>${r.total}</td></tr>`).join("");
    $("t4cm").innerHTML=`<div></div><div class="h">SOS 울림</div><div class="h">조용함</div>
      <div class="h">실제 낙상</div><div class="c good">${e.TP}<small>제대로 감지</small></div><div class="c bad">${e.FN}<small>놓침</small></div>
      <div class="h">낙상 아님</div><div class="c bad">${e.FP}<small>거짓 경보</small></div><div class="c good">${e.TN}<small>제대로 조용</small></div>`;
    const worst=e.rows.filter(r=>!r.sc.fall&&r.hit).sort((a,b)=>b.hit-a.hit).map(r=>r.sc.name);
    let ex=`지금 규칙은 낙상 ${e.nF}건 중 <b>${e.TP}건</b>을 잡고 <b>${e.FN}건</b>을 놓쳤습니다. 낙상이 아닌 ${e.nN}건 중 <b>${e.FP}건</b>에서 SOS가 울렸습니다`;
    ex+= worst.length? ` (많은 순: ${worst.slice(0,3).join(", ")}).` : ".";
    if(e.alarms>e.TP+e.FP) ex+=` 경보 총 횟수(${e.alarms})가 울린 시행 수(${e.TP+e.FP})보다 많습니다 — 한 사건에 여러 번 울린 것입니다.`;
    if(e.FP && e.rows.find(r=>r.sc.k==="drop").hit===e.FP) ex+=" 남은 거짓 경보는 모두 <b>기기 떨어뜨리기</b>입니다. 센서 입장에서는 기기가 떨어진 것과 사람이 넘어진 것이 거의 같아 보입니다.";
    $("t4ex").innerHTML=ex;
    this.trade(); this.one();
  },
  trade(){
    const key=JSON.stringify({...S,T_ON:0});
    if(this._tk!==key){ this._tk=key; this._tc=[]; for(let T=800;T<=5000;T+=100){ const e=evaluate({...S,T_ON:T,T_OFF:Math.min(S.T_OFF,T)}); this._tc.push([T,e.TP/e.nF,e.FP/e.nN]); } }
    const {g,w,h}=cv("t4trade"), x0=46,x1=w-10,y0=10,y1=h-26, sx=T=>x0+(T-800)/4200*(x1-x0), sy=p=>y1-p*(y1-y0);
    g.fillStyle=COL.txt; g.lineWidth=1;
    for(let k=0;k<=4;k++){ const p=k/4; g.strokeStyle=COL.grid; g.beginPath(); g.moveTo(x0,sy(p)); g.lineTo(x1,sy(p)); g.stroke(); g.textAlign="right"; g.fillText((k*25)+"%",x0-5,sy(p)+4); }
    g.textAlign="center"; const ts=w<480?1000:500;
    for(let T=1000;T<=5000;T+=ts){ g.strokeStyle=COL.grid; g.beginPath(); g.moveTo(sx(T),y0); g.lineTo(sx(T),y1); g.stroke(); g.fillText(T,sx(T),y1+15); }
    [[1,COL.y],[2,COL.z]].forEach(([k,col])=>{ g.strokeStyle=col; g.lineWidth=2.2; g.beginPath(); this._tc.forEach((r,i)=>{ i?g.lineTo(sx(r[0]),sy(r[k])):g.moveTo(sx(r[0]),sy(r[k])); }); g.stroke(); });
    g.strokeStyle=COL.m; g.lineWidth=1.5; g.beginPath(); g.moveTo(sx(S.T_ON),y0); g.lineTo(sx(S.T_ON),y1); g.stroke();
    g.lineWidth=1; g.strokeStyle="rgba(255,255,255,.16)"; g.strokeRect(x0,y0,x1-x0,y1-y0);
  },
  one(){
    const tr=this.get(), v=view(tr,S.range,false), o=detect(v,S), sc=SCN[tr.si];
    const shade=S.ff? runs(o.ffOn).map(([a,b])=>({i0:a,i1:b,c:"rgba(127,168,212,.2)"})) : [];
    const hl=[{v:S.T_ON,c:COL.z,t:"T "+S.T_ON},{v:1000,c:"rgba(255,255,255,.25)",dash:1}];
    if(S.hys) hl.push({v:Math.min(S.T_OFF,S.T_ON),c:COL.vio,dash:1,t:"Toff "+Math.min(S.T_OFF,S.T_ON)});
    const ym=Math.max(2600,Math.max(...v.m)+250);
    const pts=[...o.impacts.map(i=>({i,v:o.avg[i],c:COL.m,sym:"tri"})),...o.alarms.map(i=>({i,v:ym*0.94,c:COL.z})),...o.rejects.map(r=>({i:r.i,v:ym*0.94,c:"#9a9caa",sym:"x"}))];
    lineChart("t4c",{ymin:0,ymax:ym,series:[{d:v.m,c:COL.dim,w:1.2},{d:o.avg,c:COL.m,w:2}],hl,shade,pts,yl:"mg"});
    const ok = sc.fall ? o.alarms.length>0 : o.alarms.length===0;
    let t=`${sc.fall?"실제 낙상":"낙상 아님"} → SOS <b>${o.alarms.length}번</b> · `+(ok?'<span class="ok">맞게 판정</span>':`<span class="ng">${sc.fall?"놓침":"거짓 경보"}</span>`);
    if(o.rejects.length) t+=` · 자세 확인에서 기각 ${o.rejects.length}번 (`+o.rejects.map(r=>(r.okStill?"":"가만히 있지 않음, ")+"각도 "+(Math.acos(Math.max(-1,Math.min(1,r.c)))/D2R).toFixed(0)+"°").join(" / ")+")";
    $("t4one").innerHTML=t;
  }
};

/* ---------------- ⑤ 기록 계산기 ---------------- */
const P5 = {
  init(){ ["r5int","r5day","r5hr","r5var","r5cap","r5zero"].forEach(id=>$(id).addEventListener("input",()=>this.render()));
    $("r5zero").addEventListener("change",()=>this.render());
    document.querySelectorAll("#p5 [data-r]").forEach(b=>b.onclick=()=>{ const [a,d,h,v]=b.dataset.r.split(","); $("r5int").value=a; $("r5day").value=d; $("r5hr").value=h; $("r5var").value=v; this.render(); }); },
  render(){
    const it=Math.max(0.01,+$("r5int").value||5), d=Math.max(0,+$("r5day").value||0), hr=Math.max(0,+$("r5hr").value||0), nv=Math.max(1,Math.round(+$("r5var").value||1)), cap=Math.max(2,Math.round(+$("r5cap").value||13000)), zero=$("r5zero").checked;
    const sec=d*86400+hr*3600, n=Math.floor(sec/it+1e-9)+(zero?1:0), vals=n*nv, bytes=n*(8+nv*6);
    const tlist=[]; if(d) tlist.push(`${d}일 × 24 × 3600`); if(hr) tlist.push(`${hr}시간 × 3600`);
    const fullT=(zero?cap-1:cap)*it, minInt=sec/(zero?cap-1:cap);
    const ft = s => s>=86400? (s/86400).toFixed(1)+"일" : s>=3600? (s/3600).toFixed(1)+"시간" : s>=60? (s/60).toFixed(1)+"분" : s.toFixed(1)+"초";
    $("r5calc").innerHTML=[
      ["on",`기간(초) = ${tlist.join(" + ")||"0"} = ${nf(sec)}초`],
      ["on",`기록 횟수 = ${nf(sec)} ÷ ${it}${zero?" + 1":""} = ${nf(n)}번`],
      ["on",`저장할 값 = ${nf(n)} × 변수 ${nv}개 = ${nf(vals)}개`],
      ["on",`용량 어림 ≈ ${nf(n)}행 × (시각 8자 + ${nv}×6자) ≈ ${(bytes/1024).toLocaleString("ko-KR",{maximumFractionDigits:1})} KB`],
      ["gold",`저장 가능 ${nf(cap)}행 대비 ${(n/cap*100).toLocaleString("ko-KR",{maximumFractionDigits:1})}%`]
    ].map(([c,t])=>`<div class="${c}">${esc(t)}</div>`).join("");
    const pct=Math.min(100,n/cap*100);
    $("r5gauge").innerHTML=`<div class="fl" style="width:${pct}%;${n>cap?"background:linear-gradient(90deg,#d98a7a,#e8b0a3)":""}"></div><div class="mk" style="left:100%;margin-left:-2px"><span>저장 한계</span></div>`;
    let ex = n<=cap ? `<b>${nf(n)}행</b> — 저장 공간 안에 들어갑니다. ` : `<b style="color:var(--rose)">${nf(n)}행 — 저장 공간을 ${(n/cap).toFixed(1)}배 넘습니다.</b> 약 ${ft(fullT)} 뒤 기록이 멈춥니다. `;
    if(sec>0) ex += `이 기간을 저장 공간 안에 담으려면 간격을 <b>${Math.ceil(minInt*100)/100}초 이상</b>으로 잡아야 합니다(${nf(sec)} ÷ ${nf(zero?cap-1:cap)}).`;
    if(it<=0.1) ex+=` <br>20Hz처럼 빠른 신호는 <b>모두 저장할 수 없습니다.</b> 그래서 낙상 감지기는 판정을 기기 안에서 바로 하고, <b>SOS가 난 순간 앞뒤만</b> 저장하는 방식으로 설계합니다.`;
    $("r5ex").innerHTML=ex;
  }
};

/* ---------------- ⑥ 코드 · 퀴즈 ---------------- */
const P6 = {
  Q:[
    {q:"세 축 값이 (300, −400, 1200) mg일 때 크기 |a|는?",o:["1100 mg","1300 mg","1700 mg","1900 mg"],a:1,
     w:"<b>√(300² + 400² + 1200²) = √(90,000 + 160,000 + 1,440,000) = √1,690,000 = 1300</b>. 음수도 제곱하면 양수입니다. 100으로 나누면 (3, 4, 12) → √169 = 13."},
    {q:"5초마다 7일 동안 기록하면(첫 기록은 5초에) 기록 횟수는?",o:["10,080번","604,800번","120,960번","1,209,600번"],a:2,
     w:"<b>7 × 24 × 3600 = 604,800초, ÷ 5 = 120,960번</b>. 0초에도 기록한다면 등차수열의 항 수로 120,961번이 됩니다."},
    {q:"이동평균의 창 크기 k를 3에서 11로 키웠을 때 일어나는 일로 옳은 것은?",o:["잡음은 줄지만 짧은 충격의 정점이 낮아지고 반응이 늦어진다","잡음도 줄고 충격 정점도 더 뚜렷해진다","잡음이 커진다","반응이 더 빨라진다"],a:0,
     w:"평균을 내면 잡음이 약 <b>1/√k</b>로 줄지만, 50ms짜리 충격도 k개 중 하나로 희석되어 <b>정점이 낮아지고</b>, 최근 값만 보는 평균은 <b>(k−1)/2 표본</b>만큼 늦습니다."},
    {q:"충격 임계값 T를 2000에서 3000으로 올리면?",o:["거짓 경보와 놓침이 모두 줄어든다","거짓 경보는 늘고 놓친 낙상은 줄어든다","아무것도 변하지 않는다","거짓 경보는 줄고 놓친 낙상은 늘어난다"],a:3,
     w:"임계값 하나로는 두 실수가 <b>서로 맞바뀝니다</b>. 둘을 함께 줄이려면 기준값이 아니라 <b>판정 규칙</b>(자유낙하, 충격 뒤 자세 등)을 바꿔야 합니다. ④의 그래프에서 두 곡선을 확인하세요."},
    {q:"제자리 점프와 실제 낙상을 구별하는 데 가장 도움이 되는 조건은?",o:["자유낙하 구간이 있는가","충격 크기가 2000을 넘는가","충격 1~2초 뒤 가만히 있고 자세가 크게 바뀌었는가","측정 간격을 5초로 늘리기"],a:2,
     w:"점프도 공중에 뜨는 순간(자유낙하)과 착지 충격이 있습니다. 다른 점은 <b>그 뒤</b>입니다. 넘어진 사람은 누운 채 움직이지 않고, 중력 벡터의 방향이 크게 바뀝니다 — 두 벡터의 <b>내적</b>으로 각을 잽니다."}
  ],
  init(){
    $("c6copy").onclick=e=>{ const b=e.target; if(navigator.clipboard) navigator.clipboard.writeText(this.src).then(()=>{ b.textContent="복사됨"; setTimeout(()=>b.textContent="복사",1200); }).catch(()=>{}); };
    this.build();
  },
  build(){
    const box=$("quiz"); this.ans=[];
    box.innerHTML='<div class="qh">5문항 · 고르면 바로 채점</div>'+this.Q.map((q,i)=>`<div class="qitem" data-i="${i}"><div class="q"><span class="qn">Q${i+1}</span>${q.q}</div><div class="opts">`+
      q.o.map((t,j)=>`<button class="opt" data-j="${j}"><span class="mk">${"ABCD"[j]}</span><span>${t}</span></button>`).join("")+`</div><div class="why">${q.w}</div></div>`).join("")+'<div class="qscore" id="qscore"></div>';
    box.querySelectorAll(".qitem").forEach(it=>{ const i=+it.dataset.i; it.querySelectorAll(".opt").forEach(b=>b.onclick=()=>{ if(this.ans[i]!=null) return;
      const j=+b.dataset.j; this.ans[i]=j; it.querySelectorAll(".opt").forEach((x,k)=>{ if(k===this.Q[i].a) x.classList.add("right"); else if(k===j) x.classList.add("wrong"); });
      it.querySelector(".why").classList.add("show"); this.score(); }); });
    this.score();
  },
  score(){ const done=this.ans.filter(a=>a!=null).length, ok=this.ans.filter((a,i)=>a===this.Q[i].a).length;
    $("qscore").innerHTML=done? `점수 <b>${ok} / ${this.Q.length}</b>${done<this.Q.length?` · ${this.Q.length-done}문항 남음`:" · 다 풀었습니다."} <button class="tbtn ghost" id="qreset" style="margin-left:8px">다시 풀기</button>`:"문항을 고르면 바로 채점합니다.";
    const r=$("qreset"); if(r) r.onclick=()=>this.build(); },
  render(){
    this.src=genCode(S);
    $("c6code").innerHTML=esc(this.src).replace(/(#[^\n]*)/g,'<span class="c">$1</span>');
    const e=evaluate(S);
    $("c6set").innerHTML=`충격 임계값 <b>T = ${S.T_ON}</b> · 연속 <b>M = ${S.M}</b> · 이동평균 <b>k = ${S.K}</b><br>`+
      `히스테리시스 <b>${S.hys?"켬 (T<sub>off</sub> = "+Math.min(S.T_OFF,S.T_ON)+")":"끔"}</b> · 자유낙하 <b>${S.ff?"켬 (|a| < "+S.FF+")":"끔"}</b> · 자세 확인 <b>${S.posture?"켬":"끔"}</b> · 범위 <b>±${S.range}</b><br>`+
      `④ 시뮬레이터 성적: 감지 <b>${e.TP}/${e.nF}</b> · 거짓 경보 <b>${e.FP}/${e.nN}</b><br><a href="#" id="c6go" style="color:var(--accent)">← ④에서 설정 바꾸기</a>`;
    $("c6go").onclick=ev=>{ ev.preventDefault(); showPane("p4"); };
  }
};

/* ---------------- 탭 ---------------- */
function showPane(id){
  document.querySelectorAll("#tabs .tab").forEach(t=>t.classList.toggle("active",t.dataset.p===id));
  document.querySelectorAll("section.pane").forEach(s=>s.classList.toggle("on",s.id===id));
  try{ localStorage.setItem("aifp2026_lab05_pane",id); }catch(e){}
  const bar=document.querySelector(".bar"); if(window.scrollY>bar.offsetTop) window.scrollTo({top:bar.offsetTop,behavior:"smooth"});
  refresh(id);
}
function refresh(id){ ({p1:()=>V1.render(),p2:()=>P2.render(),p3:()=>P3.render(),p4:()=>P4.render(),p5:()=>P5.render(),p6:()=>P6.render()})[id](); }
(function boot(){
  V1.init(); P2.init(); P3.init(); P4.init(); P5.init(); P6.init();
  document.querySelectorAll("#tabs .tab").forEach(t=>t.onclick=()=>showPane(t.dataset.p));
  let pane="p1"; try{ pane=localStorage.getItem("aifp2026_lab05_pane")||"p1"; }catch(e){}
  if(!$(pane)) pane="p1";
  document.querySelectorAll("#tabs .tab").forEach(t=>t.classList.toggle("active",t.dataset.p===pane));
  document.querySelectorAll("section.pane").forEach(s=>s.classList.toggle("on",s.id===pane));
  refresh(pane);
  let rt; window.addEventListener("resize",()=>{ clearTimeout(rt); rt=setTimeout(()=>refresh(document.querySelector("section.pane.on").id),150); });
})();
}
