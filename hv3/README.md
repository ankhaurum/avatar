# 響V3 — PixiJSによる独自2Dリグ（制作中）

公開ページ：https://ankhaurum.github.io/avatar/ 。管理は Ankhaurum-Development #94（HV3-01〜07）。完成やHuman Acceptanceを示すものではない。Live2D Cubismは使わず、Live2Dのコード・素材・モーションも含めない。

## 素材
- 体・衣装・髪・腕・手（休め・開く・振る）：ChatGPTのR3（`Hibiki_R3_Mesh_Mask_20261028`）。指さし・軽く握る手：同 Hand4 v2。`tools/prepare-r3.mjs` が半分の解像度で `parts/r3/` に取り込み、元ファイルのSHA256を `parts/r3/manifest.json` に記録する。前腕の素肌は手袋に完全に隠れるため取り込まない。
- 顔：承認原画A（`v3/artwork/hibiki-static-a.png`）から白目・虹彩・上下まつ毛・眉・唇をそのまま切り出した（`tools/extract-face.cjs`、輪郭は `tools/face-def.json`）。原画Aの下地は目・眉をPhotoshopのコンテンツに応じた塗りつぶし（`tools/fill-face-base.jsx`）、口を周囲の肌からの調和補間で埋め、まつ毛・眉はその下地との差分（アンブレンド）で取り出した。静止時の再合成は原画Aと最大差1.1/255。R3の頭には、両目と口の中心を合わせた相似変換（縮尺0.551）で載せる。口の中（口内・上下の歯・舌）はR3。

## 仕組み
- `tools/automesh.mjs`：透明部分の輪郭を追跡し、制約付きドロネー分割でメッシュを作る。目の縁・口角・毛先・裾は頂点を細かくする。
- `tools/build-rig.mjs`（`rig-builder.mjs`・`face-rig.mjs`）：ワープ・回転デフォーマの親子関係、パラメータごとのキーフォーム（変位関数から生成）、関節の2親混合、描画順の切替、物理を `hibiki.rig.json` に書き出す。
- `rig-eval.js`：キーフォームの多重線形補間、親子変形、減衰ばねの物理。`renderer.js`：PixiJS 8のMesh。透明部分を捨てるシェーダーでステンシルマスクを描き、虹彩を白目で、歯と舌を口内で切り抜く（既存V3のWebGL2描画の方式を引き継ぐ）。`motion.js`：呼吸・瞬き・視線・頭と体の追従・疑似発話・表情・身振り。
- 瞬きは上まつ毛のメッシュを下まぶたへ曲げて閉じる。閉じ目の線は描いていない。
- 動きの量は、公式サンプルの頂点を公開APIで実測した比率を目安にした（`docs/reference-measurements.md`）。

再生成：`cd hv3/tools && npm install && node build-rig.mjs`。確認用の固定姿勢表示は `dev.html?view=bust&p={"EyeLOpen":0}`。

## 未達・制約
- 手を胸や顎の高さへ持ってくる身振りは、上腕が手前に向いて短く見える絵が無いため行わない。体の前の身振りは腰の前で手を重ねる・横へ差し出す、まで。
- 顔の表示は原画Aの約2倍までに抑えている。R3の髪の縁は元画像の拡大由来でやや粗い。
- 音声との同期は無い（口の動きは疑似発話）。
