# -*- coding: utf-8 -*-
"""8회차 코랩 노트북 만들기 → 수업운영_웹/colab/lesson08_knn_smartpot.ipynb"""
import nbformat as nbf, os, sys

OUT = sys.argv[1]
nb = nbf.v4.new_notebook()
C = []
md = lambda s: C.append(nbf.v4.new_markdown_cell(s.strip("\n")))
py = lambda s: C.append(nbf.v4.new_code_cell(s.strip("\n")))

md(r"""
# 8회차 · k-NN으로 스마트 화분 만들기 🌿
**2026-2 온라인 공동교육과정 · 인공지능 융합프로젝트** — 대전대신고 하진수

이 노트북은 위에서부터 차례로 실행합니다(`Shift + Enter`). 각 단계는 웹 실습실의 ①~⑥과 짝을 이룹니다.

| 단계 | 하는 일 | 웹 실습실 |
|---|---|---|
| 0 | 데이터 불러오기 · 실습 식물 정하기 | ② 식물 고르기 |
| 1 | 변수별 관계 시각화 (상자그림 · 산점도 행렬 · 상관계수) | ③ 관계 시각화 |
| 2 | **3차원**으로 돌려 보기 | ③ 3차원 |
| 3 | k-NN을 **numpy로 직접** 만들기 — 다섯 단계 | ① k-NN 직접 만들기 |
| 4 | 모델 설계 실험 — 표준화 · 관계없는 변수 · k 고르기 | ④ 모델 설계 |
| 5 | 예측 결과 확인 · **정확도와 혼동행렬** | ④ 혼동행렬 |
| 6 | 최적 조건 분석 — 모델에게 묻기 | ⑤ 최적 조건 |
| 7 | 피지컬 컴퓨팅 — 마이크로비트 코드 만들기 · 7일 시뮬레이션 | ⑥ 자동화 |

> 센서 기록은 **교육용 가상 데이터**입니다. 식물별 적정 범위(문헌)에서 벗어난 정도로 식물의 스트레스를 계산하고 잡음을 섞어 상태(건강·주의·위험)를 매겼습니다.
> 그래프 글자는 한글 깨짐을 피하려고 영어로 적었습니다: **Healthy = 건강, Caution = 주의, Danger = 위험**.
""")

