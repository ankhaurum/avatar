# 響V3 頭部素材の継続制作 — 2026-10-25

対象: HV3-03 / Ankhaurum-Development #98 / avatar PR #27。基点push 8f5c483。全素材完成・Human Acceptanceではない。

## 編集成果
`v3/artwork/split-e/hibiki-head-materials-review.psd` は1024×1536、トップレベル20、グループを含む93要素。原画由来の目鼻唇を保ち、耳・耳前髪・前髪・顎輪郭・首を組み立てた検査用PSD。口内の制作PSDとは別であり、Cubism用完成PSDではない。

- 過大に見えていたJ由来の右耳を採用せず、原画の可視縁と手描きの隠れ耳・陰影を分離。左耳も同様に制作し、こめかみの接合を補った。
- 耳前髪は原画の局所RGBと青−赤チャンネル由来のマスクを用い、既存髪の重複領域をマスクで隠した。画素の移動・拡大縮小で合わせていない。
- 前髪は青成分だけでは薄い毛先が欠けたため、その試作を不採用。肌下地と原画の赤成分差からマスクを作り、色域による限定、眉・まぶたの混入除去、毛先マスクの局所0.4pxぼかしを行った。
- 前髪色の分離はPhotoshop内のMultiply/Subtract/Divideを使った `F=(C-(1-a)B)/a` の候補。8bitの丸め・クリップと推定下地の誤差があり、原画の完全再現や可動品質を保証しない。眉との交差と毛先は仕上げ未達。
- 原画の顎付近の明暗境界を読み、原画画素の輪郭帯を追加。首は原画の可視部分と上端の手描き隠面・影を分離し、顎の後ろへ配置。変形は行わず、首と顎の重なりを是正。
- 眉の可視原画芯を保持し、隠れる描き足しだけ不透明度70%、追加ぼかし0.6pxで調整。隠れ眉の最終採用ではない。
- 不採用試作はローカルの制作PSDに保全し、Git保存の検査用PSDから除いた。髪の原画色レイヤーは対応する毛束の範囲へ限定し、5組すべてクリッピングを確認。全身の参照原画は非表示・ロック。

## 検証
`v3/evidence/material-redesign-20261025/head-material-integrity.json` と `head-layer-manifest.json` を参照。
- 原画A SHA256: a62d7badad8801b9cd91994436eaf0ad77e4ef09401b84cea3d9a51d3543e5cf。
- 復元Oの原画由来13部品と新PSDの単独PNGを比較し、全件RGBA差分0。鼻、上下可視唇、左右各5部品（主/副ハイライト・上下まぶた・下まぶた肌）。この一致は顔全体のIdentityや口形完成の証明ではない。
- 試作整理前後の合成RGBA差分0。
- ディスク上のPSDを別名コピーから開き直し、合成RGBA差分0。既に開いているPSDを取得しただけの検査ではない。
- 全身参照が表示されたままの不正な検査出力を検出・修正。最終出力は参照非表示、y550以降の可視画素0。髪クリッピング解除による整理前後の不一致も検出して修正した。
- 正面の白/暗背景、髪・耳・首の単独素材を確認。顔の比較画像はA / 着手前 / 今回候補の順に `face-ear-proof-0/1/2.png`。
- 部分領域のRGB平均絶対誤差は診断値であり採用条件ではない。額17.7442→5.3731、右耳21.5264→5.3176、左耳34.9074→9.0068。小さい数値を品質やIdentityの受入へ読み替えない。
- PNG保存は検査用複製だけで実施。元PSDへの直接PNG保存は自動承認レビューが保存状態へのリスクを理由に拒否したため、推奨された複製経路へ変更した。

再検査: `python v3/evidence/material-redesign-20261025/verify-head-materials.py`（Pillow/numpyが必要）。13部品PNG、整理前後/再読込みPNG、原画SHA、検査域外の参照漏れを比較する。実描画/可動試験ではない。

## 耳前髪の追加色分離
57708b5保存後も制作を継続し、左右の耳前髪について実効alphaをそのまま保持した色分離を追加した。各耳前髪を非表示にした下地Bと原画CからPhotoshop内で前景色を再構成。位置・輪郭・透明度は動かさず、補正前後の各alpha差分0を確認。補正前PNGは `head-component-hair-ear-r/l-alpha-baseline.png` として保存。再合成で原画との部分色差は低減したが、隠れ耳の造形と可動時の色分離の妥当性は未完了であり採用確定ではない。

## 素材PNG対応
以下は検査用書出しであり、ランタイム登録・Cubism取り込みは行っていない。
| PNG | PSDグループ |
|---|---|
| head-component-fringe.png | HAIR_fringe_hair_only_v2__REVIEW |
| head-component-hair-ear-r.png | HAIR_ear_front_R_decontaminated__REVIEW |
| head-component-hair-ear-l.png | HAIR_ear_front_L_decontaminated__REVIEW |
| head-component-ears.png | EARS_material_review |
| head-component-neck.png | NECK_original_visible_and_hidden__REVIEW |

## 残る欠陥と次工程
前髪の毛先の自然さ、眉との交差部、地肌と髪の影の分担、耳前の半透明色と髪全体の色境界は仕上げ未達。独立部品の可動で焼き込みや隠面が露出しないかの確認も未実施。歯・舌・開口時の口角接合、身体/腕手指/衣装を含む全素材も未完了。完成素材として採用せず、これらを素材工程で修正する。全素材が整う前にCubismへ取り込まない。

## 障害復旧と保全
20:06のPhotoshop終了と再起動時停止の後、ユーザーがPCを再起動。21文書の復元を取得し、別名コピーを全件開き直してレイヤー構成一致を確認した。自動復旧PSB21件の事前コピーも保持。クラッシュ直前の全未保存操作まで復元されたという意味ではない。
再起動前の `refineSelectionEdge` を再送していない。GUIの画面取得タイムアウトは残るが、今回のPSD編集・複製書出し・再読込みはPhotoshop JSXで実行して確認した。
原画/J/M/N/O、元の口素材、復元21文書を上書き/終了していない。既存tracked dirty7件は今回commitから除外。Twinow/HUB/V2/#38/本番/Drive変更なし。Cubism取込・モデル出力・公開なし。

## 制作判断の一次資料
- [Adobe: チャンネル計算](https://helpx.adobe.com/ae_en/photoshop/using/channel-calculations.html)
- [Adobe: ブレンドモード](https://www.adobe.com/products/photoshop/blend-colors.html)
- [Live2D: パーツ分け](https://docs.live2d.com/cubism-editor-manual/divide-the-material/)
