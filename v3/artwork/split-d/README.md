# 承認原画AのPSD分割・再合成検証（2026-10-24）

対象: Ankhaurum-Development #94 / HV3-03 #98、途中検証 HV3-07 #102 / avatar PR #27。

## 復元した制作地点

GitHubの00_RULES・development-entry、#94、#96〜#102の本文とコメント、PR #27の本文・コメント・commit・変更ファイルを確認。開始HEADは `d8e3a9c33502234fa22870c0953ad508b1ad6374`、既存ブランチ `codex/hibiki-bilateral-rig-20261023`、fetch後のremote差分0/0。

原画承認: https://github.com/ankhaurum/Ankhaurum-Development/issues/94#issuecomment-6370059173 と今回のユーザー指示。承認対象は `../hibiki-static-a.png`、SHA256 `a62d7badad8801b9cd91994436eaf0ad77e4ef09401b84cea3d9a51d3543e5cf`。原画ファイルは無変更。旧r33/r34および未追跡split-a/b/cは新しい原画の起点にしない。

## 発見と修正

既存split-bの髪領域が顔を先に消費しており、BODY_face_visible.pngはalphaが全画素0だった。首・手と衣装の切出し境界にも混入がある。split-cの単色身体下地は完成原画として採用しない。透過PNGの透明RGBを無視した表示は色の引伸ばしのように見えるため、白・暗背景へPhotoshopで合成した比較も用意した。

今回のsplit-dでは顔を先に分離し、ジャケット本体／左右袖、シャツ本体／左右カフス、ネクタイ、下衣と身体の可視部分を別レイヤー・グループへ分けた。画像の移動・拡縮・鏡像化・再生成を行わず、全パーツを1024×1536の共通座標で保存。空の残余レイヤーは除外した。

## 実行経路とBad Request

前チャットの2026-10-23T16:59:49Zのログは、Photoshop `hv3-underpaint-c.jsx` が `success:true` を返しPSDを書き終えた記録。続く16:59:52ZにCodexのtask_completeが `{"detail":"Bad Request"}` / codex_error_info=otherで終了した。したがって、確認できる発生層はPhotoshop処理成功後のCodexターン終了であり、PSD保存失敗ではない。HTTP要求内部・サーバー側根本原因は記録がなく未特定。文字列だけを根拠にPhotoshopの故障とは判断しない。

このセッションでは既存Photoshop 19.0.0に対する短いMCP JSXが成功。加えて既存Windows COM `Photoshop.Application.DoJavaScriptFile` で制作・保存・再読込・比較画像まで実行した。環境再構築・再インストール・新規サービス起動なし。通常sandbox内のCOM読取試行は応答せず中断し、許可されたデスクトップ環境で実行した。

実行例（リポジトリroot、既存Photoshop使用）:

```powershell
$psApp = New-Object -ComObject Photoshop.Application
$psApp.DoJavaScriptFile((Resolve-Path v3/tools/separate-approved-a.jsx).Path)
$psApp.DoJavaScriptFile((Resolve-Path v3/tools/review-approved-separation.jsx).Path)
python v3/tools/verify-approved-separation.py
```

分割スクリプトは既存PSDを標準では上書きしない。`HV3_REBUILD=1` のExtendScript環境値は、今回の自己生成成果の境界修正時だけ明示して使用し、実行後に解除した。既存の別作業・旧候補は上書きしていない。

## 検証証拠

- `hibiki-v3-approved-split-d.psd`: 編集可能なグループ・原画参照を含むPSD。参照原画グループは非表示。
- `parts/`: 同一座標の部品PNG。`layer-map.json`は部品とPSDグループ、選択境界の対応。
- `verification.json`: 承認原画SHA、PSD SHA、部品SHA、原画画素の被覆、再合成とディスクから再読込みしたPSDの比較。
- `approved-recomposed-white.png` / `approved-recomposed-dark.png`: 左=承認原画、右=再読込み後の再合成。
- `body-wardrobe-white.png` / `parts-white.png`: 衣装を外した可視身体と部品の不足を確認する画像。
- `index.html`: 原画・再合成・差分および衣装別表示の確認画面。

完全透明の画素はRGBがPhotoshop書出し時に変わるため、双方alpha=0のRGBだけを比較対象から外す。alphaと全可視RGBは別々に比較する。全非透明画素がちょうど一つのパーツに属することを検証し、原画一枚を表示して分割成立とする検証にはしない。

## 未達・制約

これは中立姿勢の可視画素分離と再合成の成立を示す成果であり、着せ替え完成ではない。衣装を外して見える胴体・腕、シャツのジャケット下／ネクタイ下、下衣の上端、髪下などの隠面制作が残る。境界の色混入・半透明の毛先と襟の所有、衣装交換時の縁・影は追加仕上げが必要。顔の主要部は別レイヤーになったが、眉・目・口などの可動用分離は本成果に含まない。

身体隠面だけを別素材として生成する要求をbuilt-in image_genへ1回実行したところ、HTTP 400 `moderation_blocked`（output / sexual）で拒否された。生成物は得られていない。この失敗は上記の旧Codexターン終了エラーとは別であり、同一要求の再試行・別経路による回避は行っていない。原画の再生成、人体の単色仮置きの完成品扱い、可動制御による補正はしていない。

#98と#102および7Blockは閉じない。原画承認をPSD・着せ替え・可動品質のHuman Acceptanceへ拡張しない。Twinow/HUB/V2/#38/本番/Google Driveの変更なし。

## ブラウザ確認と再読込み待ちの修正

Chromeで `http://127.0.0.1:8796/v3/artwork/split-d/index.html` を実確認。14部品の読込み、全表示での差分0、ネクタイ非表示時の差分22,143画素、すべて表示への復帰を確認。証拠は `review-screen.jpg`。ブラウザ差分は色変換を含む1階調許容の参考値で、厳密なPNG比較とは区別する。

比較再作成時、既に開いたPNGをディスク上で書き直したため、Photoshopの「最後に開いた、または保存した状態から変更されています。更新しますか？」が処理を止めた。今回の出力PNGのみを更新して続行。比較JSXはDialogModes.NOを処理中だけ指定し、finallyで元へ戻すよう修正した。アプリの終了や旧文書の破棄は行っていない。

既存の制作ポート8796は停止していたため、既存Pythonで同じavatar作業場所を127.0.0.1限定配信として復旧した。制作レビュー用として残す。公開・本番接続はない。

PNGのIDATを同じ展開バイト列のままdeflate level 9で可逆圧縮し、デコード画素・透明度・原画との一致を再検証した。画像編集・リサイズ・色変換は行っていない。verification.jsonのSHAは圧縮後の配布ファイルを対象とする。
