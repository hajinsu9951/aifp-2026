/* 4회차 실습실 · 산불 데이터로 보는 대푯값과 추세선 (이청록)
   자료: 통계청 KOSIS TX_13625_A003 「월별·원인별 산불 발생건수」 (산림청 산불방지과), 2006~2025.
   2026-09-21 내려받은 원자료에서 월(합계)·원인(계)을 제외하고, '-'는 0건으로 처리한 정리본입니다.
   2022년은 원자료에 '어린이불장난' 항목이 없어 0으로 둡니다. 20년 합계 9,240건(외부 지표와 일치). */
"use strict";

const CAUSES=["입산자실화","논밭두렁등소각","쓰레기소각","담뱃불실화","성묘객실화","건축물화재","어린이불장난","기타"];
const BY_CAUSE={2006:[185,63,40,26,12,5,14,60],2007:[193,92,21,37,23,2,7,43],2008:[148,62,44,49,26,9,6,45],2009:[222,94,67,34,36,15,6,96],2010:[138,38,34,13,15,14,1,29],2011:[110,66,39,12,11,11,3,25],2012:[87,18,13,8,7,7,3,54],2013:[91,77,41,22,9,5,4,47],2014:[198,98,68,26,9,9,2,82],2015:[193,99,86,22,19,13,5,186],2016:[107,79,80,14,18,13,1,79],2017:[254,94,110,24,22,36,2,150],2018:[158,67,58,12,26,41,1,133],2019:[179,69,89,22,20,58,2,214],2020:[217,49,65,75,9,54,1,150],2021:[133,22,27,34,16,20,3,94],2022:[253,44,59,53,14,51,0,282],2023:[170,56,73,56,23,41,1,176],2024:[49,24,28,36,6,14,1,121],2025:[71,32,57,35,17,40,1,206]};
const BY_MONTH={2006:[48,41,175,49,27,1,0,0,7,25,23,9],2007:[61,122,70,110,11,18,0,0,0,1,20,5],2008:[7,70,85,79,32,2,0,2,13,25,45,29],2009:[64,32,119,206,52,17,0,0,13,23,23,21],2010:[24,30,22,51,45,21,0,0,0,5,44,40],2011:[33,40,94,80,6,9,0,0,0,6,5,4],2012:[6,9,23,45,54,35,0,3,1,14,5,2],2013:[7,30,113,69,30,6,0,7,3,11,9,11],2014:[49,54,101,166,55,13,11,0,4,16,19,4],2015:[16,40,252,49,76,88,4,8,33,41,8,8],2016:[36,62,116,86,21,28,1,14,5,1,9,12],2017:[21,56,192,122,104,86,3,0,4,4,50,50],2018:[29,130,83,88,3,45,15,46,3,9,13,32],2019:[106,61,141,152,99,15,15,4,2,9,19,30],2020:[29,42,171,184,26,38,0,1,2,35,46,46],2021:[44,82,44,94,20,3,7,6,1,0,24,24],2022:[88,143,82,180,115,26,3,0,11,24,47,37],2023:[38,114,229,108,33,11,0,1,2,13,25,22],2024:[18,11,74,67,17,28,0,7,6,2,18,31],2025:[44,74,144,82,6,27,11,8,1,0,33,29]};

/* ---------- 계산 도구 ---------- */
const $=id=>document.getElementById(id);
const sum=a=>a.reduce((s,v)=>s+v,0);
const mean=a=>sum(a)/a.length;
const median=a=>{const s=[...a].sort((x,y)=>x-y),n=s.length;return n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2;};
const pvar=a=>{const m=mean(a);return sum(a.map(v=>(v-m)**2))/a.length;};
const psd=a=>Math.sqrt(pvar(a));
const ssd=a=>Math.sqrt(pvar(a)*a.length/(a.length-1));
function fit(xs,ys){const xb=mean(xs),yb=mean(ys);let sxy=0,sxx=0;xs.forEach((x,i)=>{sxy+=(x-xb)*(ys[i]-yb);sxx+=(x-xb)**2;});const a=sxy/sxx;return{xb,yb,sxy,sxx,a,b:yb-a*xb};}
const sse=(xs,ys,f)=>sum(xs.map((x,i)=>(ys[i]-f(x))**2));
const fmt=(v,d=1)=>{const r=Math.round(v*10**d)/10**d;return (Object.is(r,-0)?0:r).toLocaleString("ko-KR",{maximumFractionDigits:d});};
const sgn=(v,d=1)=>(v>0?"+":v<0?"−":"")+fmt(Math.abs(v),d);

const YEARS=Object.keys(BY_CAUSE).map(Number);
const TOTAL=YEARS.map(y=>sum(BY_CAUSE[y]));
const S=sum(TOTAL);
YEARS.forEach((y,i)=>{if(sum(BY_MONTH[y])!==TOTAL[i])console.warn("월별 합과 원인별 합이 다른 해:",y);});
const MONTH_TOTAL=Array.from({length:12},(_,m)=>sum(YEARS.map(y=>BY_MONTH[y][m])));
const CAUSE_TOTAL=CAUSES.map((_,k)=>sum(YEARS.map(y=>BY_CAUSE[y][k])));

