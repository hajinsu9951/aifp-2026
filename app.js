/* 2026-2 온라인 공동교육과정 · 인공지능 융합프로젝트 — 공통 수업 엔진
   각 lessonNN.html 은 LESSON 객체만 정의하고 이 파일을 불러오면 된다. */

/* ---------- 유틸 ---------- */
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function toast(msg){let t=document.getElementById("toast");if(!t){t=document.createElement("div");t.id="toast";document.body.appendChild(t);}
  t.textContent=msg;t.classList.add("show");clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove("show"),1900);}
function copyText(txt,btn,done){navigator.clipboard.writeText(txt).then(()=>{if(btn){const o=btn.textContent;btn.textContent=done||"복사됨";setTimeout(()=>btn.textContent=o,1500);}toast("클립보드에 복사되었습니다");})
  .catch(()=>toast("복사에 실패했습니다. 직접 선택해 주세요"));}

/* ---------- 파이썬 코드 하이라이트(간이) ---------- */
/* 한 번만 훑으면서 토큰을 나눈다. 이미 만들어 낸 태그를 다시 치환하지 않도록
   원본 조각만 이스케이프하고 결과 문자열에는 다시 손대지 않는다. */
const PY_KW=new Set(["import","from","def","return","if","elif","else","while","for","in",
  "and","or","not","True","False","None","print","input","float","int","str","round","range",
  "class","try","except","as","with","lambda","global","break","continue","pass"]);
