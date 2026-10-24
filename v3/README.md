# 響V3 — 承認原画Aの制作データ

承認原画は `artwork/hibiki-static-a.png`（d8e3a9c）。原画・split-d・split-eは保全している。現在の制作・会話画面は `model-source.mjs` が指定する原画Aの1024×1536モデルを共有し、旧r33/r34のモデル・部品・座標は読み込まない。

- [会話・衣装・左右の手の確認](preview.html) — 制作PC: http://127.0.0.1:8796/v3/preview.html
- [メッシュ・形状キーの編集](author.html) — 制作PC: http://127.0.0.1:8796/v3/author.html
- [可動素材と検証範囲](artwork/split-e/MOTION.md)
- [保全した静止衣装素材](artwork/split-e/README.md) / [静止交換](artwork/split-e/index.html)

PSDは原画と補完素材、`artwork/split-e/model-approved-a.json` はメッシュ・階層・形状キーの編集データ。独自評価器とWebGL2を両画面で共有する。JSON保存・再読込み、キー値上での頂点編集、左右の手のIK操作、現在の手の拡大を備える。制作中のデータであり、可動全体・Human Acceptanceの完了ではない。

`tools/export-approved-rig-leaves.jsx` は可動用PSDの各非空レイヤーを同じ座標で書き出す。`tools/author-approved-a.mjs` が原画Aへ登録した関節・ウェイト・局所補正を保存する。袖は `tools/read-hand-contours.py --approved-sleeves` で測った輪郭から制作。造形の正本は保存したJSONで、制作画面での手編集を再出力スクリプトで無断上書きしない。

`tools/verify-approved-motion.py` は素材保全・PSD再読込み・関節の途中形を限定検証する。`tools/verify-package.mjs` は両画面の単一参照とGit index内のPSD・manifest・モデル・全PNGをバイト単位で照合する。数値検証を自然さ・全可動素材・視覚的受入の代用にしない。

旧r33/r34とその制作スクリプト・証拠は履歴として保全している。旧手順・旧解析記録を原画Aの完成モデルの証拠へ読み替えない。管理は既存 #94 / #96〜#102、実装PRは avatar #27。Twinow/HUB/V2/#38/本番/Driveを変更しない。
