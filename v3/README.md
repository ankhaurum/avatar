# 独立V3の制作データ

管理: Ankhaurum-Development #94 / #98 / #99 / #100 / #101 / #102。制作中の保存地点であり、原画完成・可動完成・Human Acceptanceを意味しない。

## 開く

リポジトリを静的HTTPサーバーで配信し、`v3/author.html` を開く。会話プレビューは `v3/preview.html`（http://127.0.0.1:8796/v3/preview.html）。ローカル制作URLは http://127.0.0.1:8796/v3/author.html 。既存V2、HUB、Twinow、旧V3試作への接続はない。

現在は `source/hibiki-v3-art-r32.psd`、62パーツの `export-r32/manifest.json`、編集データ `model-head-r32.json` を使用する。原画はPSD、メッシュ・階層・形状キー・局所厚みはJSON。同じJSONを制作画面の独自評価器とWebGL2描画器が読む。r5は過去の保存地点として保持。

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
python v3/tools/read-hand-contours.py <new-initial.json> <new-contours.json>
# 輪郭を確認して source/hand-contours.json へ登録してから肘を制作する
node v3/tools/author-elbows.mjs <new-initial.json> <new-rigged.json>
node v3/tools/author-hands.mjs <new-rigged.json> <new-contours.json> <new-hands.json>
node v3/tools/author-forearm.mjs <new-hands.json> <new-volume.json>
node v3/tools/author-face.mjs <new-volume.json> <new-face.json>
node v3/tools/author-mouth.mjs <new-face.json> <new-mouth.json>
node v3/tools/author-shoulders.mjs <new-mouth.json> <new-bust.json>
node v3/tools/author-head.mjs <new-bust.json> <new-head.json>
```

`author-forearm.mjs` は保存済み `source/hand-contours.json` を読む。原画変更時には対応する検証済み輪郭へ更新する。出力を上書きして編集を失わないよう新しいファイル名を使う。輪郭取得はPNGのalpha読取りのみで、画像加工ではない。完成形の自動推論ではなく、原画に登録した輪郭・関節・形状対応を制作データとして保存する。

参照は `source/sleeve-poses.png`、`source/elbow-authoring.json`、`source/hand-profiles.png`。袖の曲げ、手の側面厚みの制作ガイドであり、外部SDKの頂点・復元コードではない。衣装下地の `torso-underpaint.png` は襟・ネクタイの下の重複除去用。公式の目・鼻・口・頬の主要画素を保持する。肌の隠れ領域は skin-underpaint.png を公式原画に位置合わせし、Photoshopで補完した。生成した顔全体を採用したものではなく、補完箇所の色・境界は引き続き造形確認が必要。口腔の歯・舌のみ expression-guide.png から制作した。

## 確認できた範囲

PSD書出し→SHA検証→メッシュ→局所形状／局所厚み→階層／IK→WebGL2を接続。手の甲・掌は同じ立体断面の表裏で、透明度切替ではない。深度と裏面カリングで指の前後を描画。手首屈曲、前腕ひねり、指節は別の軸と階層を持つ。袖は皮膚から独立した追従量を持つ。

左右のひねり、独立指屈曲、右のひねり＋手首屈曲、左右異なる肘曲げ＋身体の傾きを実画面で確認。袖内の皮膚断面登録と手首位置を修正し、確認した複合姿勢の袖口の隙間・突抜けを修正した。証拠画像と対象モデルは `evidence/articulation-checkpoint.json`。

内外方向を含む肘の54キー／途中形確認で反転なし。評価器・IK・局所立体・肩・動作・表情後投影の19単体検証が通過。過去の肘キー1頂点の編集→保存→差分→再読込→実描画は `evidence/key-roundtrip.json`。いずれも視覚的完成・全身の自然さを証明しない。

## 残課題

指節の皮膚の折れ・付根、袖裏の陰影、肩口と胸の複合変形、顔／髪の境界と高角度の造形は調整中。頭部XY、口形、発話、感情、髪・衣装の追従と会話状態の統合は実装したが、最終的な自然さの監査は未完了。左右鏡像の手の陰影も最終造形として未承認。基準形の顔ピクセル保持だけでは可動時のIdentityを保証しない。

全7Blockは完了していない。自然さとIdentityのHuman Acceptanceはユーザーが行う。

## 会話統合の保存地点

待機・発話・傾聴・思考・喜び・驚き・説明・うなずきを `motion.json` で編集する。表情、音声、手動の腕操作、二次動作を別入力として合成する。手動操作は明示解除まで保持し、状態変更で奪わない。

ローカル音声の実測RMS、合成テスト音、音声なしの疑似発話を区別して表示する。実音声の停止・終了後に疑似発話へ戻さない。ブラウザ非表示時は再生・描画を停止する。顔の奥行きは表情変形後の共通曲面を参照し、閉じたまぶたの接合が頭部回転で再び離れないようにした。

書出しの増分モードは作者が変更IDを把握している場合だけ使用する。boundsが同一という理由で画素不変と推測しない。未知の手作業変更は全パーツを書き出す。
