/**
 * 将棋名人: position-feature opening guidance, GPL-3.0-or-later.
 * This is an explanatory heuristic, NOT an opening-book recognizer or search
 * restriction. Engine candidates remain the authoritative searched suggestions.
 * Coordinates below are relative to the player: file 2 is the original rook file.
 */
import {isInCheck,moveFromUSI} from './shogi.js';

export const strategyData=Object.freeze({
 "auto": {
  "name": "AIにおまかせ",
  "text": "相手の配置が見えるまでは基本の駒組みを参考にし、局面ごとにAI候補を比較します。",
  "moves": [
   "7g7f",
   "2g2f"
  ],
  "category": "自動・基本",
  "family": "auto",
  "conditions": "戦型を固定せず研究したいとき。",
  "caution": "自動ガイドは配置の特徴による方針であり、最善戦法の判定ではありません。"
 },
 "ibisha": {
  "name": "居飛車",
  "text": "飛車を元の側に据え、飛車先の歩と右銀の活用を考えます。",
  "moves": [
   "2g2f",
   "2f2e",
   "7g7f"
  ],
  "category": "自動・基本",
  "family": "ibisha",
  "conditions": "相居飛車・対振り飛車の両方で使う基本方針。",
  "caution": "相手の戦型によって囲いと攻め方を変える必要があります。"
 },
 "yagura": {
  "name": "矢倉",
  "text": "角道を開けて銀を上げ、金銀を連結しながら玉を守る構想です。",
  "moves": [
   "7g7f",
   "7i6h",
   "6g6f",
   "6h7g",
   "6i7h"
  ],
  "category": "矢倉・急戦矢倉",
  "family": "yagura",
  "conditions": "主に相居飛車。相手の急戦を確認しながら組みます。",
  "caution": "囲いの完成を急ぐと、相手の速攻に対応が遅れることがあります。"
 },
 "yagura37": {
  "name": "矢倉３七銀戦法",
  "text": "右銀を３七へ展開し、桂と協力して攻めの形を整える矢倉の構想です。",
  "moves": [],
  "category": "矢倉・急戦矢倉",
  "family": "yagura",
  "conditions": "相矢倉で右側から攻めを作れる配置。",
  "caution": "相手の急戦や角筋を確認してから銀を進めます。"
 },
 "waki": {
  "name": "脇システム",
  "text": "相矢倉で角を向かい合わせ、角交換を含む攻防を考える作戦です。",
  "moves": [],
  "category": "矢倉・急戦矢倉",
  "family": "yagura",
  "conditions": "相手も矢倉を志向し、角の配置が対応する局面。",
  "caution": "角交換の前後で玉の安全と打ち込みを読みます。"
 },
 "morishita": {
  "name": "森下システム",
  "text": "攻めを急がず自陣を整え、相手の形を見て右銀の運用を決めます。",
  "moves": [],
  "category": "矢倉・急戦矢倉",
  "family": "yagura",
  "conditions": "じっくり組み合う相矢倉。",
  "caution": "雀刺しなど端を狙う構想への備えが必要です。"
 },
 "fujii-yagura": {
  "name": "藤井流早囲い矢倉",
  "text": "矢倉への囲いを効率よく進め、角の活用と組み合わせる構想です。",
  "moves": [],
  "category": "矢倉・急戦矢倉",
  "family": "yagura",
  "conditions": "相手の早い仕掛けを受けられる相矢倉の配置。",
  "caution": "通常の矢倉と手順が異なるため、途中の弱点を確認します。"
 },
 "suzume": {
  "name": "矢倉・雀刺し",
  "text": "飛車・角・桂・香の力を端に集め、矢倉の側面を狙います。",
  "moves": [],
  "category": "矢倉・急戦矢倉",
  "family": "yagura",
  "conditions": "相手玉が矢倉に入り、端に攻撃目標ができたとき。",
  "caution": "端に戦力を偏らせる間の中央からの反撃に注意します。"
 },
 "yagura46": {
  "name": "矢倉４六銀・３七桂型",
  "text": "銀と桂を前線に配置し、右側の歩と連動して仕掛けを探します。",
  "moves": [],
  "category": "矢倉・急戦矢倉",
  "family": "yagura",
  "conditions": "相矢倉で右桂と右銀を活用できる局面。",
  "caution": "相手の４筋反発や、仕掛け後の銀の退路に注意します。"
 },
 "yonenaga": {
  "name": "米長流急戦矢倉",
  "text": "右銀を積極的に使い、相手が囲い切る前の中央での戦いを考えます。",
  "moves": [],
  "category": "矢倉・急戦矢倉",
  "family": "yagura",
  "conditions": "矢倉模様に対して急戦を選ぶ局面。",
  "caution": "王を薄くしたまま攻め切ろうとせず、反撃を読みます。"
 },
 "yagura-naka": {
  "name": "矢倉中飛車",
  "text": "相手の矢倉模様に対し飛車を中央に置き、５筋から圧力をかけます。",
  "moves": [],
  "category": "矢倉・急戦矢倉",
  "family": "nakabisha",
  "conditions": "相手が矢倉を目指し、中央で戦える局面。",
  "caution": "中央の歩交換と角筋の関係を十分に確認します。"
 },
 "yagura5": {
  "name": "矢倉５筋交換型急戦",
  "text": "５筋の歩交換をきっかけに、相手の駒組みへ働きかけます。",
  "moves": [],
  "category": "矢倉・急戦矢倉",
  "family": "yagura",
  "conditions": "矢倉模様で５筋の交換が成立する局面。",
  "caution": "歩を交換できるかどうかは銀・角の位置で変わります。"
 },
 "kakugawari": {
  "name": "角換わり",
  "text": "早期の角交換を前提に、銀の進出と角の打ち込みを両立させます。",
  "moves": [
   "7g7f",
   "2g2f"
  ],
  "category": "角換わり",
  "family": "ibisha",
  "conditions": "双方が角交換を許す相居飛車。",
  "caution": "角を持ち合うと、自陣の空きマスが打ち込みの標的になります。"
 },
 "kaku-bogin": {
  "name": "角換わり棒銀",
  "text": "銀を飛車先へまっすぐ繰り出し、数の力で突破を狙います。",
  "moves": [],
  "category": "角換わり",
  "family": "ibisha",
  "conditions": "角換わりで飛車先の銀が働く配置。",
  "caution": "銀が進み過ぎて取り残されないよう、退路も考えます。"
 },
 "kaku-hayaguri": {
  "name": "角換わり早繰り銀",
  "text": "銀を斜めに素早く進め、中央寄りから攻めのきっかけを作ります。",
  "moves": [],
  "category": "角換わり",
  "family": "ibisha",
  "conditions": "角換わりで相手の駒組みに先行できる局面。",
  "caution": "桂や角の打ち込みによる銀への攻撃に注意します。"
 },
 "kaku-koshikake": {
  "name": "角換わり腰掛け銀",
  "text": "中央の歩の上に銀を据え、桂や歩との連動を準備します。",
  "moves": [],
  "category": "角換わり",
  "family": "ibisha",
  "conditions": "角換わりで持久的な駒組みができる局面。",
  "caution": "似た配置でも一手の違いで仕掛けの成否が変わります。"
 },
 "kaku45": {
  "name": "角換わり４五桂急戦",
  "text": "桂を早めに跳ね、角を持ち合う局面の急所を攻めます。",
  "moves": [],
  "category": "角換わり",
  "family": "ibisha",
  "conditions": "桂跳ねが成立する特定の角換わり局面。",
  "caution": "成立条件が厳しいため、定型手として自動では指しません。"
 },
 "kaku-migigyoku": {
  "name": "角換わり右玉",
  "text": "飛車と同じ側へ玉を寄せ、広さと駒の連結を重視します。",
  "moves": [],
  "category": "角換わり",
  "family": "ibisha",
  "conditions": "角換わりで右側に玉の退路を確保できる局面。",
  "caution": "飛車と玉が近くなるため、飛車先の戦い方に注意します。"
 },
 "itteson": {
  "name": "一手損角換わり",
  "text": "自ら角交換し、手順の違いを利用して相手の配置を見ます。",
  "moves": [],
  "category": "角換わり",
  "family": "ibisha",
  "conditions": "通常は後手番で選ばれる角換わりの構想。",
  "caution": "手損を含む作戦です。先後を逆にしても同じ定跡になるとは限りません。"
 },
 "aigakari": {
  "name": "相掛かり",
  "text": "双方が飛車先の歩を進める展開で、飛車の位置と守りの効率を考えます。",
  "moves": [
   "2g2f",
   "2f2e",
   "6i7h"
  ],
  "category": "相掛かり",
  "family": "ibisha",
  "conditions": "相手も飛車先の歩を進める相居飛車。",
  "caution": "飛車先交換を許す前に、金や銀による受けを確認します。"
 },
 "ai-bogin": {
  "name": "相掛かり引き飛車棒銀",
  "text": "飛車を深く引き、右銀を前へ出して飛車先の突破を目指します。",
  "moves": [],
  "category": "相掛かり",
  "family": "ibisha",
  "conditions": "飛車先の歩交換後に引き飛車を選ぶ相掛かり。",
  "caution": "相手の浮き飛車や角の活用による受けを読みます。"
 },
 "ai-hayaguri": {
  "name": "相掛かり早繰り銀",
  "text": "右銀の素早い進出で、相手の駒組みへ圧力をかけます。",
  "moves": [],
  "category": "相掛かり",
  "family": "ibisha",
  "conditions": "相掛かりで銀を前へ進める余裕がある局面。",
  "caution": "相手の飛車の横利きと桂の跳ね出しに注意します。"
 },
 "hineribisha": {
  "name": "ひねり飛車",
  "text": "相掛かりから飛車を横へ転回し、左側で主導権を目指します。",
  "moves": [],
  "category": "相掛かり",
  "family": "other-ranging",
  "conditions": "飛車先交換後、転回の経路と玉の安全を確保できる局面。",
  "caution": "初手から飛車を振る戦法ではなく、相掛かりからの組み替えです。"
 },
 "tsukada": {
  "name": "塚田スペシャル",
  "text": "相掛かりで浮き飛車を働かせ、歩の活用によって主導権を狙います。",
  "moves": [],
  "category": "相掛かり",
  "family": "ibisha",
  "conditions": "対応する相掛かりの特定局面。",
  "caution": "相手の応手ごとの分岐が重要なため、定型の自動手順は表示しません。"
 },
 "yokofudori": {
  "name": "横歩取り",
  "text": "飛車先交換後に横の歩を取り、飛角の活動を重視します。",
  "moves": [],
  "category": "横歩取り",
  "family": "ibisha",
  "conditions": "双方が角道と飛車先を開ける展開。",
  "caution": "大駒が早く接触するため、王手や両取りを深く読む必要があります。"
 },
 "aono": {
  "name": "横歩取り青野流",
  "text": "飛車の活動を保ち、右桂を使って積極的に働きかけます。",
  "moves": [],
  "category": "横歩取り",
  "family": "ibisha",
  "conditions": "通常は先手が横歩を取ったあとの局面。",
  "caution": "先後や飛車の位置により成立する攻め筋が変わります。"
 },
 "yuki": {
  "name": "横歩取り勇気流",
  "text": "飛車をすぐ引く手に代えて玉の位置を整え、手の効率を考えます。",
  "moves": [],
  "category": "横歩取り",
  "family": "ibisha",
  "conditions": "先手横歩取りで対応する６八玉型の局面。",
  "caution": "青野流と似ていても手順の違いが重要です。"
 },
 "yoko85": {
  "name": "横歩取り８五飛型",
  "text": "浮き飛車の横利きを利用し、桂や角と連動して戦います。",
  "moves": [],
  "category": "横歩取り",
  "family": "ibisha",
  "conditions": "主に後手が８五飛を選ぶ横歩取り。",
  "caution": "飛車を目標にする手や、角交換からの打ち込みに注意します。"
 },
 "yoko45": {
  "name": "横歩取り４五角戦法",
  "text": "角交換と歩の叩きを組み合わせ、角の打ち込みで急戦を狙います。",
  "moves": [],
  "category": "横歩取り",
  "family": "ibisha",
  "conditions": "主に後手側の特定の横歩取り分岐。",
  "caution": "受け方を含む長い読みが必要なため、単発の角打ちは案内しません。"
 },
 "ai-yoko": {
  "name": "相横歩取り",
  "text": "双方が横歩を取る展開で、飛車交換を含む激しい攻防を考えます。",
  "moves": [],
  "category": "横歩取り",
  "family": "ibisha",
  "conditions": "双方が横歩取りを受け入れた局面。",
  "caution": "大駒交換後の王手と打ち込みを優先して確認します。"
 },
 "ganki": {
  "name": "雁木戦法",
  "text": "角道を止めた配置を土台に、二枚の銀と金の連結を整えます。",
  "moves": [
   "7g7f",
   "6g6f",
   "7i6h",
   "3i4h"
  ],
  "category": "対振り飛車・居飛車の構想",
  "family": "ibisha",
  "conditions": "主に相居飛車で、矢倉以外の組み方を選びたいとき。",
  "caution": "相手の急戦と角交換の可否で駒組みを調整します。"
 },
 "migishiken": {
  "name": "右四間飛車",
  "text": "飛車を４筋に据え、銀・桂・歩の力を集中して仕掛けます。",
  "moves": [],
  "category": "対振り飛車・居飛車の構想",
  "family": "ibisha",
  "conditions": "相手が角道を止めた矢倉・雁木・振り飛車など。",
  "caution": "飛車が４筋に移っても、通常の振り飛車とは分類を分けます。"
 },
 "anti-bogin": {
  "name": "対振り飛車棒銀",
  "text": "飛車先の銀を前進させ、振り飛車側の守りを崩す急戦です。",
  "moves": [],
  "category": "対振り飛車・居飛車の構想",
  "family": "ibisha",
  "conditions": "相手が振り飛車で、銀の進出を妨げる手を確認できる局面。",
  "caution": "銀交換だけを急がず、交換後の攻めが続くか確認します。"
 },
 "naname-bogin": {
  "name": "斜め棒銀",
  "text": "銀を斜めに繰り出して、角頭や中央寄りの地点に圧力をかけます。",
  "moves": [],
  "category": "対振り飛車・居飛車の構想",
  "family": "ibisha",
  "conditions": "主に対四間飛車の急戦。",
  "caution": "相手の飛車の位置が変わると同じ攻めが通用しないことがあります。"
 },
 "saginomiya": {
  "name": "鷺宮定跡",
  "text": "対四間飛車で角頭への圧力を利用し、飛車の位置を工夫して仕掛けます。",
  "moves": [],
  "category": "対振り飛車・居飛車の構想",
  "family": "ibisha",
  "conditions": "対応する四間飛車の駒組みに対する急戦。",
  "caution": "相手の玉・銀・香の位置ごとに手順を確認する必要があります。"
 },
 "5kurai": {
  "name": "５筋位取り",
  "text": "中央の歩を伸ばして銀を支え、厚みを生かす方針です。",
  "moves": [],
  "category": "対振り飛車・居飛車の構想",
  "family": "ibisha",
  "conditions": "主に対振り飛車で中央の位を維持できる局面。",
  "caution": "位を支えられない場合は攻めの目標にされることがあります。"
 },
 "gyokutou-kurai": {
  "name": "玉頭位取り",
  "text": "相手玉側の位を取り、銀や歩の厚みで圧力をかけます。",
  "moves": [],
  "category": "対振り飛車・居飛車の構想",
  "family": "ibisha",
  "conditions": "相手の囲いと攻めの方向が見えてきた対抗形。",
  "caution": "手数を使う構想なので、相手の速い仕掛けに注意します。"
 },
 "chosoku": {
  "name": "超速３七銀",
  "text": "右銀を素早く進め、中央の歩を突いた中飛車に対抗します。",
  "moves": [],
  "category": "対振り飛車・居飛車の構想",
  "family": "ibisha",
  "conditions": "ゴキゲン中飛車など角道を止めない中飛車への対策。",
  "caution": "相手の銀対抗や角交換の変化で、次の手が変わります。"
 },
 "elmo-kyusen": {
  "name": "エルモ囲い急戦",
  "text": "少ない手数の囲いと銀の進出を組み合わせ、急戦の効率を重視します。",
  "moves": [],
  "category": "対振り飛車・居飛車の構想",
  "family": "ibisha",
  "conditions": "主に対振り飛車の急戦。",
  "caution": "囲いの形だけで安全とは判断せず、角の打ち込みも確認します。"
 },
 "shiken": {
  "name": "四間飛車",
  "text": "角道を止め、飛車を６筋へ振って玉を反対側へ囲う基本形です。",
  "moves": [
   "7g7f",
   "6g6f",
   "2h6h",
   "3i4h"
  ],
  "category": "四間飛車",
  "family": "shiken",
  "conditions": "相手の急戦に備えつつ振り飛車を組みたいとき。",
  "caution": "角道を開くタイミングは相手の飛車先と銀の配置で変わります。"
 },
 "fujii-system": {
  "name": "藤井システム",
  "text": "相手の穴熊への駒組みを見て、囲いの完成前に仕掛けを考えます。",
  "moves": [],
  "category": "四間飛車",
  "family": "shiken",
  "conditions": "主に四間飛車から相手の居飛車穴熊を牽制する構想。",
  "caution": "玉の囲いを後回しにする局面があるため、急戦への備えが重要です。"
 },
 "tateishi": {
  "name": "立石流四間飛車",
  "text": "浮き飛車や桂の活用を軸に、四間飛車から積極的な駒組みを考えます。",
  "moves": [],
  "category": "四間飛車",
  "family": "shiken",
  "conditions": "相手の攻めを受けながら浮き飛車の形を作れる局面。",
  "caution": "飛車先交換や角の狙いによって手順を調整します。"
 },
 "kakukokan-shiken": {
  "name": "角交換四間飛車",
  "text": "角交換を避けずに飛車を振り、持ち角の打ち込みを生かします。",
  "moves": [
   "7g7f",
   "2h6h"
  ],
  "category": "四間飛車",
  "family": "shiken",
  "conditions": "角道を止めずに四間飛車を志向する展開。",
  "caution": "持ち角の打ち込みに備え、囲いの途中の隙を確認します。"
 },
 "four-three": {
  "name": "４→３戦法",
  "text": "四間飛車の形から三間へ飛車を振り直し、攻めの方向を変えます。",
  "moves": [],
  "category": "四間飛車",
  "family": "sanken",
  "conditions": "対応する角交換振り飛車の配置。",
  "caution": "飛車を振り直す手損を補う狙いがあるか確認します。"
 },
 "sanken": {
  "name": "三間飛車",
  "text": "飛車を７筋へ振り、角と左銀を連携させる基本方針です。",
  "moves": [
   "7g7f",
   "6g6f",
   "2h7h",
   "3i4h"
  ],
  "category": "三間飛車・石田流",
  "family": "sanken",
  "conditions": "振り飛車の中でも左側で駒を使いたいとき。",
  "caution": "急戦と持久戦で左銀の使い方を変える必要があります。"
 },
 "ishida": {
  "name": "石田流三間飛車",
  "text": "７筋の位と浮き飛車を軸に、桂や角の活動を重視します。",
  "moves": [
   "7g7f",
   "7f7e",
   "2h7h"
  ],
  "category": "三間飛車・石田流",
  "family": "sanken",
  "conditions": "７筋の位を支えながら三間飛車に組める局面。",
  "caution": "序盤の角交換からの飛車打ち込みには十分注意します。"
 },
 "hayaishida": {
  "name": "早石田",
  "text": "早い７筋の歩進出から、三間飛車の急戦を狙います。",
  "moves": [],
  "category": "三間飛車・石田流",
  "family": "sanken",
  "conditions": "相手の角道と飛車先の手順が対応する局面。",
  "caution": "急戦の成否が手順に強く依存するため、定型着手は案内しません。"
 },
 "masuda-ishida": {
  "name": "升田式石田流",
  "text": "角交換を含む展開で石田流の形を目指し、軽い駒の働きを重視します。",
  "moves": [],
  "category": "三間飛車・石田流",
  "family": "sanken",
  "conditions": "角交換後に石田流の配置を作れる局面。",
  "caution": "通常の角道を止めた石田流と同じ手順では組めません。"
 },
 "tomahawk": {
  "name": "トマホーク",
  "text": "三間飛車から端の歩や桂を活用し、穴熊を目指す相手に働きかけます。",
  "moves": [],
  "category": "三間飛車・石田流",
  "family": "sanken",
  "conditions": "主に三間飛車対居飛車穴熊の対応局面。",
  "caution": "相手の穴熊完成時期と、端への攻めが間に合うかを読みます。"
 },
 "nakabisha": {
  "name": "中飛車",
  "text": "飛車を５筋へ据え、中央の歩と銀で主導権を目指します。",
  "moves": [
   "5g5f",
   "5f5e",
   "2h5h",
   "7g7f"
  ],
  "category": "中飛車",
  "family": "nakabisha",
  "conditions": "中央を軸にした振り飛車を選びたいとき。",
  "caution": "中央の歩を支える駒と、玉を囲う側の安全を確認します。"
 },
 "gokigen": {
  "name": "ゴキゲン中飛車",
  "text": "角道を止めずに中央へ飛車を置き、相手の形に柔軟に対応します。",
  "moves": [],
  "category": "中飛車",
  "family": "nakabisha",
  "conditions": "主に後手側で用いられる積極的な中飛車。",
  "caution": "超速銀や超急戦など、居飛車側の対策ごとに手順が変わります。"
 },
 "sente-naka": {
  "name": "先手中飛車",
  "text": "初手から中央の歩を進め、先手の一手を生かして５筋の主導権を目指します。",
  "moves": [
   "5g5f",
   "2h5h"
  ],
  "category": "中飛車",
  "family": "nakabisha",
  "conditions": "先手番で５筋を軸に組みたいとき。",
  "caution": "後手番では同じ名前の定跡とはせず、中飛車の構想として扱います。"
 },
 "tsunogin": {
  "name": "ツノ銀中飛車",
  "text": "中央の両側に銀を配置し、受けと反撃のバランスを取ります。",
  "moves": [],
  "category": "中飛車",
  "family": "nakabisha",
  "conditions": "角道を止めた中飛車で、二枚の銀を中央に集める展開。",
  "caution": "攻めを受ける形になりやすいため、反撃の時機を見ます。"
 },
 "naka-left-anaguma": {
  "name": "中飛車左穴熊",
  "text": "中飛車と左側の穴熊を組み合わせ、相手の戦型に応じた囲いを考えます。",
  "moves": [],
  "category": "中飛車",
  "family": "nakabisha",
  "conditions": "相振り飛車への対応など、左側へ囲える中飛車の局面。",
  "caution": "通常の右囲い中飛車と違い、飛車と玉の連携を再確認します。"
 },
 "mukaibisha": {
  "name": "向かい飛車",
  "text": "飛車を８筋へ振り、相手の居飛車と向かい合って戦います。",
  "moves": [],
  "category": "向かい飛車",
  "family": "mukaibisha",
  "conditions": "相手の飛車先を受けながら同じ筋で反撃できる局面。",
  "caution": "飛車交換の後に自陣へ打ち込まれる隙を確認します。"
 },
 "direct-mukai": {
  "name": "ダイレクト向かい飛車",
  "text": "早期の角交換から、直接向かい飛車の配置を目指します。",
  "moves": [],
  "category": "向かい飛車",
  "family": "mukaibisha",
  "conditions": "対応する角交換直後の局面。",
  "caution": "角の打ち込みを巡る細かい分岐があるため、固定手順は案内しません。"
 },
 "sakata": {
  "name": "阪田流向かい飛車",
  "text": "角交換後に金を活用し、向かい飛車側から積極的に戦います。",
  "moves": [],
  "category": "向かい飛車",
  "family": "mukaibisha",
  "conditions": "主に後手側の角交換振り飛車で対応する配置。",
  "caution": "金が前へ出ると玉の守りが薄くなるため、攻守の配分に注意します。"
 },
 "aifuribisha": {
  "name": "相振り飛車",
  "text": "双方が飛車を振る展開で、相手の囲いに応じて攻撃方向を選びます。",
  "moves": [],
  "category": "相振り・転換・独創的戦法",
  "family": "other-ranging",
  "conditions": "相手も振り飛車にした局面。",
  "caution": "対居飛車の囲いをそのまま使うと、正面からの攻めに弱い場合があります。"
 },
 "yodo": {
  "name": "陽動振り飛車",
  "text": "居飛車のような駒組みを見せてから飛車を振り、配置の違いを生かします。",
  "moves": [],
  "category": "相振り・転換・独創的戦法",
  "family": "other-ranging",
  "conditions": "相手の駒組みを見て戦型を転換できる局面。",
  "caution": "飛車を振る経路と手数の損得を確認します。"
 },
 "sode": {
  "name": "袖飛車",
  "text": "飛車を３筋などへ寄せ、銀や歩と組み合わせて局所的な攻めを狙います。",
  "moves": [],
  "category": "相振り・転換・独創的戦法",
  "family": "other-ranging",
  "conditions": "相手の銀や角の位置に攻撃目標がある局面。",
  "caution": "飛車を寄せるだけで有利になるわけではなく、標的と連携が必要です。"
 },
 "ureshino": {
  "name": "嬉野流",
  "text": "早い銀上がりと引き角を軸に、通常とは異なる駒組みを考えます。",
  "moves": [
   "7i6h"
  ],
  "category": "相振り・転換・独創的戦法",
  "family": "ibisha",
  "conditions": "初手から独創的な銀・角の配置を試す研究。",
  "caution": "速攻への受けと玉の囲いを同時に考えます。"
 },
 "sujichigai": {
  "name": "筋違い角",
  "text": "早い角交換から通常と異なる筋へ角を打ち、歩得や駒の働きを考えます。",
  "moves": [],
  "category": "相振り・転換・独創的戦法",
  "family": "ibisha",
  "conditions": "角交換と角打ちが成立する特定局面。",
  "caution": "角打ちの位置を固定せず、逃げ場と相手の反撃を読みます。"
 },
 "onigoroshi": {
  "name": "鬼殺し",
  "text": "桂を早く進め、相手の守りが整う前の攻撃を狙う奇襲です。",
  "moves": [],
  "category": "相振り・転換・独創的戦法",
  "family": "sanken",
  "conditions": "相手の駒組みが対応する早い局面。",
  "caution": "対策を受けると攻めが切れる場合があります。必勝戦法ではありません。"
 },
 "kakutoufu": {
  "name": "角頭歩戦法",
  "text": "角の前の歩を早めに進め、通常と異なる角筋や飛車の展開を探ります。",
  "moves": [],
  "category": "相振り・転換・独創的戦法",
  "family": "other-ranging",
  "conditions": "角頭歩を突く手が成立する初期段階。",
  "caution": "角頭が攻撃目標になる危険もあり、定型の自動手順は案内しません。"
 }
});

