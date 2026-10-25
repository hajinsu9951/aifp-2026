# -*- coding: utf-8 -*-
"""8회차 스마트 화분 실습 데이터 만들기.

실행: py -3 make_data.py
만드는 파일
  plants_optimal.csv      반려식물 6종의 적정 환경값 (문헌 정리)
  smart_plant_sensor.csv  식물별 센서 기록 + 식물 상태(건강/주의/위험) 1,440행
  plant_data.js           웹 실습실이 읽는 같은 데이터 (file://에서도 열리도록 JS로)

센서 기록은 '가상 데이터'입니다. 적정 범위에서 벗어난 정도로 식물의 스트레스를 계산하고
잡음을 섞어 상태를 매겼습니다. 소음은 일부러 상태 계산에 넣지 않았습니다(가중치 0) —
'관계없는 변수가 k-NN의 거리를 어지럽히는' 현상을 학생이 직접 찾게 하려는 장치입니다.
"""
import csv, json, os
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))

# key, 이름, 영문, 학명, 토양수분(%), 온도(℃), 조도(lux), 습도(%), 소음(dB), 물주기 성향, 근거
PLANTS = [
    dict(key="monstera", name="몬스테라", en="Monstera", sci="Monstera deliciosa",
         soil=(40, 60), temp=(18, 27), lux=(5000, 15000), hum=(50, 70), noise=(30, 60),
         water="겉흙 2~3cm가 마르면 흠뻑", light="밝은 간접광, 직사광선 피함",
         src="Cornell CCE 실내 관엽식물 생육표(광 Medium·수분 Moist/Dry·최저 야간 62~65℉) · 판매처 관리 안내(간접광 약 10,000~20,000 lux)"),
    dict(key="pothos", name="스킨답서스", en="Pothos", sci="Epipremnum aureum",
         soil=(30, 50), temp=(18, 27), lux=(1500, 8000), hum=(40, 70), noise=(30, 60),
         water="흙이 2~3일 마른 뒤 흠뻑", light="반그늘~밝은 간접광, 어두운 곳도 견딤",
         src="Cornell CCE 생육표(Devil's Ivy: 광 Medium·수분 Dry·흙을 2~3일 말린 뒤 급수) · 원예 관리 안내(주 1회 급수)"),
    dict(key="peacelily", name="스파티필룸", en="Peace lily", sci="Spathiphyllum wallisii",
         soil=(55, 75), temp=(20, 28), lux=(1000, 5000), hum=(50, 80), noise=(30, 60),
         water="늘 촉촉하게, 받침에 물 고이지 않게", light="반그늘, 직사광선에 잎이 탐",
         src="원예 관리 안내(18~32℃ 선호·높은 습도·흙이 마르면 급수) · RHS 저광 실내식물 목록"),
    dict(key="snakeplant", name="산세베리아", en="Snake plant", sci="Sansevieria trifasciata",
         soil=(10, 30), temp=(18, 27), lux=(1000, 15000), hum=(30, 50), noise=(30, 60),
         water="흙이 완전히 마르면, 한 달에 1회 정도", light="저광~밝은 빛 모두 견딤",
         src="Cornell CCE 생육표(Snake Plant: 광 Low·수분 Moist/Dry) · 레이디경향 2026.04(15~24℃·습도 30~50%·과습이 최대 실패 원인)"),
    dict(key="basil", name="바질", en="Basil", sci="Ocimum basilicum",
         soil=(50, 70), temp=(18, 25), lux=(15000, 40000), hum=(40, 65), noise=(30, 60),
         water="흙이 늘 촉촉하되 질척이지 않게", light="직사광 6시간 이상(실내는 식물등)",
         src="허브 재배 안내 종합(65~75℉ ≈ 18~24℃·습도 40~60%·직사광 6시간 이상·흙 수분 50~70%)"),
    dict(key="echeveria", name="에케베리아(다육)", en="Echeveria", sci="Echeveria spp.",
         soil=(5, 25), temp=(18, 27), lux=(20000, 50000), hum=(30, 50), noise=(30, 60),
         water="흙이 바싹 마른 뒤 듬뿍, 과습 금지", light="직사광 4~6시간 이상",
         src="다육식물 관리 안내 종합(65~80℉ ≈ 18~27℃·습도 30~50%·직사광 4~6시간·과습이 최대 사망 원인)"),
]

VARS = [  # 열 이름, 식물 사전 키, 물리적 한계, 스트레스 가중치
    ("soil_moisture", "soil", (0, 100), 1.0),
    ("temperature", "temp", (5, 40), 0.8),
    ("light_lux", "lux", (0, 80000), 0.8),
    ("humidity", "hum", (10, 95), 0.5),
    ("noise_db", "noise", (20, 90), 0.0),  # 소음은 식물 상태와 무관 (일부러)
]
STATE = ["건강", "주의", "위험"]
STATE_EN = ["Healthy", "Caution", "Danger"]
N_PER_PLANT = 240


