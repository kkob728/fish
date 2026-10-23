// 랭킹 게시판 · 도움말
import { Panel, Section, Empty, Coin, VarBadge } from '../common.tsx';
import { S } from '../../../state.ts';
import { U, closePanel } from '../../store.tsx';
import { fmtMoney } from '../../dom.ts';
import { FISH, FISH_BY_ID } from '../../../../../shared/data/fish.ts';
import { RARITY, VARIANT, formatKg } from '../../../../../shared/data/core.ts';

function RankTable({ title, rows, fmt }: { title: string; rows: any[]; fmt: (r: any) => any }) {
  return (
    <div>
      <Section>{title}</Section>
      {rows.length ? (
        <table class="rank">
          {rows.map((r, i) => (
            <tr key={i} class={i === 0 ? 'top1' : ''}>
              <td class="n">{i + 1}</td>
              <td>
                <span class="dot" style={{ background: r.color, marginRight: '6px' }} />
                {r.name}
              </td>
              <td style={{ textAlign: 'right' }}>{fmt(r)}</td>
            </tr>
          ))}
        </table>
      ) : (
        <Empty pad="10px">아직 기록이 없어요</Empty>
      )}
    </div>
  );
}

export function RankPanel() {
  const lb = U.leaderboard;
  const recs = Object.entries(S.records)
    .map(([id, r]) => ({ f: FISH_BY_ID[id], r }))
    .filter((x) => x.f)
    .sort((a, b) => RARITY[b.f.rarity].index - RARITY[a.f.rarity].index || b.r.w - a.r.w);
  return (
    <Panel title="물비늘 게시판" icon="trophy" onClose={() => closePanel()}>
      {!lb ? (
        <Empty>게시판을 읽는 중…</Empty>
      ) : (
        <>
          <div class="rank-cols">
            <RankTable title="가장 값진 한 마리" rows={lb.best} fmt={(r) => `${r.fish.v ? VARIANT[r.fish.v].name + ' ' : ''}${FISH_BY_ID[r.fish.sp].name} · ${fmtMoney(r.fish.price)}`} />
            <RankTable title="번 돈" rows={lb.earned} fmt={(r) => <Coin n={r.v} />} />
            <RankTable title="도감 수집" rows={lb.dex} fmt={(r) => `${r.v} / ${FISH.length}`} />
            <RankTable title="잡은 마릿수" rows={lb.catches} fmt={(r) => `${r.v}마리`} />
          </div>
          <Section>{`종류별 섬 최대어 (${recs.length}종)`}</Section>
          {recs.length ? (
            <table class="rank">
              {recs.map(({ f, r }) => (
                <tr key={f.id}>
                  <td style={{ color: RARITY[f.rarity].index ? RARITY[f.rarity].color : 'var(--ink)', fontFamily: 'var(--font-title)' }}>{f.name}</td>
                  <td>
                    {formatKg(r.w)}
                    {r.v && (
                      <span style={{ marginLeft: '6px' }}>
                        <VarBadge v={VARIANT[r.v]} />
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>{r.name}</td>
                </tr>
              ))}
            </table>
          ) : (
            <Empty>아직 아무도 낚지 않았어요</Empty>
          )}
        </>
      )}
    </Panel>
  );
}

const K = ({ k, children }: { k: string; children: string }) => (
  <span>
    <span class="keycap">{k}</span>
    {children}
  </span>
);

export function HelpPanel() {
  return (
    <Panel title="낚시 안내서" icon="help" onClose={() => closePanel()}>
      <div class="help">
        <Section>조작</Section>
        <div class="row">
          <K k="W A S D">이동</K>
          <K k="Shift">달리기</K>
          <K k="Space">점프</K>
          <K k="우클릭 드래그">시점</K>
          <K k="휠">줌</K>
        </div>
        <div class="row">
          <K k="E">채집 · 상점 · 요리</K>
          <K k="G">조리대 깔기/거두기</K>
          <K k="Q">미끼 바꾸기</K>
          <K k="T">가까운 사람과 거래</K>
          <K k="Tab">접속자</K>
        </div>
        <div class="row">
          <K k="I">가방</K>
          <K k="C">제작</K>
          <K k="K">도감</K>
          <K k="L">랭킹</K>
          <K k="Enter">채팅</K>
          <K k="M">소리</K>
        </div>
        <Section>휴대폰에서는</Section>
        <div>화면 왼쪽을 누른 채 밀면 이동, 오른쪽을 밀면 시점 회전, 두 손가락으로 줌. 오른쪽 아래 큰 버튼이 던지기·챔질·감기예요. 채집이나 상점은 위에 뜨는 E 버튼을 누르세요.</div>
        <Section>낚는 법</Section>
        <div>1. 물을 바라보고 왼쪽 버튼을 꾹 눌러 힘을 모았다가 떼요. 초록 고리가 뜨는 곳에 던질 수 있어요.</div>
        <div>2. 찌가 살짝 흔들리는 건 간보는 거예요. 찌가 쑥 들어가고 머리 위에 느낌표가 뜨면 바로 클릭!</div>
        <div>3. 오른쪽 게이지에서 물고기가 위아래로 도망가요. 누르고 있으면 초록 구간이 올라가고, 떼면 내려가요. 초록 구간으로 물고기를 덮고 있으면 오른쪽 막대가 차요. 꽉 채우면 잡혀요.</div>
        <div>4. 희귀한 물고기일수록 빠르고 변덕스러워요. 낚싯대가 좋을수록 초록 구간이 넓어져요.</div>
        <div>5. 파이팅 중에 1~4 키로 도구를 쓸 수 있어요. 뜰채(진행도 +25%), 진정 떡밥(물고기 느려짐), 큰 찌(구간 넓어짐), 질긴 낚싯줄(덜 떨어짐). 종류마다 한 번씩만 써요.</div>
        <div>6. 잡을 때마다 낚시 레벨 경험치가 쌓여요. 레벨이 오를수록 찌 구간이 넓어지고 물고기가 느려져요.</div>
        <Section>요리</Section>
        <div>G 키(또는 조리대 버튼)로 내 앞에 야외 조리대를 깔고, 조리대 앞에서 E로 요리해요. 도구마다 미니게임이 달라요.</div>
        <div>재료를 자유롭게 넣어 보세요. 맞는 조합이면 새 요리를 발견해서 요리 도감에 적혀요. 상점에서 레시피를 사도 돼요.</div>
        <div>요리를 먹으면 낚시가 쉬워져요. 별이 많을수록 효과가 세고, 재료가 많고 클수록 오래가요. 상점에 팔면 물고기보다 훨씬 비싸요.</div>
        <div>조리대 진열대에 가격을 정해 올려 두면 다른 사람이 와서 사 갈 수 있어요.</div>
        <Section>더 큰 물고기를 위해</Section>
        <div>같은 종이라도 개체마다 크기가 달라요. 클수록 품질(소형, 보통, 대형, 대물, 괴물급)과 값이 올라가요.</div>
        <div>아주 드물게 변이(이끼, 달빛, 잿불, 그림자, 유령, 뇌전, 수정, 청자, 성운)가 붙어요. 잡으면 주변 사람들에게도 좋은 효과가 퍼져요.</div>
        <div>미끼는 직접 만들어요. 반짝이는 곳에서 E로 재료를 모으고, 물고기를 손질하면 생선살, 비늘, 정수가 나와요.</div>
        <div>물고기마다 좋아하는 먹이와 나오는 시간, 날씨가 달라요. 도감에서 확인해 보세요.</div>
      </div>
    </Panel>
  );
}