md("## 0. 준비 — 데이터 불러오기")
py(r"""
import numpy as np, pandas as pd, matplotlib.pyplot as plt
import plotly.express as px, plotly.graph_objects as go
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.neighbors import KNeighborsClassifier
from sklearn.metrics import confusion_matrix, ConfusionMatrixDisplay, classification_report, accuracy_score

BASE = "https://hajinsu9951.github.io/aifp-2026/data/"
try:
    opt = pd.read_csv(BASE + "plants_optimal.csv")
    df  = pd.read_csv(BASE + "smart_plant_sensor.csv")
    print("수업 사이트에서 데이터를 불러왔습니다.")
except Exception as e:
    print("사이트에 연결하지 못해 같은 방법으로 데이터를 직접 만듭니다:", type(e).__name__)
    df = opt = None
""")
md("인터넷이 안 될 때를 대비한 **데이터 만들기 코드**입니다. 위에서 불러왔다면 그냥 실행만 하고 넘어가세요. (수업 사이트의 `data/make_data.py`와 같은 코드)")
py(r"""
PLANTS = [
 dict(key="monstera",  name="몬스테라",   sci="Monstera deliciosa",     soil=(40,60), temp=(18,27), lux=(5000,15000),  hum=(50,70), noise=(30,60)),
 dict(key="pothos",    name="스킨답서스", sci="Epipremnum aureum",      soil=(30,50), temp=(18,27), lux=(1500,8000),   hum=(40,70), noise=(30,60)),
 dict(key="peacelily", name="스파티필룸", sci="Spathiphyllum wallisii", soil=(55,75), temp=(20,28), lux=(1000,5000),   hum=(50,80), noise=(30,60)),
 dict(key="snakeplant",name="산세베리아", sci="Sansevieria trifasciata",soil=(10,30), temp=(18,27), lux=(1000,15000),  hum=(30,50), noise=(30,60)),
 dict(key="basil",     name="바질",       sci="Ocimum basilicum",       soil=(50,70), temp=(18,25), lux=(15000,40000), hum=(40,65), noise=(30,60)),
 dict(key="echeveria", name="에케베리아(다육)", sci="Echeveria spp.",   soil=(5,25),  temp=(18,27), lux=(20000,50000), hum=(30,50), noise=(30,60))]
VARS = [("soil_moisture","soil",(0,100),1.0), ("temperature","temp",(5,40),0.8), ("light_lux","lux",(0,80000),0.8),
        ("humidity","hum",(10,95),0.5), ("noise_db","noise",(20,90),0.0)]   # 소음은 상태와 무관(가중치 0)

def make(seed=2026, n=240):
    rng = np.random.default_rng(seed); rows = []
    for p in PLANTS:
        n_off = rng.choice([0,1,2,3], size=n, p=[.30,.35,.25,.10])
        off = np.zeros((n,4), bool)
        for i, m in enumerate(n_off): off[i, rng.choice(4, m, replace=False)] = True
        cols, stress = {}, np.zeros(n)
        for j, (col, k, (lo_lim, hi_lim), w) in enumerate(VARS):
            lo, hi = p[k]; log = col == "light_lux"
            a, b = (np.log10(lo), np.log10(hi)) if log else (lo, hi); width = b - a
            v = rng.uniform(a, b, n)
            if col == "noise_db": v = rng.uniform(lo_lim + 5, 80, n)
            else:
                side = rng.choice([-1,1], n); dist = rng.uniform(.05, 1.0, n) * width
                v = np.where(off[:, j], np.where(side < 0, a - dist, b + dist), v)
            if log: v = np.clip(10**v, 100, hi_lim); lv = np.log10(v)
            else:   v = np.clip(v, lo_lim, hi_lim); lv = v
            d = np.where(lv < a, (a-lv)/(width/2), np.where(lv > b, (lv-b)/(width/2), 0))
            cols[col] = np.round(v, -1) if log else np.round(v, 1); stress += w * d
        stress += rng.normal(0, .15, n)
        state = np.where(stress < .30, 0, np.where(stress < 1.0, 1, 2))
        rows.append(pd.DataFrame({"plant": p["key"], "plant_ko": p["name"], **cols, "state": state}))
    out = pd.concat(rows, ignore_index=True)
    out["state_ko"] = out.state.map({0:"건강",1:"주의",2:"위험"}); out["state_en"] = out.state.map({0:"Healthy",1:"Caution",2:"Danger"})
    return out

if df is None:
    df = make()
    opt = pd.DataFrame([{"plant":p["key"],"식물":p["name"],"학명":p["sci"],
        **{f"{k}_{m}":p[k][i] for k in ["soil","temp","lux","hum","noise"] for i,m in enumerate(["min","max"])}} for p in PLANTS])
print(df.shape); df.head()
""")
md(r"""
### 실습 식물 정하기
아래 표는 식물별 **적정 환경값**(문헌 정리)입니다. 웹 실습실 ②에서 고른 식물의 영어 이름을 `PLANT`에 넣으세요.
`monstera` · `pothos` · `peacelily` · `snakeplant` · `basil` · `echeveria`
""")
py(r"""
PLANT = "monstera"     # ← 여기를 바꾸세요

o = opt.set_index("plant").loc[PLANT]
RANGE = {"soil_moisture": (o.soil_min, o.soil_max), "temperature": (o.temp_min, o.temp_max),
         "light_lux": (o.lux_min, o.lux_max), "humidity": (o.hum_min, o.hum_max), "noise_db": (o.noise_min, o.noise_max)}
d = df[df.plant == PLANT].reset_index(drop=True)
d["log_lux"] = np.log10(d.light_lux)          # 조도는 배수로 변하므로 로그로 본다
FEATS = ["soil_moisture", "temperature", "light_lux", "humidity", "noise_db"]
COLORS = {"Healthy": "#4c9a6a", "Caution": "#d8a334", "Danger": "#c8553d"}
ORDER = ["Healthy", "Caution", "Danger"]

display(opt.drop(columns=[c for c in opt.columns if c in ("근거",)], errors="ignore"))
print(f"\n선택: {o['식물']} · 기록 {len(d)}개")
print(d.state_en.value_counts().reindex(ORDER))
""")