/* ---------- 캔버스 도구 ---------- */
const COL={tx:"#f3f1ea",mut:"#9a9caa",dim:"#6d6f7d",gold:"#d8b45a",acc:"#e7c37a",green:"#8bc0a4",rose:"#d98a7a",blue:"#7fa8d4",violet:"#a99ad4",line:"rgba(255,255,255,.08)",line2:"rgba(255,255,255,.16)"};
const PAL=["#e7c37a","#8bc0a4","#7fa8d4","#d98a7a","#a99ad4","#c99a6a","#6fb3b8","#7d7f8c"];
const FONT='"Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif';
function canvas(id){
  const c=$(id); if(!c.dataset.h)c.dataset.h=c.getAttribute("height");
  const dpr=window.devicePixelRatio||1, W=c.clientWidth||600, H=+c.dataset.h;
  c.style.height=H+"px"; c.width=Math.round(W*dpr); c.height=Math.round(H*dpr);
  const g=c.getContext("2d"); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,W,H);
  g.font="11px "+FONT; g.textBaseline="middle"; return{c,g,W,H};
}
function niceMax(v){if(v<=0)return 1;const p=10**Math.floor(Math.log10(v)),r=v/p;return (r<=1?1:r<=2?2:r<=2.5?2.5:r<=5?5:10)*p;}
function yAxis(g,x0,x1,y0,y1,max,steps=4,suffix=""){
  g.strokeStyle=COL.line;g.fillStyle=COL.dim;g.textAlign="right";g.lineWidth=1;
  for(let i=0;i<=steps;i++){const v=max*i/steps,y=y0-(y0-y1)*i/steps;g.beginPath();g.moveTo(x0,y);g.lineTo(x1,y);g.stroke();g.fillText(fmt(v,max<10?1:0)+suffix,x0-5,y);}
}
function hline(g,x0,x1,y,color,dash){g.save();g.strokeStyle=color;g.lineWidth=1.5;g.setLineDash(dash||[6,4]);g.beginPath();g.moveTo(x0,y);g.lineTo(x1,y);g.stroke();g.restore();}
function tri(g,x,y,up,color){g.fillStyle=color;g.beginPath();if(up){g.moveTo(x,y);g.lineTo(x-7,y+11);g.lineTo(x+7,y+11);}else{g.moveTo(x,y);g.lineTo(x-7,y-11);g.lineTo(x+7,y-11);}g.closePath();g.fill();}
function metric(list){return list.map(m=>`<div class="${m.c||""}"><div class="l">${m.l}</div><div class="v">${m.v}</div>${m.d?`<div class="d">${m.d}</div>`:""}</div>`).join("");}

/* ---------- 머리 숫자 ---------- */
(function(){
  const f=fit(YEARS,TOTAL);
  $("hstats").innerHTML=[[YEARS.length,"연도 (2006~2025)"],[fmt(S,0),"20년 총 발생 건수"],[fmt(mean(TOTAL)),"연평균 건수"],[sgn(f.a,1),"추세선 기울기 (건/년)"]]
    .map(([b,s])=>`<div><b>${b}</b><span>${s}</span></div>`).join("");
})();

/* =========================================================
   ① 합계 행 함정
   ========================================================= */
const T1={
  on:false,
  init(){$("t1tot").onchange=e=>{this.on=e.target.checked;$("t1lab").classList.toggle("on",this.on);this.render();};},
  render(){
    const labels=YEARS.map(String), vals=[...TOTAL];
    if(this.on){labels.push("합계");vals.push(S);}
    const base={n:TOTAL.length,s:S,m:mean(TOTAL),md:median(TOTAL),sd:psd(TOTAL),mx:Math.max(...TOTAL)};
    const now={n:vals.length,s:sum(vals),m:mean(vals),md:median(vals),sd:psd(vals),mx:Math.max(...vals)};
    const r=(k,d=1)=>this.on?{d:`원래 ${fmt(base[k],d)} → ×${fmt(now[k]/base[k],2)}`,c:now[k]!==base[k]?"bad":""}:{d:"",c:""};
    const mxLab=labels[vals.indexOf(now.mx)];
    $("t1m").innerHTML=metric([
      {l:"자료 개수 n",v:now.n,...r("n",0)},
      {l:"합 Σy",v:fmt(now.s,0),...r("s",0)},
      {l:"평균",v:fmt(now.m),...r("m")},
      {l:"중앙값",v:fmt(now.md),...r("md")},
      {l:"표준편차",v:fmt(now.sd),...r("sd")},
      {l:"가장 많은 해",v:mxLab,d:fmt(now.mx,0)+"건",c:this.on?"bad":""}]);
    let th="<thead><tr><th>연도</th><th>건수</th><th>평균과의 차</th></tr></thead><tbody>";
    vals.forEach((v,i)=>{th+=`<tr class="${labels[i]==="합계"?"tot":""}"><td>${labels[i]}</td><td>${fmt(v,0)}</td><td>${sgn(v-now.m)}</td></tr>`;});
    $("t1tab").innerHTML=th+"</tbody>";
    $("t1ex").innerHTML=this.on
      ?`합계 행이 <b>스물한 번째 해</b>로 끼어들었습니다. 합은 <b>${fmt(base.s,0)} → ${fmt(now.s,0)}</b>으로 정확히 2배, 평균은 <b>${fmt(base.m)} → ${fmt(now.m)}</b>입니다.
        &lsquo;산불이 가장 많았던 해&rsquo;는 <b>&lsquo;합계&rsquo;</b>라는 존재하지 않는 해가 되었고, 실제 20개 연도는 모두 평균보다 아래에 깔렸습니다.
        파이썬이나 생성형 AI는 이 결과를 <b>오류 없이</b> 출력합니다. 틀린 것은 계산이 아니라 데이터입니다.`
      :`지금은 20개 연도만 있습니다. 평균 <b>${fmt(base.m)}건</b>, 중앙값 <b>${fmt(base.md)}건</b>, 가장 많은 해는 <b>${labels[TOTAL.indexOf(base.mx)]}년(${fmt(base.mx,0)}건)</b>입니다.
        위의 토글을 켜서 합계 행을 넣어 보세요.`;
    // 그래프
    const {g,W,H}=canvas("t1c"), L=48,R=W-10,T=14,B=H-30, mx=niceMax(now.mx*1.05);
    yAxis(g,L,R,B,T,mx);
    const bw=(R-L)/vals.length;
    vals.forEach((v,i)=>{const x=L+i*bw,h=(B-T)*v/mx;g.fillStyle=labels[i]==="합계"?COL.rose:"rgba(231,195,122,.55)";g.fillRect(x+bw*.15,B-h,bw*.7,h);});
    g.fillStyle=COL.dim;g.textAlign="center";
    vals.forEach((_,i)=>{if(vals.length<=12||i%(W<500?5:2)===0||labels[i]==="합계"){g.fillText(labels[i]==="합계"?"합계":"’"+labels[i].slice(2),L+(i+.5)*bw,B+12);}});
    const yM=B-(B-T)*now.m/mx, yMd=B-(B-T)*now.md/mx;
    hline(g,L,R,yM,COL.acc);hline(g,L,R,yMd,COL.green,[2,3]);
    g.textAlign="left";g.fillStyle=COL.acc;g.fillText("평균 "+fmt(now.m),L+4,yM-8);
    g.fillStyle=COL.green;g.fillText("중앙값 "+fmt(now.md),L+4,yMd+9);
    // 식
    $("t1f").textContent=
`합계 행 제외   Σy = S = ${fmt(S,0)}            평균 = S / 20 = ${fmt(S/20)}
합계 행 포함   Σy = S + S = 2S = ${fmt(2*S,0)}     평균 = 2S / 21 = ${fmt(2*S/21)}
               (2S/21) ÷ (S/20) = 40/21 ≈ ${fmt(40/21,2)}배`;
    $("t1x4").textContent=fmt(4*S,0);
  }
};

