# 響V3 — PixiJSによる独自2Dリグ（制作中）

公開ページ：https://ankhaurum.github.io/avatar/ 。管理は Ankhaurum-Development #94（HV3-01〜07）。完成やHuman Acceptanceを示すものではない。Live2D Cubismは使わず、Live2Dのコード・素材・モーションも含めない。

## 素材
- 体・衣装・腕・手（休め・開く・振る）：ChatGPTのR3（`Hibiki_R3_Mesh_Mask_20261028`）。指さし・軽く握る手：同 Hand4 v2。`tools/prepare-r3.mjs` が半分の解像度で `parts/r3/` に取り込み、元ファイルのSHA256を `parts/r3/manifest.json` に記録する。前腕の素肌は手袋に完全に隠れるため取り込まない。
- 顔：承認原画A（`v3/artwork/hibiki-static-a.png`）から白目・虹彩・上下まつ毛・眉・唇をそのまま切り出した（`tools/extract-face.cjs`、輪郭は `tools/face-def.json`）。原画Aの下地は目・眉をPhotoshopのコンテンツに応じた塗りつぶし（`tools/fill-face-base.jsx`）、口を周囲の肌からの調和補間で埋め、まつ毛・眉はその下地との差分（アンブレンド）で取り出した。静止時の再合成は原画Aと最大差1.1/255。両目と口の中心を合わせた相似変換で頭の位置を決める。口の中（口内・上下の歯・舌）はR3。
- 頭の肌・首・髪：原画Aから原寸で切り出した（`tools/extract-head.cjs`）。前髪・横髪の下に隠れる額・こめかみ・頬の端は周囲の肌から補間で埋め、髪の層は「肌の上に目・眉・唇を描いた状態」との差分なので、ふつうの表情の静止時は原画Aと同じに見える（首の付け根より上で平均差1.3/255）。髪は前髪と左右に分け、境目は下の層を不透明のまま残して上の層だけを薄くした。首は原画Aの首を襟の下まで使い、原画Aでシャツの襟だった首の横は首の肌から補間で埋めて髪の下だけに置く。服に掛かる毛先は上の髪からつながる明るい青の毛束だけを残し、白い服の色を外した。左頬のほくろは原画Aのまま。R3の顔の下地・耳・髪は使わない。
- 座標の単位は原画Aの画素。原画Aの頭は原寸のまま使い、R3の体の方を頭の大きさに合わせて拡大している（R3の画素の約1.8倍）。
- 両手を体の前で重ねる腕：ChatGPTのポーズ画像 `Hibiki_V3_04_Hands_Low_Center_Native.png`（監督確認で合格）から、ほかの3ポーズと同じ方法で両腕一式を切り抜いた（顔・髪・胴体は使わない）。手の甲が正面で片方の手がもう片方に重なる形は、手の画像の回転や反転では作れないため。
- 胸に手を当てる・顎に手を添える・手を前に差し出す腕：ChatGPTのポーズ画像3枚（`Hibiki_V3_01_Chest_Native.png`／`02_Chin_Native_REVIEW.png`／`03_Reach_Native.png`、監督確認で合格）から腕一式を切り出した。`tools/cut-pose-arms.mjs` が `tools/pose-def.json` の輪郭点の間を、画像の色の境目に吸着する最短経路（マグネット投げなわと同じ考え方）でつなぎ、腕・手・指の輪郭に沿って切り抜く。顔・髪・胴体は使わない。`tools/prepare-pose-arms.mjs` が外周の背景色を外し、胸の宝石と肩フリルの位置を合わせた相似変換（縮尺約1.06・回転約−2°）でR3の座標へ写して `parts/pose/` に置く。肩とパフ袖はR3の肩フリルの下、前腕と手は胸のリボンや顔の手前に描く。