md(r"""
## 1. 변수별 관계 시각화
모델을 만들기 전에 **데이터를 먼저 봅니다.** 세 가지 그림으로 확인합니다.
1. **상자그림** — 상태별로 각 변수의 값이 어떻게 다른가?
2. **산점도 행렬** — 두 변수씩 짝지으면 건강한 점은 어디에 모이는가?
3. **상관계수** — 변수끼리, 그리고 상태와 직선 관계가 있는가?
""")
py(r"""
fig, axes = plt.subplots(1, 5, figsize=(18, 3.6))
for ax, f in zip(axes, FEATS):
    data = [d.loc[d.state_en == s, f] for s in ORDER]
    bp = ax.boxplot(data, patch_artist=True, widths=.6)
    for patch, s in zip(bp["boxes"], ORDER): patch.set_facecolor(COLORS[s]); patch.set_alpha(.6)
    ax.axhspan(*RANGE[f], color="green", alpha=.08, label="optimal (literature)")
    ax.set_xticks([1,2,3], ORDER); ax.set_title(f)
    if f == "light_lux": ax.set_yscale("log")
axes[0].legend(loc="upper left", fontsize=8)
plt.suptitle(f"{PLANT}: each variable by plant state"); plt.tight_layout(); plt.show()
""")
md(r"""
**읽기 포인트** — 초록 띠가 문헌의 적정 범위입니다.
- Healthy 상자는 대부분 초록 띠 안에 있지만, **Caution·Danger 상자도 띠와 겹칩니다.** 한 변수만 적정이어도 다른 변수가 어긋나면 상태가 나빠지기 때문입니다.
- `noise_db`는 세 상자가 거의 같습니다 → **상태와 관계없는 변수**입니다.
""")
py(r"""
cols = ["soil_moisture", "temperature", "log_lux", "humidity", "noise_db"]
pd.plotting.scatter_matrix(d[cols], c=d.state_en.map(COLORS), figsize=(11, 11), alpha=.7, s=14, diagonal="hist", hist_kwds={"bins": 18, "color": "#999"})
plt.suptitle(f"{PLANT}: scatter matrix (green=Healthy, yellow=Caution, red=Danger)", y=0.92); plt.show()
""")
py(r"""
corr = d[cols + ["state"]].corr()
fig, ax = plt.subplots(figsize=(6.5, 5.5))
im = ax.imshow(corr, cmap="RdBu_r", vmin=-1, vmax=1)
ax.set_xticks(range(len(corr)), corr.columns, rotation=45, ha="right"); ax.set_yticks(range(len(corr)), corr.columns)
for i in range(len(corr)):
    for j in range(len(corr)): ax.text(j, i, f"{corr.iloc[i,j]:.2f}", ha="center", va="center", fontsize=9)
plt.colorbar(im); ax.set_title("correlation"); plt.tight_layout(); plt.show()
""")
md(r"""
**생각해 보기** — `state`와 각 변수의 상관계수가 모두 0에 가깝게 나옵니다. 그런데 상자그림에서는 분명히 차이가 있었습니다. 왜일까요?
> 상관계수는 **직선 관계**만 잽니다. 식물은 &ldquo;너무 적어도, 너무 많아도&rdquo; 나쁩니다(가운데가 좋은 **산 모양** 관계). 그래서 직선 하나로 나누는 모델보다 **가까운 이웃을 보는 k-NN**이 잘 맞습니다.
""")

md(r"""
## 2. 3차원으로 돌려 보기
마우스로 끌어 돌리고, 휠로 확대합니다. **초록 상자가 문헌의 적정 범위**입니다. 범례를 누르면 상태별로 켜고 끌 수 있습니다.
""")
py(r"""
def box_lines(x, y, z):
    xs, ys, zs = [], [], []
    for a in (0, 1):
        for b in (0, 1):
            for p, q in [((0,a,b),(1,a,b)), ((a,0,b),(a,1,b)), ((a,b,0),(a,b,1))]:
                xs += [x[p[0]], x[q[0]], None]; ys += [y[p[1]], y[q[1]], None]; zs += [z[p[2]], z[q[2]], None]
    return go.Scatter3d(x=xs, y=ys, z=zs, mode="lines", line=dict(color="green", width=4), name="optimal box")

X3, Y3, Z3 = "temperature", "log_lux", "soil_moisture"
fig = px.scatter_3d(d, x=X3, y=Y3, z=Z3, color="state_en", color_discrete_map=COLORS, category_orders={"state_en": ORDER},
                    opacity=.75, height=620, title=f"{PLANT}: temperature × log10(light) × soil moisture")
fig.update_traces(marker=dict(size=4))
fig.add_trace(box_lines(RANGE[X3], np.log10(RANGE["light_lux"]), RANGE[Z3]))
fig.show()
""")
md(r"""
**발문** — ① 초록 점은 상자 **안쪽**에 모여 있나요? ② 상자 밖의 초록 점, 상자 안의 노란 점은 왜 생겼을까요? (힌트: 그림에 없는 **습도**가 어긋났거나, 같은 환경에서도 식물마다 반응이 다릅니다.)
③ `X3, Y3, Z3`를 `humidity`, `noise_db`로 바꿔서 다시 그려 보세요. 소음 축 방향으로는 점이 어떻게 퍼지나요?
""")