/* =========================================================
   ② 대푯값과 이상값
   ========================================================= */
const T2={
  ys:YEARS.slice(-5), base:TOTAL.slice(-5), v:TOTAL[YEARS.indexOf(2022)],
  init(){
    const s=$("t2s"); s.oninput=()=>{this.v=+s.value;this.render();};
    $("t2typo").onclick=()=>{this.v=7560;s.value=7560;this.render();};
    $("t2reset").onclick=()=>{this.v=this.base[1];s.value=this.v;this.render();};
  },
  render(){
    const vals=this.base.map((b,i)=>this.ys[i]===2022?this.v:b);
    const m0=mean(this.base),md0=median(this.base),m=mean(vals),md=median(vals);
    $("t2v").textContent=fmt(this.v,0);
    $("t2m").innerHTML=metric([
      {l:"평균",v:fmt(m),d:`원래 ${fmt(m0)} (${sgn(m-m0)})`,c:Math.abs(m-m0)>1?"bad":""},
      {l:"중앙값",v:fmt(md),d:`원래 ${fmt(md0)} (${sgn(md-md0)})`,c:md===md0?"good":"bad"},
      {l:"평균 − 중앙값",v:sgn(m-md)}]);
    const others=this.base.filter((_,i)=>this.ys[i]!==2022).sort((a,b)=>a-b);
    $("t2ex").innerHTML=`2022년 값이 <b>1</b> 늘면 합이 1 늘고, 평균은 <b>1/5 = 0.2</b>씩 따라 움직입니다. 그래서 평균은 이상값 쪽으로 <b>끌려갑니다</b>.
      중앙값은 순서만 봅니다. 다른 네 해(${others.join(", ")})를 고정하면, 2022년 값이 <b>${others[2]} 이상</b>이기만 하면 어디에 있든 중앙값은 <b>${others[2]}</b>로 그대로입니다.
      ${this.v===7560?"<br><b>오타 7560</b> 하나로 평균은 "+fmt(m0)+" → "+fmt(m)+"이 되었지만 중앙값은 그대로입니다.":""}
      <br>전체 20년도 평균 <b>${fmt(mean(TOTAL))}</b> &gt; 중앙값 <b>${fmt(median(TOTAL))}</b>입니다. 2017·2022년처럼 큰 해가 평균을 위로 당긴 결과입니다.`;
    const sorted=[...vals].sort((a,b)=>a-b);
    $("t2calc").textContent=
`자료   ${this.ys.map((y,i)=>y+"년 "+fmt(vals[i],0)).join(" · ")}
정렬   ${sorted.map(v=>fmt(v,0)).join(" ≤ ")}
합     ${vals.map(v=>fmt(v,0)).join(" + ")} = ${fmt(sum(vals),0)}
평균   ${fmt(sum(vals),0)} ÷ 5 = ${fmt(m)}
중앙값 정렬했을 때 (5+1)/2 = 3번째 값 = ${fmt(md,1)}`;
    // 점 그래프
    const {g,W,H}=canvas("t2c"), L=24,R=W-24,Y=H/2+6, mx=niceMax(Math.max(1000,...vals)*1.05);
    const X=v=>L+(R-L)*v/mx;
    g.strokeStyle=COL.line2;g.beginPath();g.moveTo(L,Y);g.lineTo(R,Y);g.stroke();
    g.fillStyle=COL.dim;g.textAlign="center";
    for(let i=0;i<=5;i++){const v=mx*i/5;g.fillText(fmt(v,0),X(v),Y+72);g.beginPath();g.moveTo(X(v),Y-3);g.lineTo(X(v),Y+3);g.stroke();}
    vals.forEach((v,i)=>{const x=X(v),up=i%2===0;g.fillStyle=this.ys[i]===2022?COL.rose:COL.tx;g.beginPath();g.arc(x,Y,6,0,7);g.fill();
      g.fillStyle=COL.mut;g.fillText("’"+String(this.ys[i]).slice(2),x,Y+(up?-18:18));});
    tri(g,X(m),Y+26,true,COL.acc);g.fillStyle=COL.acc;g.fillText("평균 "+fmt(m),X(m),Y+47);
    tri(g,X(md),Y-26,false,COL.green);g.fillStyle=COL.green;g.fillText("중앙값 "+fmt(md),X(md),Y-45);
  },
  renderMode(){
    const peak=YEARS.map(y=>{const a=BY_MONTH[y];return a.indexOf(Math.max(...a))+1;});
    const cnt=Array(12).fill(0);peak.forEach(p=>cnt[p-1]++);
    const top=cnt.indexOf(Math.max(...cnt))+1, second=[...cnt].map((c,i)=>[c,i+1]).sort((a,b)=>b[0]-a[0])[1];
    const {g,W,H}=canvas("t2m2"), L=30,R=W-8,T=14,B=H-24, mx=Math.max(...cnt)+1, bw=(R-L)/12;
    yAxis(g,L,R,B,T,mx%2?mx+1:mx,mx%2?(mx+1)/2:mx/2);
    const mxA=mx%2?mx+1:mx;
    cnt.forEach((c,i)=>{const h=(B-T)*c/mxA;g.fillStyle=i+1===top?COL.acc:"rgba(127,168,212,.5)";g.fillRect(L+i*bw+bw*.18,B-h,bw*.64,h);
      g.fillStyle=COL.dim;g.textAlign="center";g.fillText((i+1)+"월",L+(i+.5)*bw,B+12);if(c){g.fillStyle=COL.tx;g.fillText(c,L+(i+.5)*bw,B-h-8);}});
    const spring=(MONTH_TOTAL[2]+MONTH_TOTAL[3])/S*100;
    $("t2mex").innerHTML=`20개 연도마다 &lsquo;그해 가장 많았던 달&rsquo;을 하나씩 뽑았습니다. 가장 자주 나온 값, 즉 <b>최빈값은 ${top}월(${cnt[top-1]}회)</b>, 다음은 ${second[1]}월(${second[0]}회)입니다.
      <br>20년 누계로도 3월 <b>${fmt(MONTH_TOTAL[2],0)}건</b>, 4월 <b>${fmt(MONTH_TOTAL[3],0)}건</b>으로 두 달이 전체의 <b>${fmt(spring)}%</b>입니다. &ldquo;산불은 봄에 나는가&rdquo;에 숫자로 답할 수 있습니다.
      <br><span class="mini2">최빈값은 범주형 자료(달, 원인, 혈액형 등)의 대푯값으로 가장 쓸모가 있습니다.</span>`;
  }
};