## 仕組み
- `tools/automesh.mjs`：透明部分の輪郭を追跡し、制約付きドロネー分割でメッシュを作る。目の縁・口角・毛先・裾は頂点を細かくする。
- `tools/build-rig.mjs`（`rig-builder.mjs`・`face-rig.mjs`）：ワープ・回転デフォーマの親子関係、パラメータごとのキーフォーム（変位関数から生成）、関節の2親混合、描画順の切替、物理を `hibiki.rig.json` に書き出す。
- テクスチャはミップマップと三線形補間で描き、縮小表示でも縁がざらつかない。
- `rig-eval.js`：キーフォームの多重線形補間、親子変形、減衰ばねの物理。`renderer.js`：PixiJS 8のMesh。透明部分を捨てるシェーダーでステンシルマスクを描き、虹彩を白目で、歯と舌を口内で切り抜く（既存V3のWebGL2描画の方式を引き継ぐ）。`motion.js`：呼吸・瞬き・視線・頭と体の追従・疑似発話・表情・身振り。
- 3つのポーズの身振りでは、ふだんの腕をポーズの位置へ動かし、重なった瞬間に1フレームでポーズの腕へ差し替える（戻りも同じ）。顎のポーズの間は頭の揺れを抑える。
- 向きと視線（`app.js`・`motion.js`）：画面上のアバターの位置から、体と顔を画面の中央へ向ける（右にいれば左へ、左にいれば右へ、中央なら正面）。位置や画面の大きさが変わればその場で付け直す。PCはページのどこにあるマウスでも目で追い、頭も少しそちらへ向ける。スマホはページのどこをタップしてもその位置へ目線を向ける（リスナーは受け身で、スクロールやボタンは妨げない）。操作が止まって約3秒で、配置に応じた向きと自動の目配りに戻る。トップの「配置」で左・中央・右を切り替えて確かめられる。
- 身振りは人の動きの原則で作った：肩→肘（0.05秒後）→手首（0.1秒後）の順に動き出し、動き出す前に小さな逆向きの予備動作、動き始めと止まりの緩急、止まったあとの小さな行き過ぎと戻り（余韻）を入れる。手を振る動きは前腕と手首の小さな往復で、手首が前腕より遅れてついていく。振る手はR3の手を手首で左右反転して使い、上げたとき手のひらが正面・親指が体の中心側を向く。
- 体の向き（Live2Dと同じ階層）：体の回転（BodyAngleZ、腰が支点）→ 上半身のワープ（BodyAngleX・BodyAngleY・呼吸）と下半身のワープ（BodyAngleX）→ 各部品。向きの量は位置ごとの1つの関数で決まり、腰から上ほど大きく、上半身と下半身が同じ関数を使うので腰の継ぎ目は連続する。脚は下半身より少なく同じ向きに動き、足先ほど小さい。腕・首・頭は上半身の子。向きの形は公式サンプルをBodyAngleX 10で公開APIから描画・測定して合わせた：胸の中心線（リボン・ボタン）は胴の半幅の約15%向く側へずれ、両端はほとんど動かない（手前の半分が広がり、奥の半分が細くなる）。体全体を平行移動させない。
- 顔の向き（Live2Dと同じ階層）：顔の回転（AngleZ、首の付け根が支点）→ 顔全体のXYワープ → パーツごとの変形。AngleX・AngleYでは、目・眉・口は形を保ったまま奥行き（口34・眉30・目28、輪郭0）に応じて平行移動し、奥の目はわずかに小さく、手前の目はわずかに大きくなる。肌（輪郭と鼻）だけをワープで丸く変形し（鼻が最も手前、輪郭は0）、向く側の輪郭は縮み反対側は広がる。肌と、その上に重なる前髪・横髪は、同じ「顔の面」（鼻が最も手前、顔の輪郭で0になめらかに落ちる奥行き）で動くので、髪が頬の上に乗ったり頬から離れたりしない。前髪は顔と同じかそれ以上に（毛先ほど手前に）ずれ、向いた側の横髪は少し多く頬を覆う方へ寄り、反対側の横髪は頬の外側の輪郭に残る。後ろ髪は少し遅れる。顔を30°向けると鼻は顔幅の約11%、上下30°で約7%動く（実測の目安：12%・7%）。横髪は原画Aでは顔より手前なので、目や口より手前に描く。前髪の左右の端は横髪と同じ奥行きにして、境目で切れないようにした。頭の下には、肌を横髪・頬・あご・耳の外側へ約30 px補間で広げた下地（head_under）を敷き、どの向きでも背景が見えない。鼻のハイライトは肌の一部として扱い、鼻と一緒に動く。肌の奥行きは顔の輪郭（鼻から左右に約130 px、あごまで約140 px）で0になり、頬とあごは横髪と一緒に動くので、向いても間に隠れていた肌が帯として開かない。横髪の下や首の横の補間した肌は、隣の見えている肌の色から外側ほど暗くなる陰影をつけた。
- 置かれた位置での向き：Live2Dのモデラーと同じく、向きは体が担う。画面の右に置くと体を範囲いっぱい（BodyAngleX 約−10）で画面の中央へ向けて保ち、頭は同じ向きに少し添えるだけ（AngleX 約−5.5）、目でこちらを見る（左は逆、中央は正面）。何もしないときの目配りもこの向きのまま。頭の角度はポインターやうなずきを含めて±24までに収める。
- 追従：ポインター（スマホはタップ）へ、目→頭→上半身の順に重ねて向く。置かれた位置の向きが土台で、ポインターが画面の外側にあっても頭と体は正面を越えて逆を向かない。上半身は物理演算で頭に少し遅れてついてくる。
- 視差：前髪・胸のリボン・胸の飾りは顔や胴より大きく、横髪・後ろ髪は小さく動き、平面でも回って見える。
- 髪の揺れ：頭の動き（左右・うなずき・傾き）の速さから前髪・横髪・後ろ髪が遅れて振れ、止まったあとに数回揺れて収まる。横髪の揺れは毛先（あごより下）に集め、頬の横の髪は頬に沿ったまま。
- バストアップ：頭から胸の下まで（公式サンプルのバストアップと同じ寄り方）。手を振る手が収まる幅にしている。
- 揺れもの：物理演算で、前髪・横髪・後ろ髪の毛先、肩のフリル、袖のリボン・肘のフリル・袖口、胸のリボン・胸の飾り、腰のリボン、スカートの上段と下段、左右の垂れ布と先端の飾り、脚の飾り・ブーツのリボンを揺らす。軽い髪やリボンは速く揺れてすぐ止まり、スカートや長い垂れ布はゆっくり長く、先端の飾りはその先でさらに揺れる。
- 白目：黒目の跡を埋めた部分の明るさの差をなくし、一枚の白目として作り直した（`tools/remake-white.mjs`）。原画Aの見えている白目の色から、中央は澄んだ白、目頭と目尻はわずかに赤み、上はまぶたの影でやや暗い陰影を付けた。
- 頭：首の付け根を支点に、傾き・左右・上下で頭全体が回る。下を向くと頭が少し下がって前へ出て、顔の部品が下へずれて額が多く見え、あごが引ける。うなずきは、すっと下げて少し弾み、もう一度下げて戻す動きを2回、視線も少し下げる。
- 表情：既定は自然なほほえみ。口は原画Aの閉じた唇を基準に、閉じた普通・閉じた笑顔・開いた普通・開いた笑顔の4つのキーフォームを補間する。笑顔のキーフォームは、Codexの基準（`studies/continuity/evidence/default-smile-close.png`）を両目の虹彩の中心で原画Aにそろえ（縮尺0.609）、その上唇の山・上唇の内側・口角・下唇の内側と下の弧の輪郭に、唇の頂点を置き直して作った。既定の開き（0.6）で基準の輪郭に一致し、閉じると同じ唇の形のまま1本の合わせ目で閉じきる。頬が上がり、下まぶたも上がる。話すときは一音ごとに開いて閉じ、口の中のマスクは開きが0なら面積0。
- 口の中：Codexが作り直した口内素材（`studies/continuity/materials` の smile-local.png・oral-cavity.png・tongue.png）を使う。`tools/prepare-oral.mjs` が smile-local.png から上の歯の並びだけを唇の内側の線で切り出す。歯と歯の間も基準の明るい色のまま1枚のまとまりとして使い、口の両端に近い所だけ口の中の暗さが見える。歯の並びは1枚のまま動き（歯ごとに引き伸ばさない）、上端は上唇の内側の縁を通るなだらかな曲線に沿い、下端は下唇の内側に重なる。口の中のマスクは唇の内側の輪郭から1 pxだけ唇の下に入り、唇のやわらかい内側の縁で隠れる。上下の唇の部品は原画Aの口の線で画素の行ごとに分かれていたので、`tools/feather-lips.mjs` で境目を3.5 pxの幅でなめらかにぼかし、口の線に沿って頂点を細かく置いた（合わせ目と歯の境目がなめらかな曲線になる）。口角から口の幅の4分の1までは上下の唇が合わさったまま開かないので、口角は唇と肌だけで終わる（歯の並びの両端も透明にした）。笑顔そのものは原画Aの唇のメッシュ変形で作り、素材の唇は使わない。
- 目：上まつ毛の部品から黒目の縁（下地との差分で混じった縦の線と上側の弧）を取り除いた（`tools/clean-lash.cjs`）。瞬きは、閉じる量をまぶたに沿ってなめらかにつなぎ、目尻・目頭の外のアイラインも一緒に下ろすので、上まつ毛の端が下まつ毛の端に重なって閉じきる。白目は閉じると目尻まで高さ0になる。笑顔（下まぶたが上がる）と組み合わせても閉じきる。
- 手：身振りごとに、手のひらの向きと親指の側を人の体の動きとして決め、描かれた手をそのまま使うか手首で反転するかを選ぶ（振る・横へ差し出す・腰の前の両手・指さしは反転、休め・軽く握るはそのまま）。手の色は原画Aの頬と首の肌の平均に合わせ、反転した手は列ごとの明るさを元の向きに戻して光の向きを揃える（`tools/hand-tone.mjs`）。
- 瞬きは上まつ毛のメッシュを下まぶたへ曲げて閉じる。閉じ目の線は描いていない。
- 動きの量は、公式サンプルの頂点を公開APIで実測した比率を目安にした（`docs/reference-measurements.md`）。

