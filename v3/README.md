# 独立V3の制作データ

管理: Ankhaurum-Development #94 / #98 / #99 / #100。制作中の保存地点であり、原画完成・可動完成・Human Acceptanceを意味しない。

## 開く

このリポジトリを静的HTTPサーバーで配信し、`v3/author.html` を開く。現在のローカル制作URLは `http://127.0.0.1:8796/v3/author.html`。既存V2、HUB、Twinow、旧V3試作への接続はない。

`source/hibiki-v3-art-r5.psd` はPhotoshopで制作した原画。`export-r5/manifest.json` はPSDと58パーツPNGのSHA256・レイヤーID・bounds。`model-rigged-r2.json` は現在の階層・メッシュ・肘補正形状を保存した編集データで、同じデータを制作画面の独自評価器とWebGL2描画器が読む。

## 制作操作

- 制作パーツを選び、ワイヤー表示と単独表示で輪郭を確認する。
- 制作パラメータを選び、スライダーまたは数値入力でキー間を確認する。肘パーツと肘パラメータを選ぶと、保存済みキー位置のボタンが現れる。
- 手首の丸印をドラッグすると左右独立のIKが動く。現在の制作可動範囲から出た目標は可到達域へ制限する。肩補正、前腕ひねり、指節、手の向きの統合は未完成。
- 基準形では頂点を編集できる。形状キー編集を選ぶと、保存済みの正確なキー上で局所差分を編集する。途中姿勢を暗黙に新しいキーとして追加しない。
- 制作JSONを保存／読み込む。テクスチャの相対参照はこの制作ページを基準に保つ。元のPSDはこの操作では変更されない。

## 再制作の入口

`tools/trace-art.mjs` が原画上の輪郭と配置を保存し、`tools/create-art.jsx` が新規PSDを作る。書出しは `tools/export-psd.jsx`。いずれもPhotoshop MCPからJSXを実行する。開いている他の文書を加工しない。

```text
node v3/tools/finalize-export.mjs <source.psd> <new-export-directory>
node v3/tools/prepare-meshes.mjs <manifest.json> <new-model.json>
node v3/tools/author-elbows.mjs <initial-model.json> <new-rigged-model.json>
```

出力先を上書きして制作済みの編集を失わないよう、新しい出力名を指定する。肘の参照原画と対応点は `source/sleeve-poses.png` / `source/elbow-authoring.json`。SDKの頂点や復元コードは使用していない。

## この保存地点での事実と残課題

PSD書出し→SHA検証→メッシュ→局所形状→階層／IK→WebGL2を接続した。ブラウザで基準姿勢、両腕屈曲、途中姿勢、手目標移動を確認した。初期の深い肘屈曲にあった反転は、折れた空間での外挿をやめ、原画の輪郭断面の対応から補正を制作して解消した。肘制限後に手が目標方向から横へずれるIK不具合も修正した。

原画にはまだ襟・ネクタイ下の衣装の重複、首周辺の髪残りがある。手の甲／掌／側面、指節屈曲、肩口補正、顔XY、表情・発話、物理追従、会話統合は未完成。左右の手の単純な鏡像配置は最終造形として採用していない。正面の顔ピクセルを保持したことだけで可動時のIdentityを保証しない。性能測定・操作保存再読込の通し確認・最終監査も残っている。

単体検証やメッシュ反転なしは、自然な造形の完成判定ではない。全7Blockの完了として扱わない。
