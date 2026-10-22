# Editor操作と解析経路の切り分け（2026-10-22）

## 2026-10-23 再検証：API復旧、画面取得は未復旧

- セッション1は今回console/Active。Editorと操作側も1。前回のDisc／console2という状態は解消している。正規接続の状態変化は確認できたが、それだけではキャプチャは復旧しなかった。
- 既存FREE版の最小化解除（activate_window）は成功。前回のGetCursorPos 0x80070005は今回再現せず。Ctrl+Oも「開く」ダイアログを表示したため、すべての入力が拒否される状態ではない。
- キャプチャはFrameArrived timeout、再選択後もwindow capture timeout。今回0x80070057を再現したわけではない。画像なしUIAはタイトル／システムメニュー／「開く」まで取得、Javaの編集パレットとファイル名欄は取得できない。最大化ボタンへのUIA操作はcached boundsなしで不成立。盲目的な座標入力、別キャプチャ実装による迂回、強制移送・再起動はしていない。
- ユーザーによる外部連携ONの後、Editor PIDの22033待受けを確認。公式WebSocket RegisterPlugin成功、ユーザーの「Codex Hibiki Research」許可後GetIsApproval=true。ECONNREFUSEDは解消。ファイアーウォール／権限設定をCodexが変更したわけではない。
- GetDocumentsは初回空。ユーザーがケイを開いた後、公式GetParameters 1.0.1／GetParameterGroupsで27パラメータとキー値、所属グループを直接取得。顔XY/Zと身体XY/Zは別軸、眼開閉・笑い眼・視線も別軸。口開閉には中間キーがあり、両端の形だけを線形に混ぜる構造と同一ではない。これはパラメータ上のキー位置であり、ArtMeshのキー頂点を取得したという意味ではない。
- APIトークンはメモリ内のみ。解析記録・Git・コメントへ出力しない。元モデルは読み取りのみで保存・変更していない。

### 追加解析の範囲

|手段|新しく確認|引き続き未確認|
|---|---|---|
|Editor公式API|ケイbasic FREEの実パラメータ／グループ／キー位置|ArtMeshキー頂点・デフォーマ親子・Glue重み。公開APIに取得命令なし|
|公式SDK|Haru・Izumi・まお・ケイの眼開閉×笑い眼×視線、半閉眼から全閉眼・復帰の5姿勢を描画比較。全モデルで対象5軸の存在を確認|Editorの制作側階層、元PSD全構成|
|REA|公開cubismeyeblink.jsとcubismmotion.jsの静的解析。親Evidence ev_2aec0d7ab5d04b7e71ffecece7e3179444d369823b9df11262f5cd64fd04c708、PARTIAL|動的実行・非公開Core。プロパティ起点の追加トレースは一致0で、呼出関係の解明とは扱わない|

原文照合では瞬きの閉じる／接触／開く段階と、モーションの眼パラメータに瞬き値を乗算する処理を確認。SDK画像でも笑い眼を保持して閉眼できる。響では感情の眼開度と瞬きを同じ高速応答に通していたため、感情眼開度を頬・笑い眼に近い速度で遷移させ、最後に独立した閉眼係数を合成する独自処理へ変更。遅いフレームが接触区間を跨いだ場合も閉眼を一度描く。口・歯・素材・身体の形状データは維持し、他社の形状や実装を移植していない。

証拠は既存の非公開調査領域 `editor-api-key-observation.json`、`rea-eye-composition.json`、`eye-composition-observation.json`、4モデルの `*-eye-composition.png`。他社モデル画像は公開avatarへ追加しない。

次の解析論点は、Haru／Izumi／まおをEditorで開いた際のキー配置と、画面取得復旧後の個別ArtMesh・親デフォーマ・接合の対応。API復旧をGUI復旧や4モデルの完全制作構造確認と同一視しない。

## 確認結果