再生成：`cd hv3/tools && npm install && node build-rig.mjs`。確認用の固定姿勢表示は `dev.html?view=bust&p={"EyeLOpen":0}`。

## 未達・制約
- 顔の表示は原画Aの約2倍までに抑えている。
- 髪を大きく揺らすと、髪の下を補間で埋めた肌が見える（描き直しはしていない）。
- 音声との同期は無い（口の動きは疑似発話）。

## パッケージの使い方（`hv3/hibiki-avatar.js`）
HUB・Twinow・オウンドメディアで共通に使う部品として、表示・視線・向き・動きの量・スクロール中の半透明・全身／バストアップの切り替えを1つの関数にまとめた。各サイトは設定を渡すだけで、見た目はCSSで上書きできる。

```js
import { mountHibikiAvatar } from './hv3/hibiki-avatar.js';
const avatar = await mountHibikiAvatar(document.querySelector('#avatar'), {
  view: 'bust',                 // 最初の表示：'bust'（バストアップ）／'full'（全身）／'face'（顔）
  chat: false,                  // true：チャットの中。バストアップに固定し、切り替えボタンを出さない
  viewToggle: true,             // 待機中のアバターの角（体・顔・手に重ならない角を自動で選ぶ）に「全身／バストアップ」のボタンを出す
  rememberView: 'hibiki-view',  // 選んだ表示を覚える localStorage のキー（false：覚えない）
  scrollFade: { enabled: true, opacity: 0.35, restoreMs: 600 }, // スクロール中の半透明：オン・オフ、透明度、止まってから戻るまでの時間（ミリ秒）
  motionSize: 'auto',           // 動きの量：'auto'（表示の大きさから自動）／0（大きい表示向け）〜1（小さい表示向け）
  facing: 'auto',               // 向き：'auto'（ページ上の位置から）／-1（左に置いた）〜1（右に置いた）
  autoplay: true                // false：step(dt) を呼ぶまで止めておく（試験や録画用）
});
avatar.motion.gesture('wave'); avatar.setState('happy'); avatar.motion.talk(2);
avatar.setView('full'); avatar.setScrollFade({ enabled: false }); avatar.setViewToggle(false); avatar.destroy();
```

