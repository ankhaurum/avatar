# 響V3：接続品質を優先した比較試作

2026-10-22 身体連動を修正：従来の呼吸は小さな一括上下動だけで、タップ入力には身体追従がありませんでした。共有表面上の連続した胸郭の拡張・肩の挙上を追加し、頭へ少し遅れて上半身が追従するよう変更。腰側は固定し、顔・眼・口の形状キーは変更していません。[吸気](evidence/body-inhale.png)／[呼気](evidence/body-exhale.png)を390px幅で比較し、動作動画と検証記録を更新しました。実機での自然さは引き続き未確認です。

Issue [#94](https://github.com/ankhaurum/Ankhaurum-Development/issues/94)。GitHub Pagesで確認する独立試作です。品質完成・本体への正式統合を意味しません。従来ランタイムは `/legacy.html` に保全しています。

## V2互換と感情表現（2026-10-22）

### 右手の小さな挨拶（追加試作）

「右手で挨拶」で約6.4秒の単発動作。本人の右手＝画面左側です。既存オートデモの先頭でも再生します。顔・目線・表情・首・呼吸、Happyの目の形状は変更していません。両手、会話に合わせた自動ジェスチャー、髪の追加機能は含みません。

初案は開いた手を単独生成して面内で回す構造でしたが、人体としての検討が不足しているとのユーザー指摘を受け、不採用としました。採用候補は、肩・腕を含む挨拶姿勢を参照して制作した、指を軽く曲げた右手・袖口・前腕の連続素材です。参照用に生成された顔・胴体の画素は使用せず、実行時は承認済みの顔・身体を維持しています。

胸の既存変形から右肩アンカーを取り、上腕は胴体の脇、肘はバストアップ画角の下に置きます。肘を支点に前腕を小さく回転させ、登場・退場に短いフェードを適用します。手を縦方向に潰す簡易投影は、薄い板に見える原因となったため廃止し、手の縦横比を保ちます。手首の小さな動きは維持します。手だけが大きな円弧を描いて胸を横断する初案は採用していません。これは専用の2D投影リグであり、完全な3D腕・指の物理シミュレーションではありません。指形状は固定で、手の表裏の変更・指の個別動作は未実装です。素材の可動範囲を超える大きな動きには使いません。

- [採用素材](materials/right-greeting.png)、[来歴・SHA・容量](materials/right-greeting.json)、[生成方法・採用した指示文](materials/right-greeting-prompts.json)。built-in image_genで制作し、Canvasで必要領域を配信用に梱包しました。外部CLI/API認証や他社素材は使用していません。
- 追加PNGは89,496 bytes、256×400。GPUのRGBA画像は409,600 bytes（約0.39MiB）、追加は325頂点・576三角形・1メッシュ。素材は初回の挨拶要求時だけ読み込みます。
- [途中姿勢](evidence/greeting-phases.png)、[暗い背景](evidence/greeting-dark.png)、[実時間動画](evidence/greeting-motion.webm)、[検証記録](evidence/greeting-verification.json)。顔領域の画素比較、発話・微笑みとの共存、静止／省動作、素材欠損時の本体継続、読込中リセットを確認しました。顔領域の一致は自然さの受入判定ではありません。
- `hibikiV3.greet()`／`setGesture('right-greeting')`、`stopGesture()`、snapshotのgestureで独立制御します。既存10状態の意味を変更したり、通知等へ挨拶を自動で結びつけたりしません。
- PC Chromeの390px幅・タッチ再現による確認です。動画はソフトウェアWebGLで、実機スマホの滑らかさ・性能・見た目は未確認。人間らしさの最終評価は未承認です。

両手や案内への拡張では、別の腕／手の向きに対応する素材と接合・前後関係の制作が必要です。今回の右手の素材を反転・回転するだけで任意の人間動作を再現できるとはしません。

対象はこの独立プレビューの入力互換・表情・複合デモ・公開までです。Twinow/HUBへの接続、会話内容からの自動感情推定、通知や会話の業務ロジックの変更は含みません。既存の承認画像、接続する表面、親子リグを維持し、局所形状キーと独立した制御層を追加しました。

V2現物はTwinowの `wordpress/themes/twinow-original/assets/aifate-companion.js`（参照HEAD `24b13afe49672b50db273d834b094a24214d2896`、ファイルSHA256 `675ce4f974bcac6706d9d028ef7e0626e02807855c1b432607059f114a0f110f`）と `retarget-motion-renderer.js`。読み取りのみで、変更していません。独立旧V3の `app.js`、`controls.json`、衣装台帳も照合しました。

|V2状態|V3の既定表現・動作|
|---|---|
|idle|中立、呼吸、瞬き|
|attention|控えめな微笑み、注目の小さな姿勢変化|
|thinking|内眉、控えめな口角、思考視線、抑えた呼吸と瞬き|
|speaking|独立した発話チャンネル。明示した感情を保持|
|happy|喜び：口角・頬・まぶた・眉と肩が連動|
|notify|驚きの局所口形と眉、短い肩の反応|
|concern / error|困惑・心配。通知処理やエラーの意味は変更しない|
|sleep|閉眼、首と肩を落ち着かせた休息|
|wake|閉眼から開眼し、既定時間で待機へ復帰|

`emotion.js`がV2入力を翻訳し、描画器や素材と独立して状態遷移を扱います。`setState(state,{duration,next,phase,calm})`の戻り値・既定時間（attention 920ms / happy 1100ms / notify 1500ms / error 2300ms / wake 760ms）、speaking→1800msでcalm→さらに3200msでhappyを維持。`duration:0,calm:false`で持続指定できます。同じstateを含む反復`setInputs`は遷移を再開始しません。隠れたタブから戻った場合は経過した遷移を追いつかせます。

独立ページのAPIは `window.hibikiV3`：

```js
hibikiV3.setState('speaking', {duration:0, calm:false});
hibikiV3.setEmotion('joy', .8); // 発話と共存。auto/nullで状態由来の感情に戻す
hibikiV3.setInputs({state:'thinking', gazeX:.55, gazeY:-.35, strength:.34});
hibikiV3.setPose({yaw:.3, gazeX:-.2, shoulderL:.1});
hibikiV3.setVolume(.5); // 0..1の外部音量。更新停止300ms後は口を保持しない
hibikiV3.blink(); hibikiV3.wink();
hibikiV3.snapshot();
```

V2の `aifate:companion-state` CustomEventも同じ`detail.state/options`で受けます。本体の`aifateCompanion`オブジェクトを上書きしたり、ページ間通信や本体連携を新設したりはしません。V2 rendererの `gazeX/gazeY/strength/state/speaking`、独立旧V3の `yaw/pitch/roll/gazeX/gazeY/mouth/shoulderL/shoulderR/intensity`を扱います。`eyeL/eyeR`等の別名にも対応。未知の状態はfalse、未知の低レベルパラメータは`setPose`結果のunsupportedで明示し、数値でない入力は適用しません。`setExpression`は既存neutral/joy/concern/anger/sadness/surprise/thinking名を維持します。

**表現拡張**：微笑み、笑顔、喜び、驚き、困惑、悲しみ、思考、照れ。眉上げ・内眉・眉寄せ・頬上げ・下向き口形・丸め口形を素材の輪郭に対応する独立キーとして保存しました。悲しみは原画の微笑みを残したまま角だけ動かさず、別に作った接触曲線に沿って上下唇を変形します。照れの色は透明な局所グラデーションを同じ面へ載せる手続き的素材です。完成顔の画像切替は行いません。感情・発話・視線・瞬き・首肩と呼吸を別に合成し、切替と復帰を平滑化します。

**音量・衣装**：既存AudioDriverを再利用し、端末内音声ファイルとテスト音の音量同期をプレビューへ戻しました。マイクを要求せず、ファイルを外部へ送りません。音声なしのspeakingは疑似口パクです。現物の衣装パックはsuit一種なので `setWardrobe('suit')`を維持し、未知の衣装は明示的に拒否します。他のパック画像をこの共有表面へ自動変換できる実装ではありません。

**実描画確認**：[表情比較](evidence/emotion-gallery.png)、[喜び＋発話](evidence/joy-speaking.png)、[検証記録](evidence/emotion-verification.json)。10状態・時間経過、感情と発話、複合姿勢と閉眼、タップの身体追従、静止を確認。端末内合成WAVとテスト音で音量同期を検証しています。PC Chromeの390px幅・タッチ再現であり、実機・Safariの確認ではありません。特に強い悲しみ、前髪に隠れる眉、歯／舌／口内の立体感、大きな顔向きは引き続き品質上の制約です。本人らしさや自然さの人間承認を代替しません。

再制作は既存画像を変更せず `bake-expression-keys.mjs`、確認は `verify-emotion.mjs`（いずれも既存Playwright/Chromeとローカルサーバー）を使います。オートデモは40秒で微笑み→喜びと発話→思考→驚き→落ち着き→困惑→悲しみ→照れと発話→笑顔で発話→中立を再生します。プレビューの状態選択は確認用に持続指定し、APIの既定復帰時間は変更しません。

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

従来公開版も保持しています。2026-10-22の追加で音量同期・V2状態入力はこのページへ対応しましたが、Twinow本体や利用先別衣装設定への接続は行っていません。Live2D同等品質・Identityの人間承認・V3完成とは判断しません。
