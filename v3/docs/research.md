# HV3-01 — 制作判断の根拠

対象: [#96](https://github.com/ankhaurum/Ankhaurum-Development/issues/96)。2026-10-23、ユーザーが7Blockと監査を採用し実装着手を指示。これは最終モデルの品質認定ではない。

## 確認したことと制作への意味

|根拠|確認できた範囲|新モデルへの反映|確認できていないこと|
|---|---|---|---|
|名執尽の公式SDK描画、Editorパラメータキー取得|176描画要素、32Parts、96パラメータ。腕A/B/Eの素材群とpose表示切替。手首入力では剛体相似変換だけで説明できない形状変化もある|腕の運動学と、輪郭・袖口・手の見え方を別々に制作する。別姿勢のフェードを肘屈伸の代用品にしない|作者の全デフォーマ階層、Glue対応頂点・重み、頂点キーフォーム|
|Haru、Izumi、まお、ケイの既存SDK描画とEditorキー取得|中間キー、非対称キー、顔XY複合入力の非加算的な出力、口の母音・感情分離、部位別物理応答|変形の問題が出る区間を中間姿勢として造形。全体格子に一律の推測係数を加えない|全組合せの作者補正、造形の作業履歴|
|REAによる公開Frameworkのmotion/physics/pose静的解析|限定対象の時間曲線・追従・表示制御。coverage PARTIAL|時間制御と形状評価を別責務にする|非公開Coreの形状補間式。限定viewのcompleteは全面解析完了ではない|
|Editor Javaの選択クラス調査|REA識別とCFR 0.152による補助静的再構成。runtime_validation=false。一部依存警告・構造化失敗あり|用語と処理責務の照合に限定。再構成コード・係数を独自エンジンへ転用しない|実行時の全経路・全モデルの実証|
|[公式デフォーマ説明](https://docs.live2d.com/en/cubism-editor-manual/deformer/)|大きな回転を座標の直線補間だけで行うと途中形状が縮む|回転階層と局所キーフォームを分ける|個別サンプルの作者階層|
|[公式Glue説明](https://docs.live2d.com/en/cubism-editor-manual/glue/)|対応頂点の接合、頂点別weightとキー別compatibilityの区別|接合は明示的な対応点として保存。単なる画像重なりと区別|響に必要な対応点位置・影響帯は響の造形で制作する|

## 追加調査と制作環境

- REA JEB接続は現在 capability_unavailable / unsupported_provider（localhost:8425接続失敗）。過去のCFR成果をJEB実行成果に読み替えない。
- [安定版の公式API](https://docs.live2d.com/cubism-editor-manual/external-application-integration-api-list/)による既存取得はパラメータキー。ArtMeshの頂点キーとは異なる。
- [5.4 alpha1 API](https://cubism.live2d.com/editor-alpha/doc/manual/alpha1/ja/external-api-intergration/index.html)にはGetDeformerStructure/GetObject等があるが、導入済み5.3.04の機能として扱えない。alpha版への移行・モデル変換は今回行っていない。
- Photoshop CC 2018（19.0.0）とPhotoshop MCPの実接続を確認。既存のPSD保存・再読込テストはツール疎通の証拠であり原画完成ではない。現在のMCPから直接JSXを実行可能。
- 既存JavaScript/WebGL環境を利用できる。Cubismランタイムを独自モデルの依存にしない。他社サンプル、cmo3、moc3、逆コンパイル出力を配布しない。

作者の内部データ未取得は残す。独自モデルの階層・形状・接合は、確認済みの公開原則と実描画観察を根拠として新しく設計・制作する。未取得の作者データを想像で復元したと称さない。

## 再利用資産の判断

|資産|判断|
|---|---|
|assets/approved-front.png|Identityの基準。顔立ち、青いボブ、目、ほくろ、白青衣装を直接視認。元ファイルを保存し、原画の参照として使う|
|既存iris、閉眼、口内、承認済み手の素材|個別候補。色・輪郭・隠面と新しいパーツ座標の適合を確認してから採用。存在だけで再利用確定としない|
|continuityの一体surface・共通格子・腕補修|新モデルの起点にはしない。欠陥と既存機能の比較資料として保存|
|未追跡studies/psd-model、未コミット腕IK補修|正式7Blockの制作物として不採用。旧試作を上書き・削除せず今回のコミットから除外|
|発話入力・音声再生の既存機能|HV3-06で契約と挙動を評価し再接続。既存公開版は維持|

## 次工程への引渡し

HV3-02で完成姿勢から部品・隠面・階層・接合・描画順を対応付ける。PSD→PNG/レイヤー対応→メッシュ/キーフォーム→独自評価→描画を一つのデータ経路として設計する。HV3-04から途中姿勢の実描画を確認する。参考モデルの頂点数、キー数、可動角を響の固定要件にしない。

解析証拠のファイル名・SHA256・確認範囲は隣接するresearch-evidence.jsonで追跡する。記載されたローカル証拠は履歴資産であり、GitHubから閲覧可能な配布物と区別する。自然さ、独自モデル実描画、全7Block、Human Acceptanceは未達。