- 表示の大きさと動き：アバターが描かれている高さが200 px以下で最も大きく、520 px以上でLive2Dの標準に近い量になる。方針「体で向けて、顔は正面寄り、目でこちらを見る」に合わせ、頭の動き（追従・待機中の揺らぎ・身振りに伴う頭の動き）は大きさで変えず、小さい表示では体の向き（範囲いっぱいの±10まで）・体の揺らぎ・身振りに伴う体の動き・揺れもの（揺れる幅）を大きくして伝える。頭の角度は髪の崩れが無いと確かめた±24の範囲に収める。
- 動きを減らす設定（prefers-reduced-motion）：自動デモを止め、待機中の揺らぎを半分、揺れものを控えめにする。
- スクロール中の半透明：ページ（またはスクロールする親要素）がスクロールしている間だけ半透明にし、止まって `restoreMs` 後に戻る。
- 全身／バストアップのボタン：選んだ表示を覚え、次に開いたときもその表示になる。保存できない環境（プライベートブラウズ等）では、その場の切り替えだけ行い、表示は壊れない。切り替えても、視線の追従と配置による向きはそのまま続く。
- CSSで上書きできる値（ホスト要素か、その親に指定する）：

| 変数 | 内容 | 既定 |
|---|---|---|
| `--hv3-scroll-opacity` | スクロール中の不透明度 | 設定の `scrollFade.opacity` |
| `--hv3-fade-out` | 半透明になるまでの時間 | `0.18s` |
| `--hv3-fade-in` | 元に戻るまでの時間 | `0.35s` |
| `--hv3-toggle-bg` ／ `--hv3-toggle-fg` ／ `--hv3-toggle-border` | ボタンの背景・文字・枠の色 | 白・紺・淡い灰 |
| `--hv3-toggle-radius` ／ `--hv3-toggle-font-size` ／ `--hv3-toggle-inset` | ボタンの角丸・文字の大きさ・右下からの位置 | `999px` ／ `13px` ／ `8px` |