/** 24 separate castle goals; these are not 24 extra opening engines. */
export const castles=Object.freeze([
 {
  "id": "funa",
  "name": "舟囲い",
  "text": "少ない手数で玉を左へ寄せ、対振り飛車の急戦に備える囲いです。",
  "caution": "横からの攻撃や角の打ち込みに注意します。"
 },
 {
  "id": "mino",
  "name": "美濃囲い",
  "text": "金銀を連結し、玉を飛車と反対側へ収める振り飛車の基本的な囲いです。",
  "caution": "端や玉頭からの攻めに合わせて補強を考えます。"
 },
 {
  "id": "katamino",
  "name": "片美濃",
  "text": "美濃囲いの一部を省き、少ない手数で玉を収める形です。",
  "caution": "省いた金の守備がない分、寄せへの耐久力を過信しません。"
 },
 {
  "id": "takamino",
  "name": "高美濃",
  "text": "美濃から金を前へ上げ、上部の守りや反撃を意識する形です。",
  "caution": "組み替え途中の金銀の離れに注意します。"
 },
 {
  "id": "ginkan",
  "name": "銀冠",
  "text": "玉頭に銀を配置し、上部の厚みと逃げ道を考える囲いです。",
  "caution": "銀を上げる瞬間の隙と端の歩の形を確認します。"
 },
 {
  "id": "diamond-mino",
  "name": "ダイヤモンド美濃",
  "text": "美濃を土台に金銀を集め、連結を厚くする形です。",
  "caution": "守備駒を増やしても、桂や歩の位置で弱点は変わります。"
 },
 {
  "id": "hidari-mino",
  "name": "左美濃",
  "text": "居飛車側で左に玉を囲い、美濃の連結を取り入れる形です。",
  "caution": "相手の角筋が玉に向いていないか確認します。"
 },
 {
  "id": "tenshukaku",
  "name": "天守閣美濃",
  "text": "玉を上段へ進める左美濃系の形で、広さと厚みを考えます。",
  "caution": "玉が高いため、上部や端への攻撃を確認します。"
 },
 {
  "id": "kin-yagura",
  "name": "金矢倉",
  "text": "玉を金銀で囲い、上からの攻めに備える矢倉の代表的な形です。",
  "caution": "端や横からの攻め、金をはがす手を確認します。"
 },
 {
  "id": "gin-yagura",
  "name": "銀矢倉",
  "text": "通常の金矢倉と金銀の役割を変え、銀の連結を使う形です。",
  "caution": "斜めと横の利きの違いを把握して守ります。"
 },
 {
  "id": "kata-yagura",
  "name": "片矢倉",
  "text": "玉を深く囲い過ぎず、角交換や周辺の連結を意識する矢倉系の形です。",
  "caution": "金矢倉と同じ受けが成立するとは限りません。"
 },
 {
  "id": "sou-yagura",
  "name": "総矢倉",
  "text": "金銀を矢倉側へ集め、守りの厚みを重視する形です。",
  "caution": "守備に手数と駒を使う間の攻撃力不足に注意します。"
 },
 {
  "id": "kikusui",
  "name": "菊水矢倉",
  "text": "玉を低い位置へ収める矢倉系の囲いです。",
  "caution": "低い玉の逃げ道と、端・下段からの攻めに注意します。"
 },
 {
  "id": "yagura-anaguma",
  "name": "矢倉穴熊",
  "text": "矢倉から穴熊へ組み替え、玉をさらに奥へ収める形です。",
  "caution": "完成前の隙を狙われないか確認します。"
 },
 {
  "id": "ibisha-anaguma",
  "name": "居飛車穴熊",
  "text": "居飛車側で左端に玉を囲い、金銀を周囲へ集める形です。",
  "caution": "囲う手数の間に相手の仕掛けが来ないか確認します。"
 },
 {
  "id": "furibisha-anaguma",
  "name": "振り飛車穴熊",
  "text": "飛車を振った側と反対の端へ玉を囲う形です。",
  "caution": "端攻めと金銀の連結を確認します。"
 },
 {
  "id": "matsuo-anaguma",
  "name": "松尾流穴熊",
  "text": "穴熊の周囲に金銀を効率よく集め、連結を深める構想です。",
  "caution": "理想形にこだわって相手の攻めへの対応を遅らせないようにします。"
 },
 {
  "id": "ginkan-anaguma",
  "name": "銀冠穴熊",
  "text": "銀冠の厚みを残しながら玉を穴熊へ移す形です。",
  "caution": "組み替えに必要な手数と、途中の弱点を確認します。"
 },
 {
  "id": "millennium",
  "name": "ミレニアム",
  "text": "玉を角の主な筋から外し、金銀で囲う構想です。",
  "caution": "角筋を外しただけで安全とは判断せず、端や上部を確認します。"
 },
 {
  "id": "elmo",
  "name": "エルモ囲い",
  "text": "対振り飛車の急戦で、金銀の連結と少ない囲い手数を重視する形です。",
  "caution": "角の打ち込みや玉の退路を確認します。"
 },
 {
  "id": "kinmusou",
  "name": "金無双",
  "text": "二枚の金を横に並べ、正面からの攻めに備える囲いです。",
  "caution": "相振り飛車では端攻めや壁銀の形にも注意します。"
 },
 {
  "id": "nakazumai",
  "name": "中住まい",
  "text": "玉を中央の一段上へ移し、左右の働きとバランスを保つ形です。",
  "caution": "玉を金銀で深く包む囲いではないため、王手の筋を確認します。"
 },
 {
  "id": "nakahara",
  "name": "中原囲い",
  "text": "横歩取りなどで使われる、金銀と玉の配置をコンパクトにまとめる形です。",
  "caution": "飛車・角の打ち込みと、玉の逃げ道を確認します。"
 },
 {
  "id": "kani",
  "name": "カニ囲い",
  "text": "金銀で玉の周囲を手早く固める基本形です。",
  "caution": "完成形と決めつけず、その後の囲いへの発展も考えます。"
 }
]);
const RANGING={5:'nakabisha',6:'shiken',7:'sanken',8:'mukaibisha'};
const NAMES={...Object.fromEntries(Object.entries(strategyData).map(([k,v])=>[k,v.name])),mukaibisha:'向かい飛車'};
const antiRangingMoves=['2g2f','2f2e','7g7f','3i4h'];
const relative=(index,side)=>side===1?80-index:index;
const rotateUSI=usi=>usi.replace(/([1-9])([a-i])/g,(_,f,r)=>`${10-Number(f)}${String.fromCharCode(202-r.charCodeAt(0))}`);
const pieceAt=(state,file,rank,side)=>state.board[side===1?80-((rank-1)*9+9-file):(rank-1)*9+9-file];
function rookProfile(state,side){
 const rooks=[];
 for(let i=0;i<81;i++){const p=state.board[i];if(p?.owner===side&&(p.type==='R'||p.type==='+R')){const n=relative(i,side);rooks.push({type:p.type,file:9-n%9,rank:1+Math.floor(n/9)});}}
 // Captured extra rooks and promoted/advanced rooks cannot safely identify an opening.
 if(rooks.length!==1||rooks[0].type!== 'R'||rooks[0].rank<6)return {key:null,name:'飛車の活動中・戦法未確定',ranging:false,rook:rooks[0]||null};
 const rook=rooks[0],key=RANGING[rook.file]||(rook.file===2?'ibisha':null);
 return {key,name:key?`${NAMES[key]}の配置`:'飛車の振り先は未確定',ranging:Boolean(RANGING[rook.file]),rook};
}
function committedRanging(state,history,side){
 // Preserve established early-game structure even if the rook later leaves its file.
 for(const past of [...history,state]){
  if((past.moveNumber||1)>25)continue;
  const r=rookProfile(past,side);if(r.ranging)return r.key;
 }
 return null;
}
function pawnAdvanced(state,file,side){
 for(let rank=1;rank<=6;rank++){const p=pieceAt(state,file,rank,side);if(p?.owner===side&&p.type==='P')return true;}
 return false;
}
function opponentPressure(state,side){
 const files=[];
 for(let i=0;i<81;i++){
  const p=state.board[i];if(p?.owner===1-side&&p.type==='P'){
   const n=relative(i,side),rank=Math.floor(n/9)+1,file=9-n%9;
   if(rank>=5&&rank<=8)files.push(file);
  }
 }
 return [...new Set(files)].sort((a,b)=>a-b);
}
function quietOpening(state){
 const count=state.board.filter(Boolean).length;
 const handCount=state.hands.reduce((n,h)=>n+Object.values(h).reduce((a,b)=>a+b,0),0);
 return (state.moveNumber||1)<=25&&count>=36&&!handCount&&!state.board.some(p=>p?.type.startsWith('+'));
}
function chooseGuide(state,side,list){
 if(state.turn!==side)return null;
 for(const usi of list||[]){const m=moveFromUSI(state,side===1?rotateUSI(usi):usi);if(m)return m;}
 return null;
}