def make(seed=2026):
    rng = np.random.default_rng(seed)
    rows = []
    n_vars = len(VARS) - 1  # 소음을 뺀 생육 변수 4개
    for p in PLANTS:
        # 1) 모든 변수를 적정 범위 안에서 뽑은 뒤
        # 2) 기록마다 0~3개 변수를 범위 밖으로 밀어낸다 (실제 화분은 한두 가지만 어긋나는 일이 많다)
        n_off = rng.choice([0, 1, 2, 3], size=N_PER_PLANT, p=[0.30, 0.35, 0.25, 0.10])
        off = np.zeros((N_PER_PLANT, n_vars), bool)
        for i, m in enumerate(n_off):
            off[i, rng.choice(n_vars, m, replace=False)] = True
        cols = {}
        stress = np.zeros(N_PER_PLANT)
        for j, (col, k, (lo_lim, hi_lim), w) in enumerate(VARS):
            lo, hi = p[k]
            log = col == "light_lux"  # 조도는 배수로 변하므로 로그 눈금에서 다룬다
            a, b = (np.log10(lo), np.log10(hi)) if log else (lo, hi)
            width = b - a
            v = rng.uniform(a, b, N_PER_PLANT)
            if col == "noise_db":
                v = rng.uniform(lo_lim + 5, 80, N_PER_PLANT)  # 소음은 상태와 상관없이 고르게
            else:
                side = rng.choice([-1, 1], N_PER_PLANT)
                dist = rng.uniform(0.05, 1.0, N_PER_PLANT) * width
                out = np.where(side < 0, a - dist, b + dist)
                v = np.where(off[:, j], out, v)
            if log:
                v = np.clip(10 ** v, 100, hi_lim)
                lv = np.log10(v)
            else:
                v = np.clip(v, lo_lim, hi_lim)
                lv = v
            d = np.where(lv < a, (a - lv) / (width / 2), np.where(lv > b, (lv - b) / (width / 2), 0))
            cols[col] = np.round(v, -1) if log else np.round(v, 1)
            stress += w * d
        stress += rng.normal(0, 0.15, N_PER_PLANT)  # 같은 환경이어도 식물마다 반응이 다르다
        state = np.where(stress < 0.30, 0, np.where(stress < 1.0, 1, 2))
        for i in range(N_PER_PLANT):
            rows.append(dict(plant=p["key"], plant_ko=p["name"],
                             **{c: cols[c][i] for c, *_ in VARS},
                             state=int(state[i]), state_ko=STATE[state[i]], state_en=STATE_EN[state[i]]))
    return rows


def main():
    rows = make()
    with open(os.path.join(HERE, "plants_optimal.csv"), "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["plant", "식물", "학명",
                    "soil_min", "soil_max", "temp_min", "temp_max", "lux_min", "lux_max",
                    "hum_min", "hum_max", "noise_min", "noise_max", "물주기", "빛", "근거"])
        for p in PLANTS:
            w.writerow([p["key"], p["name"], p["sci"], *p["soil"], *p["temp"], *p["lux"], *p["hum"], *p["noise"],
                        p["water"], p["light"], p["src"]])
    keys = ["plant", "plant_ko", "soil_moisture", "temperature", "light_lux", "humidity", "noise_db",
            "state", "state_ko", "state_en"]
    with open(os.path.join(HERE, "smart_plant_sensor.csv"), "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=keys)
        w.writeheader()
        for r in rows:
            w.writerow(r)
    # 웹 실습실용: 열 단위로 압축
    packed = {"plants": PLANTS, "data": {}}
    for p in PLANTS:
        rs = [r for r in rows if r["plant"] == p["key"]]
        packed["data"][p["key"]] = [[float(r["soil_moisture"]), float(r["temperature"]), float(r["light_lux"]),
                                     float(r["humidity"]), float(r["noise_db"]), r["state"]] for r in rs]
    with open(os.path.join(HERE, "plant_data.js"), "w", encoding="utf-8") as f:
        f.write("/* make_data.py로 만든 8회차 실습 데이터 — 열 순서: 토양수분, 온도, 조도(lux), 습도, 소음, 상태(0 건강·1 주의·2 위험) */\n")
        f.write("window.PLANT_DATA=" + json.dumps(packed, ensure_ascii=False, separators=(",", ":")) + ";\n")
    for p in PLANTS:
        s = [r["state"] for r in rows if r["plant"] == p["key"]]
        print(p["name"], [s.count(i) for i in range(3)])


if __name__ == "__main__":
    main()