ボタンには `hv3-view-toggle`、スクロール中のホストには `hv3-scrolling` のクラスが付くので、細かな見た目はこれらのクラスでも上書きできる（パッケージのCSSは `:where()` で詳細度0）。

## V2の感情表現の入力（`hv3/emotion.js`）
Twinow のコンパニオン（V2）と同じ入口・同じ形で状態と感情を受け取り、響V3のパラメータ（目・眉・口・笑顔・頭・体・肩・視線）のメッシュ変形で表す。画像の差し替えはしない。HUB と Twinow で分岐させない。Twinow 本体・HUB 本体のコードは変更しておらず、組み込みもしていない。

```js
avatar.setState('thinking', { duration: 0 });          // 本体の setState(state, options) と同じ
dispatchEvent(new CustomEvent('aifate:companion-state', { detail: { state: 'happy', options: {} } }));
dispatchEvent(new CustomEvent('aifate:companion-chat-lifecycle', { detail: { phase: 'complete', anchor: null, emotion: 'happy' } }));
avatar.chatLifecycle({ phase: 'complete', emotion: 'concern' }); // 同じ処理を関数で
avatar.setEmotion('sadness');  // 確認用：状態の感情を上書き（'auto' で状態に合わせる）
avatar.getSnapshot();          // { state, phase, emotion, history, speaking, … }
avatar.states;                 // 10状態
```

`listen: false` を渡すと window の合図を受け取らない（同じページに本体のコンパニオンがいるときなど）。未知の状態・値は無視して `false` を返し、表示は変えない。

### 入口一覧（本体のどのコードに合わせたか）
照合した本体：Twinow `19f0db4`（`wordpress/themes/twinow-original/assets/`）。

