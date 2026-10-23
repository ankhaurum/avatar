# 独立V3の制作データ

管理: Ankhaurum-Development #94 / #98 / #99 / #100。制作中の保存地点であり、原画完成・可動完成・Human Acceptanceを意味しない。

## 開く

リポジトリを静的HTTPサーバーで配信し、`v3/author.html` を開く。ローカル制作URLは http://127.0.0.1:8796/v3/author.html 。既存V2、HUB、Twinow、旧V3試作への接続はない。

現在は `source/hibiki-v3-art-r9.psd`、62パーツの `export-r9/manifest.json`、編集データ `model-face-r3.json` を使用する。原画はPSD、メッシュ・階層・形状キー・局所厚みはJSON。同じJSONを制作画面の独自評価器とWebGL2描画器が読む。r5は過去の保存地点として保持。

## 制作操作

- パーツ選択、ワイヤー、単独表示、全体／左右手／顔の拡大。
- パラメータを数値またはスライダーで指定。左右の前腕ひねり・手首屈曲／回転・各指節を独立操作。親指はCMC/MCP/IP、他指はMCP/PIP/DIP。
- 手首の丸印は原画の手首くびれ位置。左右独立IKで上腕・肘・前腕が追従する。袖口の位置と手首関節を分離した。
- 基準形の頂点、または保存された正確な形状キー上の局所差分を編集。途中姿勢は表示のみ。局所立体を含む姿勢での逆編集は未対応。
- JSON保存／読み込み。テクスチャ相対参照をこのページ基準に保持。元PSDは変更しない。

## 再制作

Photoshop MCPから `tools/export-psd.jsx` を実行し、新しいフォルダへ書き出す。source PSDは保存しない。

```text
node v3/tools/finalize-export.mjs <source.psd> <new-export-directory>
node v3/tools/prepare-meshes.mjs <manifest.json> <new-initial.json>
node v3/tools/author-elbows.mjs <new-initial.json> <new-rigged.json>
python v3/tools/read-hand-contours.py <new-initial.json> <new-contours.json>
node v3/tools/author-hands.mjs <new-rigged.json> <new-contours.json> <new-hands.json>
node v3/tools/author-forearm.mjs <new-hands.json> <new-volume.json>
node v3/tools/author-face.mjs <new-volume.json> <new-face.json>
```

`author-forearm.mjs` は保存済み `source/hand-contours.json` を読む。原画変更時には対応する検証済み輪郭へ更新する。出力を上書きして編集を失わないよう新しいファイル名を使う。輪郭取得はPNGのalpha読取りのみで、画像加工ではない。完成形の自動推論ではなく、原画に登録した輪郭・関節・形状対応を制作データとして保存する。

参照は `source/sleeve-poses.png`、`source/elbow-authoring.json`、`source/hand-profiles.png`。袖の曲げ、手の側面厚みの制作ガイドであり、外部SDKの頂点・復元コードではない。衣装下地の `torso-underpaint.png` は襟・ネクタイの下の重複除去用。顔の生成置換はしていない。

## 確認できた範囲

PSD書出し→SHA検証→メッシュ→局所形状／局所厚み→階層／IK→WebGL2を接続。手の甲・掌は同じ立体断面の表裏で、透明度切替ではない。深度と裏面カリングで指の前後を描画。手首屈曲、前腕ひねり、指節は別の軸と階層を持つ。袖は皮膚から独立した追従量を持つ。

左右のひねり、独立指屈曲、右のひねり＋手首屈曲、左右異なる肘曲げ＋身体の傾きを実画面で確認。袖内の皮膚断面登録と手首位置を修正し、確認した複合姿勢の袖口の隙間・突抜けを修正した。証拠画像と対象モデルは `evidence/articulation-checkpoint.json`。

肘の30キー／途中形確認で反転なし。評価器・IK・局所立体の11単体検証が通過。過去の肘キー1頂点の編集→保存→差分→再読込→実描画は `evidence/key-roundtrip.json`。いずれも視覚的完成・全身の自然さを証明しない。

## 残課題

指節の皮膚の折れ・付根、袖裏の陰影、肩口と胸の補正、首周辺の髪残り／隠面、顔XY、まぶた縁の明るい継ぎ目、口形・発話・感情、物理追従、会話統合、性能実測・最終監査は未完了。左右鏡像の手の陰影も最終造形として未承認。基準形の顔ピクセル保持だけでは可動時のIdentityを保証しない。

全7Blockは完了していない。自然さとIdentityのHuman Acceptanceはユーザーが行う。
