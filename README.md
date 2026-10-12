# 波の3つの見方（仮称）

生徒が撮影した波の動画と、手描き作図の連番写真から、y-x図・y-t図・ぱらぱら漫画を連動して見せる高校物理のWebアプリ。

- 段階：仕様検討中（仕様 0.1）
- 仕様書：[docs/README.md](docs/README.md)
- 共通の前提：[docs/common/](docs/common/)（全アプリ共通の仕様書群からの写し）

## フォルダ構成

```
.
├── README.md          この文書
└── docs/              仕様書
    ├── README.md      概要・決定事項・引き継ぎ
    ├── 01-requirements.md
    ├── 02-yt-animation.md
    ├── 03-flipbook.md
    ├── 04-lesson-design.md
    ├── 05-open-issues.md
    ├── CHANGELOG.md
    └── common/        concept.md / platform-constraints.md / spec-conventions.md
```

実装を始めたら、`src/` を編集し、`build.py` で直下に単一の `index.html` を生成する。GitHub Pages でリポジトリ直下を公開する（WAVE-N-08）。