| 入口 | 本体のコード | このパッケージ |
|---|---|---|
| 10状態 | `aifate-companion.js:39` `STATES = idle, attention, thinking, speaking, happy, notify, concern, error, sleep, wake` | `emotion.js` `STATES`（同じ並び） |
| `setState(state, options)` | `aifate-companion.js:123` `MotionEngine.setState`：未知の状態は `false`。`options.duration` 未指定時の長さ attention 920 / happy 1100 / notify 1500 / error 2300 / wake 760 ms、`options.next`（既定 idle）、`options.phase`。speaking は 1.8 秒で落ち着き（calm）、さらに 3.2 秒で happy（`options.calm === false` で無し） | `Performance.setState`（同じ規則）、`avatar.setState` |
| `aifate:companion-state` | `aifate-companion.js:267` `detail.state` / `detail.options` を setState へ。送る側 `conversation.js:17` | `hibiki-avatar.js` が window で受ける |
| `aifate:companion-chat-lifecycle` | `aifate-companion.js:256`（受信）、`:242–253` `chatLifecycle`：thinking / speaking はその状態（duration 0）、complete は emotion が happy / concern / notify ならその状態、ほかは speaking を 80 ms 後に、最初に置いてから最低 2 秒（完了から最低 0.8 秒）の余韻のあと idle。dismiss は idle。送る側 `conversation.js:16`、送信時 `:28` thinking、返事 `:32` speaking（`r.emotion` 無しは speaking）、完了 `:40` complete | `avatar.chatLifecycle`（close / dismiss は idle） |
| 押したとき | `aifate-companion.js:256` ボタンの click で attention 920 ms | アバターを押すと attention 920 ms（表示切り替えボタンは除く） |
| マウスを重ねたとき | `aifate-companion.js:144` 細かいポインターの pointerenter で attention 920 ms | 同じ |
| 考え中の視線 | `aifate-companion.js:100` thinking で視線を右上へ | thinking の視線を右上へ |

時間は描画のフレームで進む1本の時計で数える（実表示では実時間と同じ。`step(dt)` で録画すると同じ流れが再現される）。

### HUB の感情値
照合した HUB：`ankhaurum/Aifate-HUB` `e84ae6b`（読むだけ）。

| 出どころ | 値 | 扱い |
|---|---|---|
| 公開の会話API `src/Application/ConversationService.php:47` `publicAnswer` | 返す項目に emotion が無い（status, conversationId, reply, intent, suggestedReplies, candidateRefs, handoff, limitations） | Twinow は `r.emotion || 'speaking'` なので speaking として扱う |
| HUB 管理画面 `public/admin/assets/companion.js:310` `emotionFor` | `concern` / `happy` / `notify` / `speaking` | 完了時：happy・concern・notify はその状態、speaking は speaking |
| HUB 設計文書 `hub/docs/architecture/hibiki-companion-hybrid-v3-neo-line.md:39` | `NEUTRAL, HAPPY, CONCERN, THINKING, NOTIFY, SPEAKING`（未知は SPEAKING） | 状態として来たものは同名の状態へ。感情として `setEmotion` に渡すと neutral / joy / concern / thinking / surprise / 状態に合わせる |
| 上記以外の値 | — | 無視（完了時は speaking、`setEmotion` は `false`） |

### 状態ごとの表し方
感情の表は Codex の `studies/continuity/emotion.js`・`affect.js` と README の V2 の節を土台に、響V3のパラメータで作り直した。顔は正面寄りのまま（首の傾きは最大 ±6°）、気持ちは体の前後・左右の傾き、肩、揺れもので出す。小さい表示ほど体と肩の動きを大きくする（最大 1.8 倍）。

| 状態 | 感情 | 顔 | 体 |
|---|---|---|---|
| idle | smile（これまでの既定の顔と同じ値） | 笑顔、上の歯が少し見える | 待機の揺らぎ |
| attention | gentle | 穏やかな笑み、視線を正面へ | 一瞬前に乗り出してうなずくように顔を上げる |
| thinking | thinking | 笑みを消し、眉を寄せ、視線を右上へ | 少し引き、首をかしげる。呼吸を浅く |
| speaking | smile | 笑顔で口の開け閉め（どの感情でも唇が閉じ切る） | — |
| happy | joy | 満面の笑み | 体を反らせ弾むように揺れ、肩が開く |
| notify | surprise | 眉を上げ目を開く（一度驚いて落ち着く） | 体を起こし、肩を一度上げる |
| concern / error | concern | 笑みを消し、眉尻を下げる | 少し前かがみに傾け、肩をすぼめる |
| sleep | neutral | 目を閉じ口を閉じる | うつむき、肩を落とし、呼吸をゆっくり |
| wake | gentle | 0.76 秒で目を開く | — |

確認ページの「状態」「感情」の行で各状態・感情を、「会話」の行でチャットの流れ（送信 → 考え中 → 話す → 完了の感情 → 待機）を、本体の conversation.js と同じ合図を送って再生できる。