|対象|事実／再現|原因候補・未確定事項|回避／復旧手順|
|---|---|---|---|
|画面取得 0x80070057|前回のCreateForMonitor失敗。今回はWindowsセッション1がDiscのまま、Editorと操作側も1。コンソールは2|切断セッションのキャプチャ対象モニター不成立が候補。再接続前後の比較はできておらず、因果関係は未確定。Editor固有障害とも断定しない|元のセッション1へ正規に再接続後、同じウィンドウで再確認。SDKの隔離ブラウザー実描画は利用可能|
|有効化 0x80070005|今回、Editorのみを対象にactivate_windowを実行しGetCursorPosアクセス拒否を再現|入力デスクトップ不一致／ウィンドウステーションの読取り権限が候補。実際のACL差は未確認|画面取得とは独立の障害。権限を広げたり認証を回避せず、元の対話セッションへ復帰後に再検証|
|ECONNREFUSED|127.0.0.1と::1の22033で接続拒否。EditorのPIDにTCP Listenなし。該当ログにAPI待受け開始・BindExceptionの記録なし|API未起動／接続スイッチOFFが候補。実設定は画面未確認なのでOFFと断定しない。トークン認証以前の段階|公式のFile→外部アプリケーション連携設定で接続ON、同一PCでポート確認後、正規のアプリ許可。リモート接続を開放する必要はない|
|画像なしアクセシビリティ|Editorのタイトル・システムメニュー等は取得できたが、モデル編集領域は出ない|プロセス発見／トップレベル読取りは可能。Javaのモデルパレットまで操作可能とはいえない|制作側の階層確認をSDKのPart所属で代用しない|

EditorはResponding=true、ログにはIntel OpenGL 4.6の初期化記録がある。ソフト未起動やOpenGL初期化不能と判断する根拠はない。ログのHome画面JSON処理エラーと上記OS/API障害の因果関係も未確認。Editorの再起動・重複起動、モデル保存、セッション終了、OS権限変更はしていない。

セッション復帰のための強制的なセッション移送は、接続中のコンソールへの影響と必要権限を確定できないため実行していない。復旧したとは報告しない。元のユーザーセッションへの通常の再接続が、残る因果検証の前提になる。別ブラウザー画面を使ったComputer Useの比較は前回の安全停止を尊重して繰り返していない。

## 解析経路と4モデル

REAは公開JavaScriptの静的関係を解析でき、SDKでの実描画は公開APIの現在の頂点・描画順・マスク・パラメータ応答を観察できる。どちらもEditorの全デフォーマ階層、作者の全キー形状、Glue設定、PSD全ツリーを自動的に復元するものではない。REAのPARTIALは調査範囲の表示であり、接続失敗ではない。

|モデル|確認済み（既存証拠）|未確認|
|---|---|---|
|ケイ basic FREE|以前のEditor部分観察、SDK ArtMesh出力・局所身体変形、顔XY×笑顔×開口の途中描画|全階層、全キー、Glue重み、PSD全ツリー|
|Haru|SDKメッシュ／素材対応、姿勢別腕とPose切替、顔XYの非加算出力、物理追従、表情×開口|Editorの制作側階層・キー・Glue・PSD全ツリー|
|Izumi|SDK顔／視線／眼、顎と襟の裏に続く首、身体局所変形、髪追従、口と斜め向き|同上。重なりだけではGlue使用の証拠にならない|
|虹色まお|SDK母音Blend Shape型、口内マスク、身体形状、髪追従、Aと斜め向きの途中描画|同上。runtime Part所属はデフォーマ階層ではない|

今回は復旧したEditor経路からの新規モデル構造確認はない。既存REA物理解析のEvidence `ev_6ad7a25ef61a26a26637100767620ff2d604d2710e22a81eb8b85ca8df71383c` と公開Frameworkの経過時間処理を再利用し、響の実装を点検した。

## 響へ反映した改善

`BustDynamics` は描画間隔が100msを超えると積分時間を100msに切り捨て、200msを超えると髪の慣性を消していた。`MotionResponse` も頭と身体の追従時間を100msへ制限していた。このため遅いフレームで反応が鈍り、二次動作が失われる原因になっていた。

500ms以下の経過時間は上限1/120秒の小区間に分けて処理し、頭・身体も実経過時間へ追従する。長い休止／タブ復帰では再基準化して速度の急増を防ぐ。Cubismの物理式・係数の移植ではなく、経過時間と描画頻度を分離する原則の適用である。素材・振幅・リグ階層・V2入力契約は変更していない。

250msの入力で旧版は髪応答0、新版は応答を保持する。一定速度入力の60fps刻みとの一致と長い休止を回帰確認し、実描画デモも記録した。この試験は実機スマホのFPS測定や人間の自然さ評価ではない。

## 公式根拠

- [Microsoft GetCursorPos](https://learn.microsoft.com/ja-jp/windows/win32/api/winuser/nf-winuser-getcursorpos)：入力デスクトップとWINSTA_READATTRIBUTESの条件。
- [Microsoft query session](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/query-session)：セッション状態の確認。
- [Microsoft tscon](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/tscon)：接続権限と接続先切替による切断への影響。
- [公式外部アプリケーション連携](https://docs.live2d.com/cubism-editor-manual/external-application-integration/)：接続スイッチ・標準ポート22033・アプリ許可。
