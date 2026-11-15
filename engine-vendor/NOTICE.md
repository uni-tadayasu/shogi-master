# 将棋名人 — 同梱エンジンと対応ソース

## 実際のエンジン

- USI での識別名: **YaneuraOu NNUE KP256 9.80git 32SSE4.2 TOURNAMENT**
- ブラウザ用の単一スレッド WebAssembly / SIMD ビルド。
- 評価関数: **SuishoPetite 2021-11 (NNUE K-P)**、作者 たややん氏。
- 本アプリのブラウザ移植版は上流エンジンの最新版そのものを保証するものではありません。評価関数の公開年は2021年であり、「最新評価関数」ではありません。
- 推奨手・評価値は設定した探索時間と端末性能に依存します。必勝、完全読み、棋力の固定値を保証しません。

著作権者: yaneurao、Stockfish contributors、Apery / SilentMajority contributors、たややん、mizar、NuthanNumarsh、その他上流ソースに記載された各著作権者。
GPL v3 の全文は [GPL-3.0.txt](GPL-3.0.txt) を参照してください。上流の著作権表記と各ファイルのライセンス表記を保持しています。

## 固定した配布元

ブラウザ用バイナリを改変せず、以下のコミットから同梱しました。

- Repository: https://github.com/NuthanNumarsh/yaneuraou-wasm-singlethread
- Commit: `540483b9f379f90e7bd810cc8409b0be8d56e736`
- Commit date: 2026-09-26
- Base YaneuraOu commit (上流記載): `c1b80eaa09fe13d5f12b1599d1ae4d53c224de30`
- Source archive: [yaneuraou-corresponding-source.tar.gz](yaneuraou-corresponding-source.tar.gz)
- Model source: [suishopetite_20211123.k_p.nnue.cpp.gz](suishopetite_20211123.k_p.nnue.cpp.gz)
- Model distribution source: https://github.com/mizar/YaneuraOu/releases/tag/resource
- Original build instructions: [UPSTREAM_BUILD.md](UPSTREAM_BUILD.md)

対応する C++ ソース、ビルド設定、単一スレッド化のパッチは同梱ソースアーカイブに含まれます。上流アーカイブには評価関数のビルド用リソースが含まれていないため、上記モデルソースも別途同梱しています。生成済みのバイナリだけでなく、このディレクトリ全体を公開してください。

`engine-worker.js` と `core-worker.js` は「将棋名人」用に新規作成した GPL-3.0-or-later のブラウザ連携コードです。バイナリは変更していません。

## 再ビルド

Emscripten 3.1.43 と GNU make を用意し、以下を実行してください。ツールチェーンは上流の指定です。本納品では同梱バイナリの実行・探索を検証しており、C++ からの再コンパイルは実施していません。

```sh
tar -xzf yaneuraou-corresponding-source.tar.gz
cd yaneuraou-wasm-singlethread-540483b9f379f90e7bd810cc8409b0be8d56e736
gzip -cd ../suishopetite_20211123.k_p.nnue.cpp.gz > source/eval/nnue/embedded_nnue.cpp
mkdir -p build/wasm/k-p/lib
cd source
make -j4 tournament COMPILER=em++ TARGET_CPU=WASM \
  YANEURAOU_EDITION=YANEURAOU_ENGINE_NNUE_KP256 \
  TARGET=../build/wasm/k-p/lib/yaneuraou.k-p.js \
  EM_EXPORT_NAME=YaneuraOu_K_P EVAL_EMBEDDING=ON \
  EM_INITIAL_MEMORY_SIZE=92274688 WASM_SINGLE_THREAD=ON
```

## 配信・動作

すべて同一オリジンから読み込みます。APIキー、外部の解析API、CDN、SharedArrayBuffer、COOP/COEPヘッダーは不要です。GitHub Pages にフォルダ構成ごと置いて動作します。WebAssembly SIMD と Web Worker / nested Worker に対応する現行の Chrome / Edge / Firefox / Safari を想定しています。古いブラウザや `file://` からの直接起動は対象外です。盤面の解析は端末内で完結します。

探索は専用 Worker 内で実行し、操作画面をブロックしません。探索を中断すると内部の Worker を停止するため、次回の探索は新しいエンジンインスタンスになります。USI_Hash は32 / 64 / 128MBから選択でき、探索スレッドは1本です。終了済みの探索の後は同じエンジンを再利用し、探索キャッシュを保持します（メモリ設定変更時を除く）。探索中の上書き・中断時は、古い結果を混ぜないため内部Workerを再起動します。

起動時は `USI_Hash=32` を先に指定し、その後 `Threads=1` を設定します。同梱ソースの Threads 設定処理は置換表の確保も行うため、この順序でエンジン既定値1024MBの一時確保を防ぎます。WASM全体では評価関数・スタックなども使うため、Hashの指定値が総メモリ量ではありません。バイナリ自体は改変していません。