/**
 * Return {key,name,reason,opponent,guideMove,changed,isHeuristic:true}.
 * `opponent` is a display string, `guideMove` is a legal shogi.js move or null.
 * `history` contains only positions up to the displayed position (no future states).
 * cpSente must be the engine value for THIS position, never a stale previous score.
 */
export function getAdaptivePlan({state,history=[],side=0,preferred='auto',adaptive=true,cpSente=null}){
 const chosen=Object.hasOwn(strategyData,preferred)?preferred:'auto';
 const initial=strategyData[chosen],family=initial.family,opp=rookProfile(state,1-side),own=rookProfile(state,side);
 const oppRookPawn=pawnAdvanced(state,2,1-side),pressure=opponentPressure(state,side);
 const opponent=opp.ranging?`相手：${opp.name}`:oppRookPawn?'相手：飛車先の歩を進める配置':`相手：${opp.name}`;
 const commit=committedRanging(state,history,side);
 const matchingStructure=commit&&(family===commit||family===own.key);
 const structureName=matchingStructure?initial.name:NAMES[commit];
 const ownScore=Number.isFinite(cpSente)?cpSente*(side===0?1:-1):null;
 let key=chosen,name=initial.name,reason=initial.text,list=initial.moves,allowGuide=quietOpening(state);
 const checked=isInCheck(state,side);
 if(!adaptive){
  if(checked){reason='王手されているため戦法の参考手は停止します。AIの王手への対応候補を確認してください。';allowGuide=false;}
  else if(pressure.length||!quietOpening(state)||ownScore!==null&&ownScore<=-350){reason='初期戦法は固定中です。局面が動いているため序盤の参考手を停止し、AIの候補手を比較してください。';allowGuide=false;}
  return {key,name,reason,opponent,guideMove:allowGuide?chooseGuide(state,side,list):null,changed:false,isHeuristic:true};
 }
 if(checked){
  key='check';name='王手への対応';reason='王手を検出したため、駒組みより玉の安全を優先する方針に切り替えました。AI候補から王手を解消する手を確認してください。';allowGuide=false;
 }else if(ownScore!==null&&ownScore<=-350){
  key='defend';name=commit?`${structureName}・立て直し`:'立て直し・守りを検討';reason='この局面のAI評価が自分に不利なため、定型の駒組みを停止しました。反撃を含む実際の対応はAI候補で比較します。';allowGuide=false;
 }else if(pressure.length){
  key='respond-pressure';name=commit?`${structureName}・仕掛け対応`:'相手の仕掛けに対応';reason=`相手の歩が自分から見て${pressure.join('・')}筋の5段目以降へ進んだため、序盤の定型手を停止しました。受け・反撃はAI候補を確認してください。`;allowGuide=false;
 }else if(!quietOpening(state)){
  key='position';name=commit?`${structureName}・局面重視`:'局面重視';reason='駒交換・駒の進出・手数により序盤の定型ガイドを終了しました。現在の配置をもとにAIの候補手を比較します。';allowGuide=false;
 }else if(commit){
  key=matchingStructure?chosen:commit;name=structureName;list=matchingStructure?initial.moves:strategyData[commit]?.moves||[];
  reason=matchingStructure?`選択した${initial.name}の構想を、現在の飛車配置に合わせて継続します。詳細な戦法の完成を認識したという意味ではありません。`:`飛車を振った${NAMES[commit]}の配置を維持する方針です。既存の駒組みを無視して、別の飛車位置へ戻す案は出しません。`;
  // Once the rook has committed, avoid a static list that could undo a live plan.
  list=list.filter(usi=>!usi.startsWith('2h'));
  if(opp.ranging){key='mutual-ranging';name=`相振り飛車・${structureName}`;reason=`相手も${opp.name}なので、${structureName}の構えを保ち、相振り飛車への対応方針に切り替えました。定型手の実行は止め、AIの候補手を比較します。`;allowGuide=false;}
 }else if(opp.ranging){
  if(['auto','ibisha','yagura'].includes(family)){
   const compatible=['anti-bogin','elmo-kyusen','5kurai','gyokutou-kurai'].includes(chosen)||(['naname-bogin','saginomiya'].includes(chosen)&&opp.key==='shiken')||(chosen==='chosoku'&&opp.key==='nakabisha');
   key=compatible?chosen:'anti-ranging';name=compatible?initial.name:'対振り飛車の居飛車';list=compatible?initial.moves:antiRangingMoves;
   reason=compatible?`相手の${opp.name}に対して、選択した${initial.name}の構想を継続します。具体的な仕掛けはAI候補と照合してください。`:`相手の${opp.name}を検出したため、居飛車で対振り飛車を意識する方針に切り替えました。囲いや具体手は相手の攻めに合わせて比較します。`;
  }else{
   key='mutual-ranging';name=`相振り飛車・${initial.name}`;reason=`相手も${opp.name}なので、初期設定の${initial.name}を土台に相振り飛車への対応方針へ切り替えました。具体手はAIの候補で確認してください。`;allowGuide=false;
  }
 }else if(chosen==='auto'&&oppRookPawn&&own.key==='ibisha'){
  key='shiken';name='四間飛車の構想';list=strategyData.shiken.moves;
  reason='相手が飛車先の歩を進めたため、角道を止めて四間飛車を目指す参考方針に切り替えました。最善戦法の断定ではなく、AI候補と比較するための構想です。';
 }
 return {key,name,reason,opponent,guideMove:allowGuide?chooseGuide(state,side,list):null,changed:key!==chosen,isHeuristic:true};
}