md(r"""
## 3. k-NN을 numpy로 직접 만들기 — 다섯 단계
라이브러리 없이 만들어 보고, 마지막에 scikit-learn과 **결과가 같은지** 확인합니다.
""")
py(r"""
F = ["soil_moisture", "temperature", "log_lux", "humidity"]          # 소음은 뺀다
X = d[F].to_numpy(); y = d.state.to_numpy()
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=.2, random_state=42, stratify=y)

# STEP 1 · 표준화 — 훈련 데이터의 평균과 표준편차로만!
mu, sd = X_train.mean(axis=0), X_train.std(axis=0)
Z_train = (X_train - mu) / sd
x_new = X_test[0]; z_new = (x_new - mu) / sd
print("새 화분(원래 값)  :", np.round(x_new, 2))
print("새 화분(표준화 값):", np.round(z_new, 2), "  ← 이제 네 변수가 같은 단위(표준편차 몇 개만큼)\n")

# STEP 2 · 거리 계산 — 새 점과 모든 훈련 기록 사이 (유클리드)
dist = np.sqrt(((Z_train - z_new) ** 2).sum(axis=1))
print("거리 앞 5개:", np.round(dist[:5], 3))

# STEP 3 · 정렬
order = np.argsort(dist)
# STEP 4 · k개 고르기
k = 5; nb = order[:k]
print(f"\n가장 가까운 {k}개:")
for r, i in enumerate(nb, 1):
    print(f"  {r}위  거리 {dist[i]:.3f}  상태 {['건강','주의','위험'][y_train[i]]}")
# STEP 5 · 다수결
votes = np.bincount(y_train[nb], minlength=3)
print("\n투표 (건강, 주의, 위험):", votes, "→ 예측:", ["건강","주의","위험"][votes.argmax()], "| 실제:", ["건강","주의","위험"][y_test[0]])
""")
py(r"""
def my_knn(X_train, y_train, X_test, k=5):
    mu, sd = X_train.mean(axis=0), X_train.std(axis=0)
    Zt, Zq = (X_train - mu) / sd, (X_test - mu) / sd
    preds = []
    for z in Zq:
        nb = np.argsort(np.sqrt(((Zt - z) ** 2).sum(axis=1)))[:k]
        preds.append(np.bincount(y_train[nb], minlength=3).argmax())
    return np.array(preds)

mine = my_knn(X_train, y_train, X_test, k=5)
sk = make_pipeline(StandardScaler(), KNeighborsClassifier(n_neighbors=5)).fit(X_train, y_train).predict(X_test)
print("직접 만든 k-NN 정확도 :", round(accuracy_score(y_test, mine), 3))
print("scikit-learn 정확도   :", round(accuracy_score(y_test, sk), 3))
print("두 예측이 같은 비율   :", (mine == sk).mean())
""")
md(r"""
> 두 결과가 (거의) 같습니다. 동점일 때 고르는 방법만 조금 다를 수 있습니다. **k-NN은 이 열 줄이 전부**입니다 — 학습 단계가 없고, 물어볼 때마다 모든 기록과의 거리를 잽니다.
""")

md(r"""
## 4. 모델 설계 실험
같은 k-NN이라도 **설계**에 따라 성능이 크게 달라집니다. 씨앗(`random_state`)을 10번 바꿔 평균을 냅니다 — 한 번의 정확도는 운이 섞여 있기 때문입니다.
""")
py(r"""
def trial(feats, scale=True, k=5, reps=10):
    accs = []
    for s in range(reps):
        Xtr, Xte, ytr, yte = train_test_split(d[feats], d.state, test_size=.2, random_state=s, stratify=d.state)
        m = make_pipeline(StandardScaler(), KNeighborsClassifier(k)) if scale else KNeighborsClassifier(k)
        accs.append(m.fit(Xtr, ytr).score(Xte, yte))
    return np.mean(accs), np.std(accs)

designs = {
    "A  4 vars, raw lux, NO scaling":       (["soil_moisture","temperature","light_lux","humidity"], False),
    "B  4 vars, raw lux, scaling":          (["soil_moisture","temperature","light_lux","humidity"], True),
    "C  4 vars, log lux, scaling":          (["soil_moisture","temperature","log_lux","humidity"], True),
    "D  C + noise (irrelevant variable)":   (["soil_moisture","temperature","log_lux","humidity","noise_db"], True),
    "E  soil moisture only":                (["soil_moisture"], True),
}
res = pd.DataFrame({name: trial(f, s) for name, (f, s) in designs.items()}, index=["mean acc", "std"]).T.round(3)
res
""")
md(r"""
**읽기 포인트**
- **A → B**: 표준화 하나로 정확도가 크게 오릅니다. 조도(수천~수만 lux)가 거리를 혼자 독차지하던 것을 막았기 때문입니다.
- **C → D**: 상태와 **관계없는 소음**을 넣었더니 정확도가 떨어졌습니다. k-NN은 모든 변수를 똑같이 믿으므로, 쓸데없는 변수가 이웃을 엉뚱하게 고르게 만듭니다. → **변수 선택도 설계**입니다.
- **E**: 토양 수분만으로는 부족합니다(3차원 그래프에서 본 것과 같은 결론).
""")
py(r"""
F = ["soil_moisture", "temperature", "log_lux", "humidity"]
Xtr, Xte, ytr, yte = train_test_split(d[F], d.state, test_size=.2, random_state=42, stratify=d.state)
ks = range(1, 32, 2); tr_acc, te_acc, cv_acc = [], [], []
for k in ks:
    m = make_pipeline(StandardScaler(), KNeighborsClassifier(k)).fit(Xtr, ytr)
    tr_acc.append(m.score(Xtr, ytr)); te_acc.append(m.score(Xte, yte))
    cv_acc.append(cross_val_score(make_pipeline(StandardScaler(), KNeighborsClassifier(k)), Xtr, ytr, cv=5).mean())
plt.figure(figsize=(8, 4))
plt.plot(ks, tr_acc, "o-", label="train"); plt.plot(ks, te_acc, "o-", label="test"); plt.plot(ks, cv_acc, "s--", label="5-fold CV (train only)")
plt.xlabel("k"); plt.ylabel("accuracy"); plt.legend(); plt.grid(alpha=.3); plt.title("choosing k"); plt.show()
cand = [(a, k) for a, k in zip(cv_acc, ks) if k >= 5]          # 세 상태라 k가 작으면 동점이 잦다
BEST_K = max(cand)[1]
print("교차검증으로 고른 k =", BEST_K)
""")
md(r"""
- **k = 1**이면 훈련 정확도가 1.0입니다 — 자기 자신이 가장 가까운 이웃이니까요. 이것이 **과대적합**입니다.
- k가 너무 크면 먼 이웃까지 투표에 참여해 경계가 흐려집니다(**과소적합**).
- k는 시험 데이터가 아니라 **훈련 데이터 안의 교차검증**으로 고릅니다. 시험 데이터로 고르면 시험 문제를 보고 공부한 셈이 됩니다.
""")

