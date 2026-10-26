# Photoshop容量回復・不要物整理の証拠

記録者: Codex／実装エージェント。2026-10-26 JST。

## 確認した事実

- 開始時C空き: 620,281,856 bytes（0.578GiB）。
- Photoshop Temp313912048: 55,191,797,760 bytes。
- 開いていた98文書を保存・閉鎖。`save-close-log.jsonl` に全件の元名、保存先、サイズ、閉鎖を記録。保存直後の不存在0件。
- 元文書が未保存の場合は別PSDへ保全。元のJ/M/N/Oや正式Repositoryの未コミット変更を上書きしていない。
- Photoshop CC2018ではapp.quit()が存在せず失敗。その後executeAction(charIDToTypeID('quit'))の終了命令が受理され、PID12048の消滅と上記スクラッチファイルの不存在を確認。後からWindowsログで終了時のuiautomationcore.dllクラッシュを確認したため、正常終了完了との当初報告を訂正。Photoshop本体の強制終了はしていない。
- 通常終了後C空き: 63,908,343,808 bytes（59.52GiB）。
- 指定の補助サーバーPID16944/2108/2340は実行パスをphotoshop-mcp-envと照合。taskkill（/Fなし）が強制終了のみ可能と回答したため、3件だけStop-Processで終了。旧PID消滅を確認。環境ディレクトリ自体は残した。
- ヒストリー設定: 50→5。変更時と終了直前に読み取り確認。再起動後の確認は別記録。
- この退避で作成した終了済み試作・検査用PSD51件を削除。4,702,145,879 bytes。削除前一覧とSHAはdelete-manifest-owned-trials.csv、実削除結果はdeleted-files.jsonl。
- 51件削除後C空き: 68,611,665,920 bytes（63.90GiB）。WSL swap削除はClaude Codeによる別作業であり、この削除量には含めない。空き容量差には他プロセスの増減も含む。

## 残す資産と理由

- 現行組立PSD: ../hibiki-independent-parts-assembled-review.psd。独立パーツの最新制作成果。
- 最新頭部復旧元: saved-documents/doc-088.psd。現行デザインの顔・髪の元データ。
- saved-documents/doc-000～020.psd: 未保存だった旧復元文書。原画・J/M/N/O等の保護対象と重なるため保持。
- 原画・添付資料・現行パーツ素材・検証JSON・削除台帳・photoshop-mcp-envを保持。
- r1checkのbackup-e0audit-20261017-091706とbackup-featured-20261015-224131: 内容・サイズと作成経緯を調査。PIPELINE-AUDIT.mdはClaude Code作成と明記され、RESULT.mdもClaude作業ブランチの退避記録。自作と確定できず、ユーザーの他者データ削除禁止に従い削除していない。古い参照があることだけを保持理由とはしていない。release.tar 2件のサイズはr1check-archives-before.csv。
- 旧試作PSD33件・1,878,628,449 bytes: delete-manifest-superseded-psds.csvに一覧化。自動承認審査で一度拒否された後、ユーザーが「33件の削除を承認」と明示。承認後に全33件削除し、deleted-files.jsonlに追記。合計84件・6,580,774,328 bytesを削除済み。

## 再発防止・再開

../PHOTOSHOP-WORKFLOW.md と ../photoshop-disk-preflight.ps1 を既存作業場所へ追加。処理前後の20GiB判定、処理ごとの保存・閉鎖、20処理または1時間で通常終了、最新一組のみ保持を適用する。自動で他者文書を強制終了する機構は作らない。

制作は首・襟・髪の接合と可動用隠れ面が未完了。独立パーツPSDを一つだけ開いて再開する。顔とほくろ、目・眉の自然な非対称性を保持する。Cubismへの取り込み・モデル出力・公開は未実施。

## 再起動後の確認と制作継続

- 起動時にCRWindowsClientService.exe（Photoshop付属）の例外0xc0000005、COM起動失敗0x80080005を確認。PSDsを開く前の失敗で、制作処理は未実行。Windowsログをphotoshop-event-errors.jsonに保存。チャットのBad Requestと同一原因とは判定しない。
- 指定PID以外にも残っていた同じ補助サーバー3系統を実行パス照合後に終了。remaining-server-processes-stopped.jsonに記録。後にCodexが補助サーバーを再起動したため、常時停止済みとは扱わない。
- ユーザーによるPC再起動後、C空き66,817,712,128 bytes、Photoshop文書0、ヒストリー5を確認して制作再開。
- 衣装2パーツとリボン5パーツを上へ44px移動。首の毛束の前後順を襟に合わせ、首・襟の不要な露出をグループマスクで制限。
- 顎に必要な既存画素を独立グループに残し、修正前の頭部領域[0,0,1024,700]はRGBA差分0画素。neckline-face-integrity.jsonを参照。これは原画全体との差分ゼロや可動完成の証明ではない。
- 非表示の旧衣装・重複全身レイヤー14個を現行PSDから除去。内訳はremoved-obsolete-layers.json。最新の復旧用一組は../hibiki-independent-parts-recovery.psd、頭部の制作入力はsaved-documents/doc-088.psd。
- 現行PSDは../hibiki-independent-parts-assembled-review.psd。保存後に文書を閉じる運用へ変更済み。