/* =========================================================
   ③ 표준편차 단계별
   ========================================================= */
const T3={
  s:0, timer:null,
  data(){const n=+$("t3d").value;return{ys:YEARS.slice(-n),v:TOTAL.slice(-n)};},
  init(){
    document.querySelectorAll("#t3steps button").forEach(b=>b.onclick=()=>{this.stop();this.s=+b.dataset.s;this.render();});
    $("t3d").onchange=()=>{this.stop();this.s=0;this.render();};
    $("t3auto").onclick=()=>{this.stop();this.s=0;this.render();this.timer=setInterval(()=>{this.s++;this.render();if(this.s>=5)this.stop();},1500);};
    const a=TOTAL;$("t3nn").textContent=`n으로 나누면 ${fmt(psd(a))}, n−1로 나누면 ${fmt(ssd(a))}입니다`;
  },
  stop(){if(this.timer){clearInterval(this.timer);this.timer=null;}},
  render(){
    const {ys,v}=this.data(), n=v.length, m=mean(v), dev=v.map(x=>x-m), sq=dev.map(d=>d*d), ss=sum(sq), va=ss/n, sd=Math.sqrt(va), s=this.s;
    document.querySelectorAll("#t3steps button").forEach(b=>{const k=+b.dataset.s;b.classList.toggle("on",k===s);b.classList.toggle("done",k<s);});
    const hc=k=>k===s?"hc":"";
    let t=`<thead><tr><th>연도</th><th>y</th>${s>=2?"<th>y − ȳ</th>":""}${s>=3?"<th>(y − ȳ)²</th>":""}</tr></thead><tbody>`;
    v.forEach((x,i)=>{t+=`<tr><td>${ys[i]}</td><td class="${hc(1)}">${fmt(x,0)}</td>${s>=2?`<td class="${hc(2)}">${sgn(dev[i])}</td>`:""}${s>=3?`<td class="${hc(3)}">${fmt(sq[i],2)}</td>`:""}</tr>`;});
    t+=`<tr class="sum"><td>합</td><td class="${hc(1)}">${s>=1?fmt(sum(v),0):"?"}</td>${s>=2?`<td class="${hc(2)}">${fmt(sum(dev),2)}</td>`:""}${s>=3?`<td class="${hc(4)}">${s>=4?fmt(ss,2):"?"}</td>`:""}</tr></tbody>`;
    $("t3tab").innerHTML=t;
    const ex=[
      `STEP 1부터 차례로 누르세요. 자료는 <b>${ys[0]}~${ys[n-1]}년 ${n}개</b>입니다.`,
      `<b>평균</b> <span class="f">ȳ = Σy / n = ${fmt(sum(v),0)} / ${n} = ${fmt(m,2)}</span><br>그래프의 금색 점선이 평균입니다.`,
      `<b>편차</b> = 각 값 − 평균. 평균보다 많은 해는 +, 적은 해는 −입니다.<br>편차를 모두 더하면 <span class="f">Σ(y − ȳ) = ${fmt(sum(dev),2)}</span> — <b>항상 0</b>이라 편차의 평균으로는 흩어짐을 잴 수 없습니다.`,
      `<b>제곱</b>해서 부호를 없앱니다. 그래프의 반투명 사각형 넓이가 편차의 제곱입니다.<br>큰 편차일수록 사각형이 훨씬 커집니다. 가장 큰 칸은 <b>${ys[sq.indexOf(Math.max(...sq))]}년(${fmt(Math.max(...sq),2)})</b>입니다.`,
      `<b>분산</b> = 편차 제곱의 평균<br><span class="f">V = Σ(y − ȳ)² / n = ${fmt(ss,2)} / ${n} = ${fmt(va,2)}</span><br>단위가 &lsquo;건²&rsquo;이어서 원래 자료와 비교하기 어렵습니다.`,
      `<b>표준편차</b> = 분산의 양의 제곱근<br><span class="f">σ = √${fmt(va,2)} ≈ ${fmt(sd,2)}건</span><br>단위가 다시 &lsquo;건&rsquo;이 되었습니다. 그래프의 금색 띠가 <b>평균 ± 표준편차</b>(${fmt(m-sd)} ~ ${fmt(m+sd)})입니다.`];
    $("t3ex").innerHTML=ex[s];
    // 그래프
    const {g,W,H}=canvas("t3c"), L=46,R=W-10,T=12,B=H-26, mx=niceMax(Math.max(...v)*1.1), ky=(B-T)/mx, Y=val=>B-val*ky, bw=(R-L)/n;
    if(s>=5){g.fillStyle="rgba(216,180,90,.10)";g.fillRect(L,Y(m+sd),R-L,2*sd*ky);}
    yAxis(g,L,R,B,T,mx);
    if(s>=3){dev.forEach((d,i)=>{const side=Math.abs(d)*ky,cx=L+(i+.5)*bw;g.fillStyle=d>=0?"rgba(217,138,122,.13)":"rgba(139,192,164,.13)";g.strokeStyle=d>=0?"rgba(217,138,122,.45)":"rgba(139,192,164,.45)";
      const top=d>=0?Y(v[i]):Y(m);g.fillRect(cx,top,side,side);g.strokeRect(cx,top,side,side);});}
    if(s>=1)hline(g,L,R,Y(m),COL.acc);
    v.forEach((x,i)=>{const cx=L+(i+.5)*bw;
      if(s>=2){g.strokeStyle=dev[i]>=0?COL.rose:COL.green;g.lineWidth=2;g.beginPath();g.moveTo(cx,Y(m));g.lineTo(cx,Y(x));g.stroke();g.lineWidth=1;}
      g.fillStyle=COL.tx;g.beginPath();g.arc(cx,Y(x),4,0,7);g.fill();
      if(n<=12||i%(W<500?5:3)===0){g.fillStyle=COL.dim;g.textAlign="center";g.fillText("’"+String(ys[i]).slice(2),cx,B+12);}});
    if(s>=1){g.fillStyle=COL.acc;g.textAlign="left";g.fillText("ȳ = "+fmt(m,1),L+4,Y(m)-8);}
  }
};