md(r"""
## 5. 예측 결과 확인 — 정확도와 혼동행렬
""")
py(r"""
model = make_pipeline(StandardScaler(), KNeighborsClassifier(BEST_K)).fit(Xtr, ytr)
pred = model.predict(Xte)
print(f"정확도 = 맞힌 개수 / 전체 = {(pred == yte).sum()} / {len(yte)} = {accuracy_score(yte, pred):.3f}")
print(f"(모두 가장 많은 상태로 찍으면: {yte.value_counts(normalize=True).max():.3f})\n")

cm = confusion_matrix(yte, pred, labels=[0, 1, 2])
ConfusionMatrixDisplay(cm, display_labels=ORDER).plot(cmap="Greens", colorbar=False)
plt.xlabel("Predicted"); plt.ylabel("Actual"); plt.title("confusion matrix"); plt.show()
print(classification_report(yte, pred, target_names=ORDER, digits=3))
""")
md(r"""
### 혼동행렬 읽는 법
- **행 = 실제**, **열 = 예측**입니다. **대각선**이 맞힌 것, 나머지는 틀린 것입니다.
- **재현율(recall)** = 실제 그 상태 중 맞힌 비율 · **정밀도(precision)** = 그 상태라고 예측한 것 중 맞은 비율
- 틀린 칸도 **무게가 다릅니다.**
""")
py(r"""
miss = cm[2, 0]; false_alarm = cm[0, 2]
print(f"실제 Danger → Healthy 로 예측 (가장 위험한 놓침) : {miss}건")
print(f"실제 Healthy → Danger 로 예측 (헛경보)           : {false_alarm}건")
print(f"Danger 재현율 = {cm[2,2]} / {cm[2].sum()} = {cm[2,2]/cm[2].sum():.2f}")
""")
md(r"""
> 자동 급수기 입장에서 **&lsquo;위험인데 건강&rsquo;**은 시드는 식물을 내버려 두는 실수이고, **&lsquo;건강인데 위험&rsquo;**은 한 번 더 살펴보는 실수입니다.
> 정확도가 같아도 앞의 칸이 작은 모델이 더 좋은 모델입니다. **어떤 실수를 줄일지는 사람이 정합니다.**

### 새 화분을 재 보면 — 이웃까지 확인하기
""")
py(r"""
new = pd.DataFrame([{"soil_moisture": 28, "temperature": 24, "log_lux": np.log10(8000), "humidity": 58}])   # ← 값을 바꿔 보세요
print("예측:", ORDER[model.predict(new)[0]], "| 확률(Healthy, Caution, Danger):", np.round(model.predict_proba(new)[0], 2))
knn = model.named_steps["kneighborsclassifier"]; sc = model.named_steps["standardscaler"]
dist, idx = knn.kneighbors(sc.transform(new))
nbrs = Xtr.iloc[idx[0]].copy(); nbrs["distance"] = dist[0].round(3); nbrs["state"] = [ORDER[s] for s in ytr.iloc[idx[0]]]
nbrs["light_lux"] = (10 ** nbrs.log_lux).round(-1); nbrs.drop(columns="log_lux")
""")

