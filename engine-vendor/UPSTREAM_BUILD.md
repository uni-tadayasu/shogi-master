# やねうら王 単一スレッド版 WebAssembly ビルド

このリポジトリは、将棋エンジン [やねうら王 (YaneuraOu)](https://github.com/yaneurao/YaneuraOu) を
スマートフォンアプリ「将棋 定跡と検討」の AI検討機能で使うために、**pthread を使わない
単一スレッド版として WebAssembly にビルドできるよう改変したソースコード**です。
GNU General Public License v3.0 に基づき、アプリに同梱しているバイナリに対応するソースとして公開しています。

- ベースにした本家のコミット: `yaneurao/YaneuraOu@c1b80eaa09fe13d5f12b1599d1ae4d53c224de30`
- 改変内容の差分: [`wasm-build/yaneuraou-single-thread.patch`](./wasm-build/yaneuraou-single-thread.patch)
  (`source/thread.h`, `source/thread.cpp`, `source/engine.cpp`, `source/Makefile`, `source/wasm_pre.js`)
- ライセンス: GPL v3([LICENSE](./LICENSE))。本家と同じです。

## 改変の要点

npm 等で配布されている pthread 版の wasm は SharedArrayBuffer を必要とし、cross-origin isolated に
できないモバイルの WebView では動きません。そこで次の変更をしています。

- `YANEURAOU_WASM_SINGLE_THREAD` を定義したとき、探索スレッドを立てず呼び出し元スレッドで
  同期的に探索する(`Thread::run_custom_job` がその場で実行、`wait_for_search_finished` は何もしない)
- スレッド数は常に 1 に固定
- `go` は bestmove を出力するまで戻らない(`go infinite` は使わず movetime/depth で必ず終わらせる)
- keep alive 用スレッドを wasm では作らない
- Makefile に `WASM_SINGLE_THREAD=ON` を追加(`-pthread` と `PTHREAD_POOL_SIZE` を外す)
- `wasm_pre.js` を同期版に差し替え(出力行を setTimeout を介さず listener に渡す)

## ビルド

emscripten 3.1.43 と GNU make が必要です。

```bash
gzip -cd wasm-build/resource/suishopetite_20211123.k_p.nnue.cpp.gz > source/eval/nnue/embedded_nnue.cpp
cd source
make -j16 tournament COMPILER=em++ TARGET_CPU=WASM   YANEURAOU_EDITION=YANEURAOU_ENGINE_NNUE_KP256   TARGET=../build/wasm/k-p/lib/yaneuraou.k-p.js EM_EXPORT_NAME=YaneuraOu_K_P   EVAL_EMBEDDING=ON EM_INITIAL_MEMORY_SIZE=92274688 WASM_SINGLE_THREAD=ON
```

ビルド済みの成果物は [`wasm-build/k-p/`](./wasm-build/k-p/) にあります(`yaneuraou.k-p.js`, `yaneuraou.k-p.wasm`)。
アプリではこれを [`wasm-build/build-engine-html.mjs`](./wasm-build/build-engine-html.mjs) で 1 枚の HTML に束ね、
WebView 内の Web Worker で USI プロトコルにより動かしています。

## 評価関数

埋め込んでいる NNUE K-P 評価関数 SuishoPetite (2021-11) は たややん氏 の作で、作者により権利主張なし
(自由利用可)とされています。配布元: https://github.com/mizar/YaneuraOu/releases/tag/resource

## 謝辞

やねうら王の作者 yaneurao 氏、評価関数 SuishoPetite の作者 たややん氏、
および wasm 化の先行例である mizar 氏の成果に深く感謝します。