/* =========================================================
   ④ 최소제곱 추세선
   ========================================================= */
const T4={
  show:false, sq:false, ua:0, ub:0, drag:-1, geo:null,
  range(){const r=$("t4r").value;const [a,b]=r==="last5"?[2021,2025]:r==="mid"?[2012,2022]:[2006,2025];
    const idx=YEARS.map((y,i)=>i).filter(i=>YEARS[i]>=a&&YEARS[i]<=b);return{xs:idx.map(i=>YEARS[i]),ys:idx.map(i=>TOTAL[i])};},
  flat(){const {ys}=this.range();this.ua=this.ub=mean(ys);},
  init(){
    this.flat();
    $("t4r").onchange=()=>{this.show=false;$("t4ans").textContent="정답 직선 보기";this.flat();this.render();};
    $("t4ans").onclick=()=>{this.show=!this.show;$("t4ans").textContent=this.show?"정답 직선 숨기기":"정답 직선 보기";this.render();};
    $("t4flat").onclick=()=>{this.flat();this.render();};
    $("t4sq").onchange=e=>{this.sq=e.target.checked;this.render();};
    const c=$("t4c");
    const pos=e=>{const r=c.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
    c.addEventListener("pointerdown",e=>{if(!this.geo)return;const p=pos(e),G=this.geo;
      const d0=Math.hypot(p.x-G.X(G.x0),p.y-G.Y(this.ua)),d1=Math.hypot(p.x-G.X(G.x1),p.y-G.Y(this.ub));
      const near=Math.min(d0,d1);
      if(near<34){this.drag=d0<=d1?0:1;}else{this.drag=Math.abs(p.x-G.X(G.x0))<Math.abs(p.x-G.X(G.x1))?0:1;}
      c.setPointerCapture(e.pointerId);this.move(p);e.preventDefault();});
    c.addEventListener("pointermove",e=>{if(this.drag<0)return;this.move(pos(e));});
    const up=()=>{this.drag=-1;};c.addEventListener("pointerup",up);c.addEventListener("pointercancel",up);
    const all=fit(YEARS,TOTAL);
    $("t4r2").textContent=fmt(1-sse(YEARS,TOTAL,x=>all.a*x+all.b)/sse(YEARS,TOTAL,()=>mean(TOTAL)),2);
    const sl=(a,b)=>{const idx=YEARS.map((_,i)=>i).filter(i=>YEARS[i]>=a&&YEARS[i]<=b);return fit(idx.map(i=>YEARS[i]),idx.map(i=>TOTAL[i])).a;};
    $("t4trap").textContent=`전체 20년의 기울기는 ${sgn(sl(2006,2025))}건/년, 2012~2022년은 ${sgn(sl(2012,2022))}건/년인데, 최근 5년만 보면 ${sgn(sl(2021,2025))}건/년입니다.`;
  },
  move(p){const G=this.geo;let v=G.inv(p.y);v=Math.max(-200,Math.min(G.mx,v));if(this.drag===0)this.ua=v;else this.ub=v;this.render();},
  render(){
    const {xs,ys}=this.range(), f=fit(xs,ys), x0=xs[0], x1=xs[xs.length-1];
    const ua=this.ua,ub=this.ub, ka=(ub-ua)/(x1-x0), user=x=>ua+ka*(x-x0), best=x=>f.a*x+f.b;
    const eU=sse(xs,ys,user), eB=sse(xs,ys,best), eM=sse(xs,ys,()=>f.yb);
    const {g,W,H}=canvas("t4c"), L=48,R=W-16,T=14,B=H-28, mx=niceMax(Math.max(...ys)*1.15);
    const pad=(R-L)/(xs.length+1)*.6, X=x=>L+pad+(R-L-2*pad)*(x-x0)/(x1-x0), Y=v=>B-(B-T)*v/mx;
    this.geo={X,Y,x0,x1,mx,inv:py=>(B-py)/(B-T)*mx};
    yAxis(g,L,R,B,T,mx);
    g.save();g.beginPath();g.rect(L,T-4,R-L,B-T+8);g.clip();
    // 잔차
    xs.forEach((x,i)=>{const yu=user(x),px=X(x);
      if(this.sq){const side=Math.abs(ys[i]-yu)*(B-T)/mx;g.fillStyle="rgba(217,138,122,.10)";g.strokeStyle="rgba(217,138,122,.35)";const top=Math.min(Y(ys[i]),Y(yu));g.fillRect(px,top,side,side);g.strokeRect(px,top,side,side);}
      g.strokeStyle=COL.rose;g.lineWidth=1.6;g.beginPath();g.moveTo(px,Y(ys[i]));g.lineTo(px,Y(yu));g.stroke();g.lineWidth=1;});
    if(this.show){g.strokeStyle=COL.green;g.lineWidth=2;g.beginPath();g.moveTo(X(x0-1),Y(best(x0-1)));g.lineTo(X(x1+1),Y(best(x1+1)));g.stroke();g.lineWidth=1;}
    g.strokeStyle=COL.acc;g.lineWidth=2.2;g.beginPath();g.moveTo(X(x0),Y(ua));g.lineTo(X(x1),Y(ub));g.stroke();g.lineWidth=1;
    g.restore();
    xs.forEach((x,i)=>{g.fillStyle=COL.tx;g.beginPath();g.arc(X(x),Y(ys[i]),4,0,7);g.fill();
      if(xs.length<=11||i%(W<500?5:3)===0){g.fillStyle=COL.dim;g.textAlign="center";g.fillText("’"+String(x).slice(2),X(x),B+13);}});
    [[x0,ua],[x1,ub]].forEach(([x,v],k)=>{g.fillStyle=this.drag===k?"#fff":COL.acc;g.strokeStyle="#0a0b10";g.lineWidth=2;g.beginPath();g.arc(X(x),Y(v),9,0,7);g.fill();g.stroke();g.lineWidth=1;});
    // 수치
    const ratio=eU/eB;
    $("t4m").innerHTML=metric([
      {l:"내 직선 기울기",v:sgn(ka,1),d:"건/년"},
      {l:"내 잔차 제곱합",v:fmt(eU,0),c:ratio<1.01?"good":""},
      {l:"정답 기울기 a",v:this.show?sgn(f.a,2):"?",d:this.show?`b = ${fmt(f.b,1)}`:"정답 보기로 확인"},
      {l:"최소 잔차 제곱합",v:this.show?fmt(eB,0):"?",d:this.show?`내 직선은 이 값의 ${fmt(ratio,3)}배`:""}]);
    // 막대
    const bc=canvas("t4bar"), bg=bc.g, BW=bc.W, bl=8, br=BW-8, scale=Math.max(eU,eM)*1.05;
    const bar=(y,val,col,lab)=>{bg.fillStyle=col;bg.fillRect(bl,y,(br-bl)*val/scale,16);bg.fillStyle=COL.mut;bg.textAlign="left";bg.fillText(lab,bl+4,y+28);};
    bar(6,eU,"rgba(217,138,122,.75)","");bg.fillStyle=COL.tx;bg.textAlign="left";bg.fillText("내 직선 "+fmt(eU,0),bl+4,14);
    bg.fillStyle="rgba(255,255,255,.12)";bg.fillRect(bl,44,(br-bl)*eM/scale,16);bg.fillStyle=COL.mut;bg.fillText("평균선(기울기 0) "+fmt(eM,0),bl+4,52);
    if(this.show){const x=bl+(br-bl)*eB/scale;bg.strokeStyle=COL.green;bg.lineWidth=2;bg.beginPath();bg.moveTo(x,2);bg.lineTo(x,64);bg.stroke();bg.fillStyle=COL.green;bg.textAlign=x>BW*.6?"right":"left";bg.fillText("최소 "+fmt(eB,0),x+(x>BW*.6?-4:4),76);}
    $("t4ex").innerHTML=ratio<1.0005
      ?`<b>정답과 같은 직선</b>입니다! 이보다 잔차 제곱합을 더 줄이는 직선은 없습니다. 그래서 &lsquo;최소&rsquo;제곱법이라 부릅니다.`
      :ratio<1.05?`거의 다 왔습니다. 정답보다 <b>${fmt((ratio-1)*100,1)}%</b> 큽니다. 손잡이를 조금씩 움직여 보세요.`
      :`손잡이를 끌어 빨간 잔차들이 위아래로 고르게 나뉘게 해 보세요. 지금 잔차 제곱합은 최소값의 <b>${this.show?fmt(ratio,2)+"배":"몇 배"}</b>입니다.
        <br>힌트: 최소제곱 직선은 항상 <b>(x̄, ȳ) = (${fmt(f.xb,1)}, ${fmt(f.yb,1)})</b>을 지납니다.`;
    // 계산표
    let t=`<thead><tr><th>x(연도)</th><th>y</th><th>x − x̄</th><th>y − ȳ</th><th>(x−x̄)(y−ȳ)</th><th>(x−x̄)²</th><th>잔차 y − ŷ</th></tr></thead><tbody>`;
    xs.forEach((x,i)=>{const dx=x-f.xb,dy=ys[i]-f.yb;t+=`<tr><td>${x}</td><td>${ys[i]}</td><td>${sgn(dx,1)}</td><td>${sgn(dy,1)}</td><td>${sgn(dx*dy,2)}</td><td>${fmt(dx*dx,2)}</td><td>${this.show?sgn(ys[i]-best(x),1):"?"}</td></tr>`;});
    t+=`<tr class="sum"><td>합/평균</td><td>ȳ=${fmt(f.yb,1)}</td><td>x̄=${fmt(f.xb,1)}</td><td>0</td><td>${sgn(f.sxy,2)}</td><td>${fmt(f.sxx,2)}</td><td>${this.show?"Σ²="+fmt(eB,0):"?"}</td></tr>`;
    t+=`<tr class="sum"><td colspan="7" style="text-align:left;font-family:var(--sans)">a = ${sgn(f.sxy,2)} ÷ ${fmt(f.sxx,2)} = <b>${this.show?sgn(f.a,3):"? (정답 보기)"}</b> · b = ȳ − a·x̄ ${this.show?"= "+fmt(f.b,1):""}</td></tr></tbody>`;
    $("t4tab").innerHTML=t;
  }
};

/* =========================================================
   ⑤ 원인별 구성비
   ========================================================= */
const T5={
  on:false,
  init(){
    const sel=$("t5y");sel.innerHTML=`<option value="all">전체 (2006~2025 누계)</option>`+YEARS.map(y=>`<option value="${y}">${y}년</option>`).reverse().join("");
    sel.onchange=()=>this.render();
    $("t5tot").onchange=e=>{this.on=e.target.checked;$("t5lab").classList.toggle("on",this.on);this.render();};
  },
  render(){
    const y=$("t5y").value, vals=y==="all"?CAUSE_TOTAL:BY_CAUSE[y], tot=sum(vals);
    let items=CAUSES.map((c,i)=>({c,v:vals[i],col:PAL[i]}));
    if(this.on)items.push({c:"계",v:tot,col:"#5b5d68"});
    const all=sum(items.map(o=>o.v)); items.sort((a,b)=>b.v-a.v);
    // 도넛
    const {g,W,H}=canvas("t5c"), cx=W/2, cy=H/2, r=Math.min(W,H)/2-34, r0=r*.52;
    let a0=-Math.PI/2;
    items.forEach(o=>{const a1=a0+2*Math.PI*o.v/all;g.fillStyle=o.col;g.beginPath();g.moveTo(cx,cy);g.arc(cx,cy,r,a0,a1);g.closePath();g.fill();
      g.strokeStyle="#0a0b10";g.lineWidth=2;g.stroke();
      const p=o.v/all*100;if(p>=4){const am=(a0+a1)/2;g.fillStyle=COL.tx;g.textAlign="center";g.font="bold 11px "+FONT;g.fillText(fmt(p)+"%",cx+Math.cos(am)*(r+18),cy+Math.sin(am)*(r+16));g.font="11px "+FONT;}
      a0=a1;});
    g.fillStyle="#0a0b10";g.beginPath();g.arc(cx,cy,r0,0,7);g.fill();
    g.fillStyle=COL.tx;g.textAlign="center";g.font="bold 15px "+FONT;g.fillText(fmt(all,0)+"건",cx,cy-6);g.font="11px "+FONT;g.fillStyle=COL.dim;g.fillText(y==="all"?"20년 누계":y+"년",cx,cy+12);
    $("t5leg").innerHTML=items.map(o=>`<span><i style="background:${o.col}"></i>${o.c}</span>`).join("");
    let t=`<thead><tr><th>순위</th><th>원인</th><th>건수</th><th>구성비</th><th>각도</th></tr></thead><tbody>`;
    items.forEach((o,i)=>{t+=`<tr class="${o.c==="계"?"tot":""}"><td>${i+1}</td><td style="font-family:var(--sans)">${o.c}</td><td>${fmt(o.v,0)}</td><td>${(o.v/all*100).toFixed(1)}%</td><td>${(o.v/all*360).toFixed(1)}°</td></tr>`;});
    t+=`<tr class="sum"><td></td><td style="font-family:var(--sans)">합</td><td>${fmt(all,0)}</td><td>100%</td><td>360°</td></tr></tbody>`;
    $("t5tab").innerHTML=t;
    const real=items.filter(o=>o.c!=="계"), rk=real.findIndex(o=>o.c==="기타")+1, et=real.find(o=>o.c==="기타");
    $("t5ex").innerHTML=this.on
      ?`&lsquo;계&rsquo;가 <b>1위(50%)</b>가 되었습니다. 진짜 1위인 ${real[0].c}의 비율은 ${fmt(real[0].v/tot*100)}% → <b>${fmt(real[0].v/all*100)}%</b>로 정확히 절반이 됩니다. 분모가 2배가 되었기 때문입니다.`
      :`1위는 <b>${real[0].c}</b>(${fmt(real[0].v/tot*100)}%)${rk===1?"입니다. <b>잔여 범주인 &lsquo;기타&rsquo;가 1위</b>입니다.":`, &lsquo;기타&rsquo;는 <b>${rk}위</b>(${fmt(et.v/tot*100)}%)입니다.`}
        구성비 계산 예: <span class="f">${real[0].v} ÷ ${fmt(tot,0)} × 100 = ${fmt(real[0].v/tot*100,2)}%</span>, 각도는 × 3.6 = ${fmt(real[0].v/tot*360,1)}°.
        ${rk<=2?"<br><b>&lsquo;기타&rsquo;가 상위권</b>이라는 것은 원인을 분류하지 못한 산불이 그만큼 많다는 뜻입니다.":""}`;
    // 기타 비중 선
    const share=YEARS.map(yy=>BY_CAUSE[yy][7]/sum(BY_CAUSE[yy])*100);
    const lc=canvas("t5line"), lg=lc.g, L=40,R=lc.W-12,T=12,B=lc.H-24, mx=50, X=i=>L+(R-L)*i/(YEARS.length-1), Yv=v=>B-(B-T)*v/mx;
    yAxis(lg,L,R,B,T,mx,5,"%");
    lg.strokeStyle=COL.acc;lg.lineWidth=2;lg.beginPath();share.forEach((v,i)=>i?lg.lineTo(X(i),Yv(v)):lg.moveTo(X(i),Yv(v)));lg.stroke();lg.lineWidth=1;
    share.forEach((v,i)=>{const sel=String(YEARS[i])===y;lg.fillStyle=sel?COL.rose:COL.acc;lg.beginPath();lg.arc(X(i),Yv(v),sel?6:3,0,7);lg.fill();
      if(sel||i===0||i===YEARS.length-1){lg.fillStyle=COL.tx;lg.textAlign="center";lg.fillText(fmt(v)+"%",X(i),Yv(v)-12);}
      if(i%(lc.W<500?5:2)===0||i===YEARS.length-1){lg.fillStyle=COL.dim;lg.textAlign="center";lg.fillText("’"+String(YEARS[i]).slice(2),X(i),B+12);}});
  }
};

/* =========================================================
   ⑥ 확인 문제
   ========================================================= */
const Q={
  build(){
    const f5=fit([1,2,3,4,5],TOTAL.slice(-5)), last5=TOTAL.slice(-5);
    const rankC=CAUSES.map((c,i)=>[c,CAUSE_TOTAL[i]]).sort((a,b)=>b[1]-a[1]);
    const items=[
      {q:`20개 연도(합 ${fmt(S,0)}건) 표에 「합계」 행(${fmt(S,0)})이 남은 채로 평균을 구하면?`,
       o:[fmt(S/20),fmt(2*S/21),fmt(2*S/20),fmt(2*S,0)],a:1,
       w:`합계 행이 한 해처럼 더해져 합은 2S = ${fmt(2*S,0)}, 개수는 21개입니다. 2S/21 = <b>${fmt(2*S/21)}</b>. 원래 평균 ${fmt(S/20)}의 약 1.9배입니다.`},
      {q:`2021~2025년 건수(${last5.join(", ")})에서 2022년 값 ${last5[1]}을 7560으로 잘못 입력했다. 바르게 말한 것은?`,
       o:[`평균과 중앙값이 모두 그대로다`,`평균은 커지고 중앙값은 ${median(last5)} 그대로다`,`평균은 그대로이고 중앙값만 커진다`,`평균과 중앙값이 모두 같은 만큼 커진다`],a:1,
       w:`평균은 ${fmt(mean(last5))} → ${fmt(mean(last5.map((v,i)=>i===1?7560:v)))}로 끌려가지만, 정렬했을 때 가운데 값은 여전히 ${median(last5)}입니다. 중앙값은 <b>이상값에 강건</b>합니다.`},
      {q:`편차 (y − ȳ)를 모두 더하면 항상 얼마인가?`,
       o:[`0`,`평균 ȳ`,`자료의 개수 n`,`표준편차`],a:0,
       w:`Σ(y − ȳ) = Σy − nȳ = nȳ − nȳ = <b>0</b>. 그래서 흩어짐을 재려면 제곱(분산)이나 절댓값을 씁니다.`},
      {q:`2021~2025년을 x = 1, 2, 3, 4, 5로 두었더니 Σ(x−x̄)(y−ȳ) = ${sgn(f5.sxy,0)}, Σ(x−x̄)² = ${fmt(f5.sxx,0)}이었다. 최소제곱 추세선의 기울기는?`,
       o:[sgn(f5.a,1),sgn(-f5.a,1),sgn(f5.a/10,2),sgn(fit(YEARS,TOTAL).a,2)],a:0,
       w:`a = (${sgn(f5.sxy,0)}) ÷ ${fmt(f5.sxx,0)} = <b>${sgn(f5.a,1)}</b>건/년. 전체 20년의 기울기(${sgn(fit(YEARS,TOTAL).a,2)})와 <b>부호가 반대</b>입니다. 기간 선택이 결론을 바꿉니다.`},
      {q:`20년 누계에서 산불 원인 2위는 무엇이고, 어떻게 해석해야 하는가?`,
       o:[`논밭두렁등소각 — 소각 단속이 가장 시급하다`,`${rankC[1][0]} — 분류되지 않은 산불이 많아 원인별 해석에 주의해야 한다`,`쓰레기소각 — 산불의 4분의 1이 쓰레기 때문이다`,`입산자실화 — 1위와 2위가 같다`],a:1,
       w:`1위 ${rankC[0][0]} ${fmt(rankC[0][1]/S*100)}%, 2위 <b>${rankC[1][0]} ${fmt(rankC[1][1]/S*100)}%</b>입니다. 잔여 범주가 2위라는 것은 분류 체계를 먼저 점검해야 한다는 신호입니다.`}];
    const box=$("quiz");let score=0,done=0;
    items.forEach((it,qi)=>{
      const d=document.createElement("div");d.className="qitem";
      d.innerHTML=`<div class="q"><span class="qn">${qi+1}.</span>${it.q}</div><div class="opts">${it.o.map((o,i)=>`<button class="opt" data-i="${i}"><span class="mk">${"①②③④"[i]}</span><span>${o}</span></button>`).join("")}</div><div class="why"><b>${"①②③④"[it.a]} 정답</b> · ${it.w}</div>`;
      d.querySelectorAll(".opt").forEach(b=>b.onclick=()=>{
        if(d.dataset.done)return;d.dataset.done=1;done++;const i=+b.dataset.i;
        d.querySelectorAll(".opt").forEach(x=>{const k=+x.dataset.i;if(k===it.a)x.classList.add("right");else if(k===i)x.classList.add("wrong");});
        if(i===it.a)score++;d.querySelector(".why").classList.add("show");
        $("qsc").innerHTML=`점수 <b>${score} / ${items.length}</b>${done===items.length?" · 모두 풀었습니다. 틀린 문항은 해당 탭으로 돌아가 다시 조작해 보세요.":""}`;});
      box.appendChild(d);});
    const sc=document.createElement("div");sc.className="qscore";sc.id="qsc";sc.innerHTML=`점수 <b>0 / ${items.length}</b>`;box.appendChild(sc);
  }
};

/* ---------- 탭 ---------- */
const RENDER={p1:()=>T1.render(),p2:()=>{T2.render();T2.renderMode();},p3:()=>T3.render(),p4:()=>T4.render(),p5:()=>T5.render(),p6:()=>{}};
let current="p1";
function showPane(id){
  if(!RENDER[id])id="p1"; current=id;
  document.querySelectorAll("section.pane").forEach(p=>p.classList.toggle("on",p.id===id));
  document.querySelectorAll("#tabs .tab").forEach(t=>t.classList.toggle("active",t.dataset.p===id));
  if(location.hash!=="#"+id)history.replaceState(null,"","#"+id);
  T3.stop(); RENDER[id]();
}
T1.init();T2.init();T3.init();T4.init();T5.init();Q.build();
document.querySelectorAll("#tabs .tab").forEach(t=>t.onclick=()=>{showPane(t.dataset.p);window.scrollTo({top:document.querySelector(".bar").offsetTop,behavior:"smooth"});});
let rz;window.addEventListener("resize",()=>{clearTimeout(rz);rz=setTimeout(()=>RENDER[current](),120);});
showPane((location.hash||"#p1").slice(1));