md(r"""
> 확률이 비슷하게 갈리면(예: 0.4 / 0.2 / 0.4) 판정을 그대로 믿기 어렵습니다. 이웃 표를 보면 **왜 갈렸는지** 보입니다.
> 자동화 장치에서는 &ldquo;위험 확률이 0.6 이상일 때만 행동&rdquo;처럼 **확률에 기준을 두는 것**도 방법입니다. 위 값을 바꿔 가며 확인해 보세요.
""")
md(r"""
## 6. 최적 조건 분석 — 모델에게 물어보기
&ldquo;다른 변수는 적정 범위 가운데에 두고, **이 변수 하나만** 바꾸면 건강할 확률이 어떻게 변하니?&rdquo;
확률이 기준(70%) 이상인 구간이 **데이터가 알려 준 최적 범위**입니다.
""")
py(r"""
full = make_pipeline(StandardScaler(), KNeighborsClassifier(15)).fit(d[F], d.state)   # 기록 전체로 학습 (k를 키워 매끄럽게)
center = {"soil_moisture": np.mean(RANGE["soil_moisture"]), "temperature": np.mean(RANGE["temperature"]),
          "log_lux": np.mean(np.log10(RANGE["light_lux"])), "humidity": np.mean(RANGE["humidity"])}
TH = 0.70
fig, axes = plt.subplots(1, 4, figsize=(18, 3.6)); found = {}
for ax, f in zip(axes, F):
    grid = np.linspace(d[f].min(), d[f].max(), 80)
    q = pd.DataFrame([{**center, f: g} for g in grid])
    p_h = full.predict_proba(q)[:, 0]
    ok = grid[p_h >= TH]; found[f] = (ok.min(), ok.max()) if len(ok) else (np.nan, np.nan)
    lit = np.log10(RANGE["light_lux"]) if f == "log_lux" else RANGE[f]
    ax.axvspan(*lit, color="green", alpha=.12, label="literature")
    if len(ok): ax.axvspan(ok.min(), ok.max(), ymin=0, ymax=.06, color="orange", label="model")
    ax.plot(grid, p_h, color="#2e7d5b"); ax.axhline(TH, ls="--", color="gray")
    ax.set_title(f); ax.set_ylim(0, 1.02); ax.set_ylabel("P(Healthy)")
axes[0].legend(fontsize=8); plt.tight_layout(); plt.show()

rows = []
for f in F:
    lit = RANGE["light_lux"] if f == "log_lux" else RANGE[f]
    m = tuple(10 ** np.array(found[f])) if f == "log_lux" else found[f]
    rows.append({"variable": "light_lux" if f == "log_lux" else f, "literature": f"{lit[0]:g} ~ {lit[1]:g}", "model (P≥70%)": f"{m[0]:.0f} ~ {m[1]:.0f}"})
pd.DataFrame(rows)
""")
md("두 변수를 **함께** 바꾸면 어떨까요? 건강 확률 지도를 그립니다. 밝을수록 건강할 확률이 높습니다.")
py(r"""
A, B = "soil_moisture", "temperature"         # ← 바꿔 보세요
ga = np.linspace(d[A].min(), d[A].max(), 70); gb = np.linspace(d[B].min(), d[B].max(), 70)
AA, BB = np.meshgrid(ga, gb)
q = pd.DataFrame({**{k: np.full(AA.size, v) for k, v in center.items()}, A: AA.ravel(), B: BB.ravel()})[F]
P = full.predict_proba(q)[:, 0].reshape(AA.shape)
plt.figure(figsize=(7, 5.5)); plt.pcolormesh(AA, BB, P, cmap="Greens", shading="auto"); plt.colorbar(label="P(Healthy)")
plt.contour(AA, BB, P, levels=[TH], colors="orange")
ra, rb = RANGE[A], RANGE[B]
plt.plot([ra[0], ra[1], ra[1], ra[0], ra[0]], [rb[0], rb[0], rb[1], rb[1], rb[0]], "--", color="darkgreen", label="literature")
plt.xlabel(A); plt.ylabel(B); plt.legend(); plt.title("where is it healthy?"); plt.show()
""")
md(r"""
**최적 조건 3차원 지도** — 건강 확률 70% 이상인 격자점만 남겨 3차원으로 그립니다. 이 덩어리가 &lsquo;스마트 화분이 지켜야 할 공간&rsquo;입니다.
""")
py(r"""
g1 = np.linspace(d.temperature.min(), d.temperature.max(), 22)
g2 = np.linspace(d.log_lux.min(), d.log_lux.max(), 22)
g3 = np.linspace(d.soil_moisture.min(), d.soil_moisture.max(), 22)
T, Lx, S = np.meshgrid(g1, g2, g3)
q = pd.DataFrame({"soil_moisture": S.ravel(), "temperature": T.ravel(), "log_lux": Lx.ravel(), "humidity": center["humidity"]})[F]
ph = full.predict_proba(q)[:, 0]; keep = ph >= TH
fig = go.Figure(go.Scatter3d(x=T.ravel()[keep], y=Lx.ravel()[keep], z=S.ravel()[keep], mode="markers",
                             marker=dict(size=3, color=ph[keep], colorscale="Greens", cmin=TH, cmax=1, colorbar=dict(title="P(Healthy)"), opacity=.6)))
fig.add_trace(box_lines(RANGE["temperature"], np.log10(RANGE["light_lux"]), RANGE["soil_moisture"]))
fig.update_layout(height=620, scene=dict(xaxis_title="temperature", yaxis_title="log10(light)", zaxis_title="soil moisture"),
                  title=f"{PLANT}: healthy zone (P ≥ {TH:.0%}), humidity fixed at {center['humidity']:.0f}%")
fig.show()
""")