function hi(src){
  const re=/(#[^\n]*)|('[^'\n]*'|"[^"\n]*")|([A-Za-z_]\w*)|(\d+\.?\d*)/g;
  let out="",last=0,m;
  while((m=re.exec(src))!==null){
    out+=esc(src.slice(last,m.index));
    if(m[1])out+='<span class="c">'+esc(m[1])+'</span>';
    else if(m[2])out+='<span class="s">'+esc(m[2])+'</span>';
    else if(m[3])out+=PY_KW.has(m[3])?'<span class="k">'+esc(m[3])+'</span>':esc(m[3]);
    else out+='<span class="n">'+esc(m[4])+'</span>';
    last=re.lastIndex;
  }
  return out+esc(src.slice(last));
}
function codeBlock(c){
  const id="cd"+Math.random().toString(36).slice(2,8);
  return `<div class="code"><div class="ch"><span>${esc(c.name||"code")}</span>
    <button onclick="copyText(document.getElementById('${id}').textContent,this,'복사됨')">복사</button></div>
    <pre id="${id}">${c.lang==="none"?esc(c.src):hi(c.src)}</pre></div>`;
}

/* ---------- 저장소 ---------- */
const STORE={
  key(sub){return `aifp2026_L${LESSON.n}_${sub}`;},
  get(sub,def){try{return JSON.parse(localStorage.getItem(this.key(sub))||"null")??def;}catch(e){return def;}},
  set(sub,v){localStorage.setItem(this.key(sub),JSON.stringify(v));}
};

/* ---------- 블록 렌더러 ---------- */
function renderSection(sec,i){
  let h=`<div class="sec">`;
  if(sec.h)h+=`<h3>${sec.n?`<span class="n">${sec.n}</span>`:""}${sec.h}</h3>`;
  if(sec.lead)h+=`<div class="lead">${sec.lead}</div>`;
  if(sec.html)h+=sec.html;
  if(sec.code)(Array.isArray(sec.code)?sec.code:[sec.code]).forEach(c=>h+=codeBlock(c));
  if(sec.pages)h+=`<div class="lbl">교과서 지면 · 눌러서 확대</div>`+renderPages(sec.pages);
  if(sec.after)h+=sec.after;
  h+=`</div>`;
  return h;
}
function renderQuiz(q,bi){
  if(!q||!q.length)return"";
  let h=`<div class="quiz" data-qb="${bi}"><div class="qh">개념 확인 · ${q.length}문항</div>`;
  q.forEach((it,i)=>{
    h+=`<div class="qitem" data-q="${i}"><div class="q"><span class="qn">Q${i+1}.</span>${it.q}</div><div class="opts">`;
    it.opts.forEach((o,j)=>{h+=`<button class="opt" data-o="${j}" onclick="pick(${bi},${i},${j})"><span class="mk">${"①②③④⑤"[j]||j+1}</span><span>${o}</span></button>`;});
    h+=`</div><div class="why"><b>해설</b> · ${it.why}</div></div>`;
  });
  h+=`<div class="qscore" id="qs${bi}">아직 풀지 않았습니다.</div></div>`;
  return h;
}
function renderWorksheet(w,bi){
  if(!w)return"";
  const C=(typeof CONFIG!=="undefined")?CONFIG:{};
  let h=`<div class="ws" id="ws${bi}"><div class="wh"><div class="t">${w.title}</div><div class="s">입력하면 자동 저장됩니다</div></div>`;
  if(w.desc)h+=`<div class="lead" style="color:var(--mut);font-size:13px;line-height:1.85">${w.desc}</div>`;
  /* 이름 · 학교 — 제출 파일 이름에 쓰입니다 */
  h+=`<div class="whorow">
    <div class="wf" style="flex:1 1 150px"><label>학교</label><input type="text" id="wsSchool" placeholder="예 · 대전대신고"></div>
    <div class="wf" style="flex:1 1 150px"><label>이름</label><input type="text" id="wsName" placeholder="예 · 홍길동"></div>
  </div>`;
  w.fields.forEach((f,i)=>{
    h+=`<div class="wf"><label>${f.label}${f.req?'<span class="req">*</span>':""}</label>`;
    if(f.hint)h+=`<div class="hint">${f.hint}</div>`;
    if(f.type==="text")h+=`<input type="text" data-w="${bi}" data-f="${i}" placeholder="${esc(f.ph||"")}">`;
    else h+=`<textarea rows="${f.rows||4}" data-w="${bi}" data-f="${i}" placeholder="${esc(f.ph||"")}"></textarea>`;
    h+=`<div class="cnt" id="c${bi}_${i}">0자</div></div>`;
  });
  h+=`<div class="wsbar">
    <button class="tbtn" onclick="wsToDocs(${bi})">📄 구글 문서로 만들기</button>`;
  if(C.googleClientId) h+=`<button class="tbtn" onclick="wsDriveUpload(${bi})">☁ 드라이브에 바로 저장</button>`;
  if(C.driveFolderUrl) h+=`<button class="tbtn ghost" onclick="window.open('${C.driveFolderUrl}','_blank')">제출 폴더 열기</button>`;
  if(C.formUrl)        h+=`<button class="tbtn ghost" onclick="window.open('${C.formUrl}','_blank')">설문지로 제출</button>`;
  h+=`<button class="tbtn ghost" onclick="wsCopy(${bi})">복사</button>
    <button class="tbtn ghost" onclick="wsDownload(${bi})">txt 내려받기</button>
    <button class="tbtn ghost" onclick="window.print()">인쇄</button>
    <span class="saved" id="sv${bi}"></span></div>
    <div class="wshelp">📄 <b>구글 문서로 만들기</b>를 누르면 작성한 내용이 복사되고 새 구글 문서가 열립니다.
    문서에서 <b>Ctrl+V</b>로 붙여 넣으면 내 드라이브에 자동 저장됩니다. 문서 이름을 제출 규칙에 맞게 바꾼 뒤 제출 폴더로 옮기세요.</div>
    </div>`;
  return h;
}
/* 제출 파일 이름 만들기 */
function wsFileName(bi){
  const C=(typeof CONFIG!=="undefined")?CONFIG:{};
  const w=LESSON.blocks[bi].worksheet;
  const g=id=>{const el=document.getElementById(id);return el&&el.value.trim()?el.value.trim():"";};
  const pat=C.fileNamePattern||"{회차}회차_{활동지}_{학교}_{이름}";
  return pat.replace("{회차}",LESSON.n).replace("{활동지}",w.title)
            .replace("{학교}",g("wsSchool")||"학교")
            .replace("{이름}",g("wsName")||"이름")
            .replace(/[\\/:*?"<>|]/g,"");
}
/* ---------- 채점 기준표 ---------- */
/* block.rubric = {area, areaPoints, when, total, note,
     items:[{n:"평가 요소", pt:5, hi:"상", mid:"중", lo:"하"}]}          */
function renderRubric(r,bi){
  if(!r)return"";
  const sum=r.items.reduce((a,i)=>a+i.pt,0);
  let h=`<div class="rub" id="rub${bi}">
   <div class="rubh">
     <div><div class="rt">${r.title||"활동지 채점 기준표"}</div>
       <div class="rs">${r.area?`<b>${r.area}</b> · `:""}${r.when||""}${r.areaPoints?` · 영역 배점 ${r.areaPoints}점`:""}</div></div>
     <div class="rtot"><b>${sum}</b><span>점 만점</span></div>
   </div>
   <div class="tw"><table style="min-width:660px">
    <thead><tr><th style="width:130px">평가 요소</th><th style="width:52px" class="ctr">배점</th>
      <th>상 · 100~80%</th><th>중 · 79~50%</th><th>하 · 49% 이하</th><th style="width:78px" class="ctr">내 점수</th></tr></thead>
    <tbody>`;
  r.items.forEach((it,i)=>{
    h+=`<tr><td><b>${it.n}</b></td><td class="ctr pt">${it.pt}</td>
      <td>${it.hi}</td><td>${it.mid}</td><td>${it.lo}</td>
      <td class="ctr"><input type="number" class="rin" min="0" max="${it.pt}" step="0.5"
         data-rb="${bi}" data-ri="${i}" data-max="${it.pt}"></td></tr>`;
  });
  h+=`</tbody><tfoot><tr><td colspan="5" style="text-align:right;color:var(--mut)"><b>합계</b></td>
      <td class="ctr"><span class="rsum" id="rsum${bi}">—</span></td></tr></tfoot>
   </table></div>`;
  if(r.note)h+=`<div class="rubnote">${r.note}</div>`;
  h+=`<div class="rubbar">
     <span class="rubhint">스스로 채점해 보세요. 교사 채점 전 자기 점검용입니다.</span>
     <button class="tbtn ghost" onclick="rubClear(${bi})">지우기</button></div></div>`;
  return h;
}
function rubBind(){
  document.querySelectorAll(".rin").forEach(el=>{
    const bi=el.dataset.rb;
    const saved=STORE.get("rub",{});
    if(saved[bi]&&saved[bi][el.dataset.ri]!==undefined)el.value=saved[bi][el.dataset.ri];
    el.addEventListener("input",()=>{
      const mx=+el.dataset.max;
      if(el.value!==""&&(+el.value>mx||+el.value<0))el.classList.add("bad");else el.classList.remove("bad");
      const s=STORE.get("rub",{});s[bi]=s[bi]||{};s[bi][el.dataset.ri]=el.value;STORE.set("rub",s);
      rubSum(bi);
    });
    rubSum(bi);
  });
}
function rubSum(bi){
  const els=[...document.querySelectorAll(`.rin[data-rb="${bi}"]`)];
  const any=els.some(e=>e.value!=="");
  const t=els.reduce((a,e)=>a+(+e.value||0),0);
  const max=els.reduce((a,e)=>a+ +e.dataset.max,0);
  const el=document.getElementById("rsum"+bi);
  if(el)el.textContent=any?`${t} / ${max}`:"—";
}
function rubClear(bi){
  document.querySelectorAll(`.rin[data-rb="${bi}"]`).forEach(e=>{e.value="";e.classList.remove("bad");});
  const s=STORE.get("rub",{});delete s[bi];STORE.set("rub",s);rubSum(bi);
}

/* 체크리스트는 쓰지 않는다. 수업 페이지에서 완전히 제외한다. */

function renderBlock(b,i){
  const kindName={open:"도입",lecture:"강의",task:"과제",talk:"토의",close:"정리",act:"활동"}[b.kind]||b.kind;
  let h=`<div class="blk" id="blk${i}" data-i="${i}"><div class="wrap-n">
    <div class="blk-h"><span class="kind">${kindName}</span><h2>${b.title}</h2><span class="mins">${b.mins}분</span></div>`;
  if(b.sub)h+=`<p class="blk-sub">${b.sub}</p>`;
  (b.sections||[]).forEach((s,si)=>h+=renderSection(s,si));
  if(b.worksheet)h+=`<div class="lbl">활동지</div>`+renderWorksheet(b.worksheet,i);
  if(b.rubric)h+=`<div class="lbl">채점 기준표</div>`+renderRubric(b.rubric,i);
  if(b.quiz)h+=`<div class="lbl">확인 문제</div>`+renderQuiz(b.quiz,i);
  if(b.tail)h+=b.tail;
  h+=`<div class="foot-nav">
    <button class="tbtn ghost" onclick="goBlock(${i-1})" ${i===0?"disabled style='opacity:.35'":""}>← 이전</button>
    <button class="tbtn" onclick="markDone(${i});goBlock(${i+1})" ${i===LESSON.blocks.length-1?"style='display:none'":""}>완료하고 다음 →</button>
    ${i===LESSON.blocks.length-1?`<button class="tbtn" onclick="markDone(${i});toast('수업을 마쳤습니다. 수고하셨습니다')">수업 마치기 ✓</button>`:""}
  </div></div></div>`;
  return h;
}

/* ---------- 교과서 지면 ---------- */
/* sec.pages = [{p:29, t:"융합 프로젝트의 개념과 핵심 역량"}] 형태로 지정하면
   해당 쪽 이미지를 assets/tb_p{쪽}.png 에서 불러와 보여 준다. */
function renderPages(pages){
  if(!pages||!pages.length)return"";
  return `<div class="tbpages">${pages.map(p=>
    `<a class="tbpage" href="#" onclick="lbOpen('assets/tb_p${p.p}.png','교과서 ${p.p}쪽 — ${esc(p.t||"")}');return false">
      <img src="assets/tb_p${p.p}.png" alt="교과서 ${p.p}쪽" loading="lazy">
      <div class="cap"><b>교과서 ${p.p}쪽</b>${esc(p.t||"")}</div></a>`).join("")}</div>`;
}
/* 확대 보기 */
let LBSET=[],LBI=0;
function lbCollect(){
  LBSET=[...document.querySelectorAll(".blk.on .tbpage")].map(a=>{
    const m=a.getAttribute("onclick").match(/lbOpen\('([^']+)','([^']*)'/);
    return m?{src:m[1],cap:m[2]}:null;}).filter(Boolean);
}
function lbOpen(src,cap){
  lbCollect();
  LBI=Math.max(0,LBSET.findIndex(x=>x.src===src));
  if(!LBSET.length)LBSET=[{src,cap}],LBI=0;
  lbPaint();document.getElementById("lb").classList.add("on");
}
function lbPaint(){
  const it=LBSET[LBI];if(!it)return;
  document.getElementById("lbImg").src=it.src;
  document.getElementById("lbCap").textContent=it.cap+(LBSET.length>1?`  (${LBI+1}/${LBSET.length})`:"");
}
function lbStep(d){if(!LBSET.length)return;LBI=(LBI+d+LBSET.length)%LBSET.length;lbPaint();}
function lbClose(){document.getElementById("lb").classList.remove("on");}

/* ---------- 240분 시간표 ---------- */
/* 블록 사이에 들어가는 휴식은 LESSON.breaks 로 지정한다. {after:블록번호, mins:분} */
function renderTimetable(){
  const st=LESSON.time.split("~")[0].split(":").map(Number);
  let cur=st[0]*60+st[1];
  const f=v=>String(Math.floor(v/60)%24).padStart(2,"0")+":"+String(v%60).padStart(2,"0");
  const breaks={};(LESSON.breaks||[]).forEach(b=>breaks[b.after]=b.mins);
  let out=[],total=0;
  LESSON.blocks.forEach((b,i)=>{
    out.push(`<a class="tt" href="#" onclick="goBlock(${i});return false"><b>${f(cur)}</b><span>${b.nav}</span><i>${b.mins}′</i></a>`);
    cur+=b.mins;total+=b.mins;
    if(breaks[i]){out.push(`<span class="tt br"><b>${f(cur)}</b><span>휴식</span><i>${breaks[i]}′</i></span>`);cur+=breaks[i];total+=breaks[i];}
  });
  return `<div class="ttwrap"><div class="ttbar">${out.join("")}</div>
    <div class="ttfoot">총 ${total}분 · ${LESSON.time} · 블록을 누르면 해당 부분으로 이동합니다</div></div>`;
}

/* ---------- 초기화 ---------- */
function boot(){
  document.title=`${LESSON.n}회차 · ${LESSON.title} — 인공지능 융합프로젝트`;
  document.getElementById("lhead").innerHTML=`<div class="wrap-n">
    <div class="top"><div class="no">${String(LESSON.n).padStart(2,"0")}</div>
      <div><div class="meta">${LESSON.date} (${LESSON.dow}) · ${LESSON.time} · ${LESSON.ch} · ${LESSON.mode}</div>
      <h1>${LESSON.title}</h1></div></div>
    <div class="goals"><b>학습 목표</b><ol>${LESSON.goals.map(g=>`<li>${g}</li>`).join("")}</ol></div>
    ${renderTimetable()}
  </div>`;
  document.getElementById("bnav").innerHTML=`<div class="wrap-n"><div class="in">
    <a class="homebtn" href="index.html" title="수업 운영실 메인으로">🏠 메인</a>
    ${LESSON.blocks.map((b,i)=>`<button class="bn" id="bn${i}" onclick="goBlock(${i})">${b.nav}<span class="m">${b.mins}′</span></button>`).join("")}
    <div class="sp"></div>
    <button class="tbtn" onclick="document.getElementById('timer').classList.toggle('show')">⏱ 타이머</button>
  </div></div>`;
  /* 화면 어디서나 메인으로 — 왼쪽 아래 고정 버튼 */
  const hb=document.createElement("a");
  hb.id="homefab";hb.href="index.html";hb.title="수업 운영실 메인으로";
  hb.innerHTML="🏠 <span>메인으로</span>";
  document.body.appendChild(hb);
  document.getElementById("blocks").innerHTML=LESSON.blocks.map(renderBlock).join("");
  document.getElementById("timer").innerHTML=`
    <div class="hd"><span>수업 타이머</span><button onclick="document.getElementById('timer').classList.remove('show')">✕</button></div>
    <div id="tdisp">00:00</div><div id="tlabel">—</div>
    <div class="trow"><button onclick="setT(30,'강의 블록 30분')">30</button><button onclick="setT(60,'과제 60분')">60</button><button onclick="setT(15,'소회의실 15분')">15</button></div>
    <div class="trow"><button onclick="setT(10,'휴식 10분')">10</button><button onclick="setT(5,'정리 5분')">5</button><button onclick="setT(3,'발표 3분')">3</button></div>
    <div class="trow"><button class="pri" id="tgo">시작</button><button onclick="stopT()">정지</button></div>`;
  document.getElementById("tgo").onclick=toggleT;
  /* 확대 보기 오버레이 */
  const lb=document.createElement("div");lb.id="lb";
  lb.innerHTML=`<button class="x" onclick="lbClose()">✕</button>
    <button class="nav prev" onclick="event.stopPropagation();lbStep(-1)">‹</button>
    <img id="lbImg" alt="" onclick="event.stopPropagation()">
    <button class="nav next" onclick="event.stopPropagation();lbStep(1)">›</button>
    <div class="cap" id="lbCap"></div>`;
  lb.onclick=lbClose;document.body.appendChild(lb);
  document.addEventListener("keydown",e=>{
    if(!lb.classList.contains("on"))return;
    if(e.key==="Escape")lbClose();
    if(e.key==="ArrowLeft")lbStep(-1);
    if(e.key==="ArrowRight")lbStep(1);
  });
  /* 교과서 이미지가 없는 배포본(공개 웹)에서는 깨진 그림 대신 안내를 보여 준다 */
  document.querySelectorAll("figure.fig img, .tbpage img").forEach(img=>{
    img.addEventListener("error",()=>{
      const fig=img.closest("figure.fig")||img.closest(".tbpage");
      if(!fig||fig.dataset.missed)return;
      fig.dataset.missed="1";
      const cap=fig.querySelector("figcaption")||fig.querySelector(".cap");
      const txt=cap?cap.textContent.trim():"교과서 자료";
      const ph=document.createElement("div");
      ph.className="figmiss";
      ph.innerHTML=`<b>교과서 자료</b>${esc(txt)}<span>저작권 보호를 위해 공개본에서는 교과서 이미지를 싣지 않았습니다. 교과서 해당 쪽을 펴서 함께 보세요.</span>`;
      img.remove();
      if(cap)cap.remove();
      fig.appendChild(ph);
      fig.style.cursor="default";
    },{once:true});
  });
  /* 본문 그림도 눌러서 확대 */
  document.querySelectorAll("figure.fig img").forEach(img=>{
    img.addEventListener("click",()=>{
      const cap=img.parentNode.querySelector("figcaption");
      LBSET=[{src:img.getAttribute("src"),cap:cap?cap.textContent.trim():""}];LBI=0;
      lbPaint();document.getElementById("lb").classList.add("on");
    });
  });
  /* 저장된 기록을 복원하다 문제가 생겨도 수업 진행은 막지 않는다 */
  try{restore();}catch(e){console.warn("기록 복원 실패",e);}
  try{bindWorksheets();}catch(e){console.warn("활동지 연결 실패",e);}
  try{rubBind();}catch(e){console.warn("채점표 연결 실패",e);}
  const st=+(localStorage.getItem(`aifp2026_L${LESSON.n}_at`)||0);
  goBlock(st,true);
  paintT();
}

/* ---------- 블록 이동 ---------- */
function goBlock(i,silent){
  if(i<0||i>=LESSON.blocks.length)return;
  document.querySelectorAll(".blk").forEach(b=>b.classList.remove("on"));
  document.getElementById("blk"+i).classList.add("on");
  document.querySelectorAll(".bn[id]").forEach(b=>b.classList.remove("active"));
  document.getElementById("bn"+i).classList.add("active");
  localStorage.setItem(`aifp2026_L${LESSON.n}_at`,i);
  if(!silent)window.scrollTo({top:0,behavior:"smooth"});
  const m=LESSON.blocks[i].mins;
  if(!silent&&m)setT(m,LESSON.blocks[i].nav+" "+m+"분");
}
function markDone(i){
  const d=STORE.get("done",[]);if(!d.includes(i))d.push(i);STORE.set("done",d);
  document.getElementById("bn"+i).classList.add("ok");
}

/* ---------- 퀴즈 ---------- */
/* ANS[블록][문항] = 학생이 고른 보기 번호 */
const ANS={};
function paintQ(bi,qi,chosen){
  const item=LESSON.blocks[bi].quiz[qi];
  const root=document.querySelector(`.quiz[data-qb="${bi}"] .qitem[data-q="${qi}"]`);
  if(!root)return;
  root.dataset.locked="1";
  root.querySelectorAll(".opt").forEach((o,j)=>{
    o.classList.remove("right","wrong");
    if(j===item.a)o.classList.add("right");
    else if(j===chosen)o.classList.add("wrong");
  });
  root.querySelector(".why").classList.add("show");
}
function paintScore(bi){
  const b=LESSON.blocks[bi];if(!b||!b.quiz)return;
  const picked=ANS[bi]||{};
  const tried=Object.keys(picked).length;
  const got=Object.keys(picked).filter(qi=>picked[qi]===b.quiz[qi].a).length;
  const el=document.getElementById("qs"+bi);if(!el)return;
  el.innerHTML=`푼 문항 ${tried}/${b.quiz.length} · 정답 <b>${got}</b>문항`
    +(tried===b.quiz.length?(got===b.quiz.length?" — 모두 맞혔습니다.":" — 틀린 문항의 해설을 다시 읽어 보세요."):"");
}
function pick(bi,qi,oi){
  const root=document.querySelector(`.quiz[data-qb="${bi}"] .qitem[data-q="${qi}"]`);
  if(!root||root.dataset.locked)return;
  paintQ(bi,qi,oi);
  ANS[bi]=ANS[bi]||{};ANS[bi][qi]=oi;
  STORE.set("quiz",ANS);
  paintScore(bi);
}

/* ---------- 활동지 ---------- */
function bindWorksheets(){
  document.querySelectorAll("[data-w]").forEach(el=>{
    const bi=el.dataset.w,fi=el.dataset.f;
    const saved=STORE.get("ws",{});
    if(saved[bi]&&saved[bi][fi]!==undefined){el.value=saved[bi][fi];}
    cnt(el,bi,fi);
    el.addEventListener("input",()=>{
      const s=STORE.get("ws",{});s[bi]=s[bi]||{};s[bi][fi]=el.value;STORE.set("ws",s);
      cnt(el,bi,fi);
      const sv=document.getElementById("sv"+bi);if(sv){sv.textContent="저장됨";clearTimeout(sv._h);sv._h=setTimeout(()=>sv.textContent="",1400);}
    });
  });
  /* 학교 · 이름 — 회차가 달라도 유지되도록 공용 키에 저장 */
  ["School","Name"].forEach(k=>{
    const el=document.getElementById("ws"+k);if(!el)return;
    const key=k.toLowerCase();
    const shared=JSON.parse(localStorage.getItem("aifp2026_who")||"{}");
    if(shared[key])el.value=shared[key];
    STORE.set("who",shared);
    el.addEventListener("input",()=>{
      const cur=JSON.parse(localStorage.getItem("aifp2026_who")||"{}");
      cur[key]=el.value.trim();
      localStorage.setItem("aifp2026_who",JSON.stringify(cur));
      STORE.set("who",cur);
    });
  });
}
function cnt(el,bi,fi){const c=document.getElementById(`c${bi}_${fi}`);if(c)c.textContent=(el.value||"").length+"자";}
function wsText(bi){
  const b=LESSON.blocks[bi],w=b.worksheet,s=STORE.get("ws",{})[bi]||{};
  const who=STORE.get("who",{});
  let t=`[${LESSON.date} ${LESSON.n}회차 · ${LESSON.ch}] ${w.title}\n`;
  t+=`${LESSON.title}\n`;
  t+=`학교: ${who.school||"____________"}    이름: ${who.name||"____________"}\n`;
  t+=`${"─".repeat(46)}\n\n`;
  w.fields.forEach((f,i)=>{t+=`■ ${f.label.replace(/<[^>]+>/g,"")}\n${(s[i]||"(미작성)")}\n\n`;});
  return t;
}
function wsCopy(bi){copyText(wsText(bi),null);}
function wsDownload(bi){
  const blob=new Blob(["﻿"+wsText(bi)],{type:"text/plain;charset=utf-8"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);
  a.download=wsFileName(bi)+".txt";a.click();
  toast("내려받았습니다. 제출 폴더에 올리세요");
}
/* ---------- 구글 드라이브로 보내기 ---------- */
/* (1) 설정 없이 쓰는 방법 — 내용을 복사하고 새 구글 문서를 연다.
       학생이 Ctrl+V 로 붙여 넣으면 본인 드라이브에 자동 저장된다.        */
function wsToDocs(bi){
  const name=wsFileName(bi);
  navigator.clipboard.writeText(wsText(bi)).then(()=>{
    window.open("https://docs.new","_blank");
    toast("복사했습니다. 열린 문서에 Ctrl+V 로 붙여 넣으세요");
  }).catch(()=>{
    window.open("https://docs.new","_blank");
    toast("복사에 실패했습니다. 활동지 내용을 직접 선택해 복사하세요");
  });
  const el=document.getElementById("sv"+bi);
  if(el){el.textContent="문서 이름 → "+name;clearTimeout(el._h);el._h=setTimeout(()=>el.textContent="",9000);}
}
/* (2) 설정한 경우 — 드라이브 API 로 곧바로 업로드한다.
       config.js 의 googleClientId 가 있어야 하고 http(s) 주소로 열어야 한다. */
let _gToken=null;
function wsDriveUpload(bi){
  const C=(typeof CONFIG!=="undefined")?CONFIG:{};
  if(!C.googleClientId){toast("config.js 에 googleClientId 를 먼저 입력하세요");return;}
  if(location.protocol==="file:"){
    alert("드라이브 바로 저장은 file:/// 로 연 페이지에서는 동작하지 않습니다.\n\n"
         +"· 이 페이지를 http:// 또는 https:// 주소로 열어 주세요.\n"
         +"· 지금 바로 제출하려면 [구글 문서로 만들기] 를 사용하세요.");
    return;
  }
  const go=()=>{
    google.accounts.oauth2.initTokenClient({
      client_id:C.googleClientId,
      scope:"https://www.googleapis.com/auth/drive.file",
      callback:(res)=>{
        if(res.error){toast("구글 로그인에 실패했습니다");return;}
        _gToken=res.access_token; doUpload(bi);
      }
    }).requestAccessToken();
  };
  if(window.google&&google.accounts&&google.accounts.oauth2){go();return;}
  const sc=document.createElement("script");
  sc.src="https://accounts.google.com/gsi/client";
  sc.onload=go;
  sc.onerror=()=>toast("구글 스크립트를 불러오지 못했습니다");
  document.head.appendChild(sc);
}
function doUpload(bi){
  const C=(typeof CONFIG!=="undefined")?CONFIG:{};
  const name=wsFileName(bi), body=wsText(bi);
  const meta={name:name, mimeType:"application/vnd.google-apps.document"};
  if(C.googleFolderId)meta.parents=[C.googleFolderId];
  const b="-------aifp"+Math.random().toString(36).slice(2);
  const payload=
    `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`+
    `--${b}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${body}\r\n--${b}--`;
  toast("드라이브에 올리는 중…");
  fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",{
    method:"POST",
    headers:{Authorization:"Bearer "+_gToken,"Content-Type":"multipart/related; boundary="+b},
    body:payload
  }).then(r=>r.json()).then(d=>{
    if(d.error){toast("업로드 실패 · "+(d.error.message||""));return;}
    toast("드라이브에 저장했습니다");
    const el=document.getElementById("sv"+bi);
    if(el&&d.webViewLink)el.innerHTML=`<a href="${d.webViewLink}" target="_blank" style="color:var(--accent)">저장된 문서 열기 →</a>`;
  }).catch(()=>toast("업로드 중 오류가 발생했습니다"));
}

/* ---------- 복원 ---------- */
function restore(){
  STORE.get("done",[]).forEach(i=>{const el=document.getElementById("bn"+i);if(el)el.classList.add("ok");});
  const q=STORE.get("quiz",{});
  Object.keys(q).forEach(bi=>{
    const b=LESSON.blocks[bi];
    if(!b||!b.quiz||typeof q[bi]!=="object")return;
    ANS[bi]={};
    Object.keys(q[bi]).forEach(qi=>{
      const chosen=q[bi][qi];
      if(typeof chosen!=="number"||!b.quiz[qi])return;   // 옛 형식 저장값은 무시
      ANS[bi][qi]=chosen;
      paintQ(bi,qi,chosen);
    });
    paintScore(bi);
  });
}
function resetLesson(){
  if(!confirm("이 회차에 입력한 활동지·퀴즈·진도를 모두 지웁니다. 계속할까요?"))return;
  ["done","quiz","ws","rub"].forEach(k=>localStorage.removeItem(STORE.key(k)));
  localStorage.removeItem(`aifp2026_L${LESSON.n}_at`);location.reload();
}

/* ---------- 타이머 ---------- */
let tsec=0,tid=null,trun=false;
function paintT(){const d=document.getElementById("tdisp");if(!d)return;
  const m=Math.floor(Math.abs(tsec)/60),s=Math.abs(tsec)%60;
  d.textContent=(tsec<0?"-":"")+String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");
  d.classList.toggle("warn",tsec<=60);}
function setT(m,label){tsec=m*60;const l=document.getElementById("tlabel");if(l)l.textContent=label||"";paintT();stopT();}
function stopT(){clearInterval(tid);tid=null;trun=false;const g=document.getElementById("tgo");if(g)g.textContent="시작";}
function toggleT(){const g=document.getElementById("tgo");
  if(trun){stopT();return;}
  if(tsec===0)setT(30,"강의 30분");
  trun=true;g.textContent="일시정지";
  tid=setInterval(()=>{tsec--;paintT();if(tsec===0)toast("시간이 되었습니다");},1000);}
