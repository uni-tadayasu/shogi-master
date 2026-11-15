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

探索は専用 Worker 内で実行し、操作画面をブロックしません。探索を中断すると内部の Worker を停止するため、次回の探索は新しいエンジンインスタンスになります。USI_Hash は32MB、探索スレッドは1本です。

## Worker API

```js
const worker = new Worker('./engine-vendor/engine-worker.js');
worker.postMessage({ type: 'init' });
worker.postMessage({ type: 'analyze', id: 1, sfen, timeMs: 1500, multiPV: 3 });
// 棋譜履歴を使用する場合、初期局面とそこからの全指し手を指定:
worker.postMessage({ type: 'analyze', id: 2, initialSfen, moves: ['7g7f'], timeMs: 1500 });
worker.postMessage({ type: 'stop' });
```

- `ready`: `{type:'ready', name, evaluation, threads:1}`
- `info`: `{type:'info', id, depth, seldepth, nodes, nps, time, multipv, score, pv}`
- `score`: `{cp:number}` または `{mate:number}`。必要時 `bound: 'upperbound' | 'lowerbound'` を付加。
- **評価値は手番側の視点**です。先手視点の表示には後手番の符号を反転してください。
- `done`: `{type:'done', id, bestmove, ponder}`。`bestmove` は USI 指し手、`resign`、`win` など。
- `stopped`: `{type:'stopped', id}`。
- `error`: `{type:'error', id?, message}`。
- 途中に新しい `analyze` を送ると古い探索を中断して新しい局面を解析します。終了済みの結果と現在の画面の局面が一致するかは、呼び出し側でも `id` を照合してください。

## 確認した項目

`node engine-vendor/test-engine.cjs` で、実際の WASM を Node worker_threads によるブラウザ Worker 互換のテスト環境で動かします。以下を確認しています。

1. 初期局面の MultiPV=3 探索、複数の `info`、USI `bestmove`。
2. 初期局面と全棋譜 (`7g7f`) を渡す後手番の探索。
3. 探索の上書き時に古い完了結果を転送しない。
4. 10秒の探索の途中停止と、その後の新しい探索。

これは実ブラウザの描画テストを代替するものではありません。