md(r"""
## 7. 피지컬 컴퓨팅 — 기준을 코드로, 그리고 7일 시뮬레이션
### 7-1. 제어 기준 정하기
모델이 찾은 범위로 스위치 기준을 만듭니다. **켜는 값과 끄는 값을 다르게** 두는 것(히스테리시스)이 핵심입니다.
""")
py(r"""
soil_lo, soil_hi = found["soil_moisture"]
RULE = dict(SOIL_ON=round(soil_lo), SOIL_OFF=round(soil_lo + (soil_hi - soil_lo) * .8),
            TEMP_HI=round(found["temperature"][1]), LUX_LO=int(round(10 ** found["log_lux"][0], -2)),
            HUM_LO=round(found["humidity"][0]), HUM_HI=round(found["humidity"][1]))
RULE
""")
md(r"""
### 7-2. 7일 시뮬레이션 — 타이머 vs 내 규칙
가상의 화분을 10분 간격으로 7일 돌립니다. 매일 같은 시각에 물을 주는 **타이머**와, 센서를 보고 판단하는 **내 규칙**(급수 상태 기계 + 하루 상한)을 비교합니다.
""")
py(r"""
def simulate(mode, rule, days=7, dose=40, pot=900, cap=240, heat=True, seed=1):
    rng = np.random.default_rng(seed); soil = np.mean(RANGE["soil_moisture"]); log = []
    watering, last, today = False, -99, 0
    for t in range(days * 144):
        day, hr = divmod(t, 144); hr /= 6
        if t % 144 == 0: today = 0
        sun = max(0, np.sin(np.pi * (hr - 6) / 13)); lux = 6000 * sun + (350 if 8 <= hr < 17 else 0)
        temp = 22.5 + 3.2 * np.sin(np.pi * (hr - 9) / 12) + (7 * (.5 + .5 * sun) if heat and day in (2, 3) else 0)
        hum = 52 - 10 * np.sin(np.pi * (hr - 9) / 12)
        soil -= (0.055 + 0.012 * max(0, temp - 18) + 0.06 * min(1, lux / 20000)) * (1.25 - hum / 100) * 0.5
        pump = 0
        if mode == "timer" and t % 144 == 54: pump = 2                       # 매일 오전 9시 두 번
        if mode == "rule":
            sensor = soil + rng.normal(0, 1.2)
            if not watering and sensor < rule["SOIL_ON"]: watering = True
            if watering and sensor >= rule["SOIL_OFF"]: watering = False
            if watering and t - last >= 3 and today + dose <= cap: pump, last = 1, t   # 30분 스며들기
        soil = min(95, soil + pump * dose / (pot * .45) * 100); today += pump * dose
        if soil > 88: soil -= (soil - 88) * .5
        log.append((t / 144, soil, temp, pump))
    return pd.DataFrame(log, columns=["day", "soil", "temp", "pump"])

fig, ax = plt.subplots(figsize=(13, 4))
for mode, c in [("timer", "#c8553d"), ("rule", "#2e7d5b")]:
    s = simulate(mode, RULE); ok = s.soil.between(*RANGE["soil_moisture"]).mean()
    ax.plot(s.day, s.soil, color=c, label=f"{mode}: in range {ok:.0%}, water {s.pump.sum()*40} mL")
ax.axhspan(*RANGE["soil_moisture"], color="green", alpha=.1); ax.axhline(RULE["SOIL_ON"], ls=":", color="gray"); ax.axhline(RULE["SOIL_OFF"], ls=":", color="gray")
ax.set_xlabel("day"); ax.set_ylabel("soil moisture %"); ax.legend(); ax.set_title("7 days: timer vs rule (heatwave on day 3-4)"); plt.show()
""")
md(r"""
**생각해 보기** — 모델이 찾은 수분 하한(`RULE["SOIL_ON"]`)이 문헌 값보다 낮으면, 화분은 적정 범위 아래까지 말랐다가 물을 받습니다.
`RULE["SOIL_ON"] = 42`처럼 직접 바꿔 다시 실행해 보세요. **데이터가 말해 준 값과 사람이 아는 값 중 무엇을 믿을지**도 설계자의 몫입니다.
""")
md(r"""
> 웹 실습실 ⑥에는 이 시뮬레이터의 확장판(식물등·팬·가습기, 장마·센서 고장·주말 사건, k-NN 판단 모드)이 있습니다.

### 7-3. 마이크로비트 안에서 k-NN 돌리기
마이크로비트 V2에는 기록 90개 정도는 충분히 들어갑니다. 내장 센서로 잴 수 있는 **수분·온도·조도** 세 변수로 작은 k-NN을 만들어 코드에 그대로 넣습니다.
""")
py(r"""
F3 = ["soil_moisture", "temperature", "log_lux"]
proto = pd.concat([d[d.state == s].sample(30, random_state=5) for s in (0, 1, 2)])   # 상태별로 30개씩
mu3, sd3 = proto[F3].mean().to_numpy(), proto[F3].std(ddof=0).to_numpy()
Z3 = (proto[F3].to_numpy() - mu3) / sd3
check = make_pipeline(StandardScaler(), KNeighborsClassifier(7)).fit(proto[F3], proto.state)
print("90개 기록 모델의 정확도(전체 기록 기준):", round(check.score(d[F3], d.state), 3))

r2 = lambda v: f"{v:.2f}"
data_lines = "\n".join("    " + ", ".join(f"({r2(a)}, {r2(b)}, {r2(c)}, {s})" for (a, b, c), s in zip(Z3[i:i+3], proto.state.to_numpy()[i:i+3])) + ","
                       for i in range(0, len(Z3), 3))
CODE = f'''# smartpot_knn.py — {o["식물"]} 스마트 화분 (코랩에서 생성)
from microbit import *
import math

DRY, WET = 820, 380          # 보정: 마른 흙 / 젖은 흙에서 pin0 값
LUX_PER_LEVEL = 60           # 보정: 조도계 lux ÷ display.read_light_level()
SOIL_ON, SOIL_OFF = {RULE["SOIL_ON"]}, {RULE["SOIL_OFF"]}
TEMP_HI, LUX_LO = {RULE["TEMP_HI"]}, {RULE["LUX_LO"]}
ML_PER_RUN, DAILY_CAP_ML, SOAK = 40, 240, 900

MU = ({", ".join(r2(v) for v in mu3)})
SD = ({", ".join(r2(v) for v in sd3)})
K = 7
DATA = (
{data_lines}
)

def knn(soil, temp, lux):
    z = ((soil - MU[0]) / SD[0], (temp - MU[1]) / SD[1], (math.log(max(lux, 1)) / 2.302585 - MU[2]) / SD[2])
    near = sorted(((a - z[0]) ** 2 + (b - z[1]) ** 2 + (c - z[2]) ** 2, s) for a, b, c, s in DATA)
    votes = [0, 0, 0]
    for d, s in near[:K]:
        votes[s] += 1
    return votes.index(max(votes))

pump, lamp, fan = pin1, pin2, pin8
watering, last_pulse, water_today, tick = False, -SOAK, 0, 0
while True:
    soil = max(0, min(100, (DRY - pin0.read_analog()) * 100 // (DRY - WET)))
    temp = temperature()
    lux = display.read_light_level() * LUX_PER_LEVEL
    state = knn(soil, temp, lux)
    if not watering and state > 0 and soil < SOIL_ON:
        watering = True
    if watering and soil >= SOIL_OFF:
        watering = False
    if watering and tick - last_pulse >= SOAK and water_today + ML_PER_RUN <= DAILY_CAP_ML:
        pump.write_digital(1); sleep(3000); pump.write_digital(0)
        water_today += ML_PER_RUN; last_pulse = tick
    fan.write_digital(1 if temp > TEMP_HI else 0)
    lamp.write_digital(1 if lux < LUX_LO else 0)
    display.show((Image.HAPPY, Image.CONFUSED, Image.SAD)[state])
    print((soil, temp, lux, state))
    tick += 1
    if tick >= 43200:
        tick, water_today = 0, 0
    sleep(2000)
'''
print(CODE)
with open("smartpot_knn.py", "w", encoding="utf-8") as fp: fp.write(CODE)
""")
md(r"""
위 코드를 복사해 **[python.microbit.org](https://python.microbit.org/v/3)** 편집기에 붙여 넣으세요. 아래 셀을 실행하면 파일로 내려받을 수도 있습니다(코랩에서만 동작).
""")
py(r"""
try:
    from google.colab import files
    files.download("smartpot_knn.py")
except ImportError:
    print("코랩이 아닌 환경입니다 — 같은 폴더에 smartpot_knn.py가 저장되었습니다.")
""")
md(r"""
## 탐구 과제
1. `PLANT`를 바꿔 다른 식물로 처음부터 다시 실행하세요. **최적 범위를 문헌과 가장 비슷하게 찾아낸 식물**은 무엇이고, 가장 다른 식물은 무엇인가요? 왜 그럴까요?
2. 4번 실험표에서 설계 **A와 D**의 차이를 한 문장으로 설명하세요.
3. 혼동행렬에서 **Danger → Healthy** 칸을 줄이려면 무엇을 바꿀 수 있을까요? (힌트: k, 변수, 또는 &ldquo;Healthy 확률이 0.8 이상일 때만 건강으로 본다&rdquo; 같은 기준)
4. 마이크로비트에 넣은 90개 모델은 전체 모델보다 정확도가 얼마나 낮은가요? 이 정도면 쓸 만한가요? **정확도와 메모리 사이의 거래**를 설명해 보세요.
5. 이 데이터는 가상입니다. 실제 화분에서 모은 데이터라면 **무엇이 더 어려워질까요?** (센서 보정, 상태 라벨을 누가 어떻게 붙이는가, 계절 변화 …)
""")

nb["cells"] = C
nb["metadata"] = {"colab": {"name": "lesson08_knn_smartpot.ipynb", "provenance": []},
                  "kernelspec": {"name": "python3", "display_name": "Python 3"}, "language_info": {"name": "python"}}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
nbf.write(nb, OUT)
print("saved", OUT, len(C), "cells")
