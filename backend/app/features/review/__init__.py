"""复习 feature。

先完整加载 `anki.collection`：Python 3.14 + anki 26.09 下，直接导入
`anki.cards` 会触发 collection ↔ cards 的循环导入。
"""

import anki.collection  # noqa: F401