## Worker API

```js
const worker = new Worker('./engine-vendor/engine-worker.js');
worker.postMessage({ type: 'init' });
worker.postMessage({ type: 'analyze', id: 1, sfen, timeMs: 1000, multiPV: 1, hashMB: 64 });
// 棋譜履歴を使用する場合、初期局面とそこからの全指し手を指定:
worker.postMessage({ type: 'analyze', id: 2, initialSfen, moves: ['7g7f'], timeMs: 1000, multiPV: 1, hashMB: 64 });
worker.postMessage({ type: 'stop' });
```

- `ready`: `{type:'ready', name, evaluation, threads:1, memoryBytes}`。起動完了時のWASMヒープ容量を含みます。
- `configured`: `{type:'configured', id, timeMs, multiPV, hashMB, threads:1}`。実際に適用した設定。
- `info`: `{type:'info', id, depth, seldepth, nodes, nps, time, multipv, score, pv}`
- `score`: `{cp:number}` または `{mate:number}`。必要時 `bound: 'upperbound' | 'lowerbound'` を付加。
- **評価値は手番側の視点**です。先手視点の表示には後手番の符号を反転してください。
- `done`: `{type:'done', id, bestmove, ponder}`。`bestmove` は USI 指し手、`resign`、`win` など。
- `stopped`: `{type:'stopped', id}`。
- `diagnostic`: `{type:'diagnostic', id?, source, message}`。エンジンの診断出力。
- `error`: `{type:'error', id?, message, stage?, diagnostics?}`。直近の診断は最大12件、各600文字まで保持します。異常終了した内部Workerは破棄します。
- 途中に新しい `analyze` を送ると古い探索を中断して新しい局面を解析します。終了済みの結果と現在の画面の局面が一致するかは、呼び出し側でも `id` を照合してください。

## 確認した項目

`node engine-vendor/test-engine.cjs` で、実際の WASM を Node worker_threads によるブラウザ Worker 互換のテスト環境で動かします。以下を確認しています。

1. 初期局面の MultiPV=3 探索、複数の `info`、USI `bestmove`。
2. 初期局面と全棋譜 (`7g7f`) を渡す後手番の探索。
3. 探索の上書き時に古い完了結果を転送しない。
4. 10秒の探索の途中停止と、その後の新しい探索。
5. 1秒・1候補の集中解析と、終了済みエンジンの再利用。
6. 32 / 64 / 128MBの探索キャッシュ切替、不正な大容量設定の拒否。
7. 返された手が対象局面で合法であること。
8. 起動時のWASMヒープが512MB未満であり、既定値1024MBを一時確保しないこと。
9. `7g7f 3c3d 2g2f 8b5b 2f2e` の5手後を32 / 64MBで解析できること。

これは実ブラウザの描画テストを代替するものではありません。


## 解析設定と限界（2026-11-15確認）

通常は1秒・1候補に計算を集中し、比較したいときは3候補へ切り替えます。より時間をかける研究では最大60秒まで指定できます。初回のエンジン読込、メモリ確保、ブラウザの混雑などは指定した探索時間に含まれず、必ず1秒以内に画面が更新されるわけではありません。終了済みのエンジンを再利用することで次の解析の起動負荷を減らします。

1秒で得られるのは、その時点の探索結果に基づく推奨手です。数学的に証明された最善手、必勝、一定の棋力、常に深読みより良い結果を保証しません。探索時間や候補数の変更は、評価関数やエンジン本体の更新ではありません。本配布の評価関数は引き続き **SuishoPetite 2021-11** です。

公式のエンジンオプション解説では、MultiPVを2以上にすると別候補も調べるため通常探索の棋力に影響し、USI_Hashは探索した局面を保持する置換表と説明されています。本サイトでは端末負荷とのバランスを取り、メモリ選択を128MBまでに制限します。スマートフォンは32MB、PCは64MBが基本で、低メモリ端末は32MBを使います。

参照元:

- [やねうら王・思考エンジンオプション（MultiPV / USI_Hash）](https://github.com/yaneurao/YaneuraOu/wiki/思考エンジンオプション)
- [単一スレッド版WASMの対応ソースとビルド説明](https://github.com/NuthanNumarsh/yaneuraou-wasm-singlethread/blob/master/README-wasm-singlethread.md)
- [mizar版WASMのビルド設定・評価関数](https://github.com/mizar/YaneuraOu.wasm/blob/wasm/package.json)

新しい本家のネイティブ版や別形式の評価関数を、互換性の確認なしにこのWASMへ差し替えることはできません。SharedArrayBufferを必要とする別のWASM配布物も、単純なGitHub Pages配置ではこの単一スレッド版と同じ条件で動くとは限りません。
