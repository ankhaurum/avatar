# 響V3：接続品質を優先した比較試作

Issue [#94](https://github.com/ankhaurum/Ankhaurum-Development/issues/94)。公開ページの置換・品質完成・正式採用を意味しない、独立した比較実装です。リポジトリ直下の既存ランタイムと素材は変更していません。

## 確認するもの

静的HTTPサーバーでリポジトリ直下を配信し、`/studies/continuity/` を開きます。この作業のローカルURLは `http://127.0.0.1:8794/studies/continuity/`。

- オートデモ：頭・視線、瞬き、微笑み、無音の口パク、呼吸・小さな姿勢変化・髪の追従。
- 左右タップ・横ドラッグ、個別調整、静止・省動作、明暗背景、顔／首／襟の拡大表示。
- [実描画比較](evidence/comparison.html)、[動作動画](evidence/motion.webm)、[スマホ幅](evidence/mobile-tap.png)、[閉眼・開口](evidence/new-expression-detail.png)。
- [PSD](materials/hibiki-continuity.psd)、[PNG合成](materials/neutral-composite.png)、[形状・ボーンデータ](materials/rig.json)、[素材の来歴とハッシュ](materials/manifest.json)。通常表示は、保存済みPNGと形状JSONを読みます。

## 原因と修正

1. **元画像はつながっていても、切り出した画像のα合成はつながらなかった。** `build_anatomical.py` の顔・首マスクは、それぞれをぼかしてから別画像に適用します。補完するαがaと1−aでも、通常のsource-over合成の被覆率は `a + (1-a)^2` で、完全な不透明にはなりません。髪にはY=782等で切断した領域もあります。切断部のテクスチャ補間・独立した変形も隙間の要因です。
2. **実描画でも正面時の欠損を確認。** 元画像でα>240の画素に限ると、旧描画の首領域では1,100画素、髪の切断位置付近では344画素に20以上のα低下がありました。新方式の同じ正面領域では該当画素は0です。[領域・結果](evidence/alpha-comparison.json)。これは当該領域の透過欠損の証拠で、自然さの合格値や全姿勢の保証ではありません。
3. **身体変形を増幅しても、人物としての構造にはならなかった。** 旧版は推定奥行き投影、7×7身体変位、肩の回転、表情の式を重ねます。衣装画像には首・襟・ネクタイ等が重複し、別々の画像を動かすと下の写真が露出します。衣装JSONのcorrections／occlusionも現在の描画器では評価されていません。異なる領域を同じ変位で動かしても、造形や描画順の問題を解消できるとは限りません。
4. **今回は顔・首・髪・スーツの接続部を切断しない表面に変更。** 胸→首→頭の親子変換と連続したスキニング重みで共有頂点を動かし、腰側を固定します。別画像の重ね幅やぼかしで首の隙間を隠す処理ではありません。頭の追従・呼吸は正面寄りの小さな範囲に限定しました。大きな3D風の顔向きの代替ができたという主張ではありません。
5. **口は接触線に沿ったメッシュの開口。** 上下唇は周辺の顔表面に連続したまま、口の境界を開きます。奥に口内の下地を置き、単なる黒い矩形の貼り付けや口画像の切替ではなく、開口形状で遮蔽します。
6. **まぶたに沿う頂点と、閉眼時の材質が必要だった。** 最初の均等格子では閉眼後も眼が残りました。上・下まぶたの輪郭へ頂点を配置し、形状キーと開口マスクを対応させました。さらに既存の許可済み閉眼画像から眼周辺だけを取り、閉眼形状に対応するUVへ補正した材質を制作しました。閉眼近傍でのみ合成し、潰れたまつ毛が二重になる問題を抑えます。顔全体の写真を差し替える方式ではありません。
7. **虹彩素材にまつ毛が焼き付いていた。** 元の虹彩パーツには上まつ毛も含まれていました。隠れる虹彩上部を自身の下側から補い、動く白目の開口に沿ってマスクし、視線移動でまつ毛まで移動する問題を抑えました。補完部分は推定の作画で、測定された眼球ではありません。

## 制作方式の比較・今回の選択

|方式|制作・骨格・変形・接合|ライセンス／今回の判断|
|---|---|---|
|PixiJS単独|Texture、Mesh、マスク等の描画基盤。適切な原画、リグ、形状、接合を自動制作しない|MIT。これだけでは解決しない|
|**PixiJS＋専用の小さなリグと形状キー**|既存の承認原画を維持し、接続部を共有するメッシュ、親子ボーン、微細な表情と口・眼のキーを制作|**今回の比較試作に採用**。描画・PSD処理は既存OSSを利用。全エディターを自作する方針ではない|
|PixiJS＋Spine|制作エディター・ボーン・weighted mesh等があるが、隠れる下地と適切なウェイトは作者が制作する|[Editor／Runtime契約](https://esotericsoftware.com/spine-editor-license)の条件がある。Pixi側のMITだけでSpineを無償利用できるわけではない。今回導入・購入なし|
|Live2D|ケイで既報のPSD→ArtMesh→親子→複合キー→接合・遮蔽という制作工程は有用|[Editor契約5.1.9](https://www.live2d.com/eula/live2D-editor-software-license-agreement_jp.html)の独自ミドルウェアとの出力併用制限を確認。[SDK公開条件](https://www.live2d.com/en/sdk/license/)はEditorと別で、Expandable Applications等には別条件がある。無条件無料・独自エンジンへの転用可とはしない。今回SDKやモデルデータの移植なし|
|Inochi2D|PSD読込、輪郭自動メッシュ、手動頂点、親子、形状キー、物理、INP出力を公開ソースで確認済み。人物の形状作画は必要|BSD-2-Clause。[モデルの権利](https://github.com/Inochi2D/inochi2d/wiki/Legal-Info)は制作者が定める。自由度のある候補として維持。今回の少ない動きでは既存のWeb環境から確認できる方式を優先し、Creatorの導入・出力実測はしていない|
|DragonBonesJS等|[JS Runtime](https://github.com/DragonBones/DragonBonesJS)は既存のボーン／アニメーション技術の候補|RuntimeはMIT。[配布License](https://github.com/DragonBones/DragonBonesJS/blob/master/LICENSE)。Editorの現状・自動操作・PixiJS 8との互換は未検証で、そのまま使えると判断しない|

[PixiJSのMesh仕様](https://pixijs.com/8.x/guides/components/scene-objects/mesh)と[MIT License](vendor/PIXI-LICENSE.txt)を確認し、8.22.0を固定。PSDは[ag-psd](https://github.com/Agamnentzar/ag-psd) 31.0.3（[MIT](vendor/AG-PSD-LICENSE.txt)）。配布integrityと配置bundleのSHAは[vendor台帳](vendor/manifest.json)に保存しています。npm install／postinstallや非公式MCPは実行していません。原画やIdentityの権利をライブラリのMITに変更するものではありません。

## 素材制作と自動操作

前報のPhotoshop CC 2018／19.0とIllustrator CC 2018のCOM失敗 `0x80080005` を再利用し、同じ失敗を繰り返して制作を停止する方針は取りませんでした。

- [Adobe公式](https://developer.adobe.com/photoshop/)は旧版向けExtendScriptを案内。新しいUXPと旧版ExtendScriptの対応を混同しません。当該CC 2018で使えるAdobe公式MCPは今回確認できていません。
- [drmedia/photoshop-mcp](https://github.com/drmedia/photoshop-mcp)：MIT、Photoshop 25.0以上、検証27.8。19.0には適合しません。
- [francisanderson/photoshop-mcp](https://github.com/francisanderson/photoshop-mcp)：MIT、PS2020/v21.2で検証、COM→ExtendScript経由。旧版にも対応するという記載はありますが、19.0での実接続や現在のCOM失敗の解消は未確認です。
- [BunsDev/adobe-mcp](https://github.com/BunsDev/adobe-mcp)：MIT、Windows／COM・ExtendScript。READMEの対象はPS2026等。CC2018での動作確認・全コードの安全性監査はしていません。

これらは非公式の候補であり、安全性・互換性を確認済みと称して追加しません。任意スクリプト実行を含む強い操作面があるため、不要なサーバー・権限・設定を追加せず、今回はローカルCanvasの素材制作コードとag-psdで実制作しました。**今回Adobeを操作してPSDを作ったという報告ではありません。**

承認画像から顔・首・髪・スーツがつながる表面、白目下地、独立虹彩、口内裏地、閉眼の局所補正材質を制作。PSDは参照原画を含む7レイヤー、RGB8bit・1122×1402です。別途PNGと形状JSONを保存しています。閉眼補正は中立時には非表示の作画データです。

通常表示では保存PNG・JSONだけを使用し、PSDライブラリや確認用合成PNGは読み込みません。GPUへ載せる虹彩・口内・閉眼補正は小領域へ切り出し、共有座標のUVへ変換しています。形状JSONには、まぶたと口の輪郭に沿うメッシュ、親子ボーン、開口×微笑みの四隅、左右閉眼のキーが入っています。これらは今回の輪郭・制御点から制作した独自データであり、他社モデルのキーやCoreの抽出ではありません。

再制作はローカルサーバー起動後、Node.js／Playwright／Chromeを使い、次を実行します。

```text
node studies/continuity/build-materials.mjs --closed-reference <既存の許可済み閉眼画像へのパス>
node studies/continuity/verify.mjs
```

必要なら`PLAYWRIGHT_MODULE`に既存Playwrightのpackage.jsonを指定します。`build-materials.mjs`の送信先はloopback URLに制限してあり、原画を第三者へ送信しません。今回の新規AI画像生成、Adobe／OS／MCP設定変更、Drive操作はありません。承認画像・閉眼参照のSHAは素材台帳にあります。

## 実描画の検証と限界

[検証記録](evidence/verification.json)に実行範囲を保存しています。

- 保存PSDを再読込し、非表示レイヤーを除いて再合成。最終確認では8bit各チャンネルの最大差1階調で合成PNGと対応しました。Photoshopで開いて確認したという意味ではありません。
- 頭・眼・口・微笑み・呼吸を組み合わせて表示。接合部と表情を拡大し、明暗背景で確認。代表的な境界姿勢で三角形の折り返しがないことも確認しましたが、自然さの合格判定にはしていません。
- 390px幅・タッチ有効なChrome再現環境で左右タップ、デモ、静止、prefers-reduced-motionを確認。素材欠損を起こした場合は承認静止画像とエラー表示へ移ることを確認。
- 動画はheadless ChromeのソフトウェアWebGLによる実時間描画です。録画の滑らかさはスマホ実機の性能証明ではありません。実機・Safari・ハードウェアGPU・発熱は未確認です。
- 今回のWeb実行で確認したHTTP通信先はローカルのみ。

**残る制約**：正面からの小さな頭部追従・傾きが対象で、大きな横顔の造形は未制作。閉眼補正の中間材質、歯や口内の立体感、写真の陰影の自然さは人間の目視評価が必要。首・髪・衣装をつながる表面にしたため、独立した大きな髪束や衣装交換には、今回の共有境界を守る素材・対応形状の追加制作が必要です。今回の素材はスーツ固定です。

従来公開版の音量同期、V2状態互換、衣装pack等は既存ページ側に保持し、この比較ページへ移植したとは報告しません。正式置換時には機能移行と利用先別衣装契約の継続が必要です。今回の比較試作だけでLive2D同等品質・Identityの人間承認・V3完成とは判断しません。
