"""后台题库编辑：题目增删改、题号重排、证据截图与 Anki 卡片同步。

题目内容以 `backend/data/study/*.json` 为准；这里负责把专题 JSON、index.json、
search 字段和 Anki note 一起改到一致状态。编辑只改 note 字段，不动调度状态；
删除题目会删除对应卡片。
"""

from __future__ import annotations

import copy
import logging
from typing import Any

from app.core.config import settings
from app.core.errors import AppError
from app.core.paths import safe_join
from app.features.media import service as media_service
from app.features.review import service as review_service
from app.features.study import admin_fields as fields
from app.features.study import admin_views as views
from app.features.study import repository
from app.features.study.admin_schemas import (
    AdminQuestion,
    BankListResponse,
    BankQuestionRow,
    CreateQuestionRequest,
    DeleteQuestionResponse,
    EvidenceUploadResponse,
    QuestionMutationResponse,
    QuestionWrite,
)

log = logging.getLogger("app.study.admin")

_BANK_LIMIT = 400


def _topic_or_404(topic_id: str) -> dict[str, Any]:
    topic = repository.load_topic(topic_id)
    if topic is None:
        raise AppError("专题不存在", code="not_found", status=404)
    return topic


def _question_at(topic: dict[str, Any], qid: str) -> tuple[int, dict[str, Any]]:
    for index, question in enumerate(topic.get("questions", [])):
        if question["id"] == qid:
            return index, question
    raise AppError("题目不存在", code="not_found", status=404)


def list_bank(topic_id: str = "", keyword: str = "", limit: int = _BANK_LIMIT) -> BankListResponse:
    index = repository.load_index()
    topics = [views.topic_option(topic) for topic in index["topics"]]
    selected = index["topics"]
    if topic_id:
        selected = [topic for topic in index["topics"] if topic["id"] == topic_id]
        if not selected:
            raise AppError("专题不存在", code="not_found", status=404)
    needle = keyword.strip().lower()
    rows: list[BankQuestionRow] = []
    for topic in selected:
        for question in topic.get("questions", []):
            haystack = question.get("search", "").lower()
            if needle and needle not in haystack and needle not in question["title"].lower():
                continue
            rows.append(
                BankQuestionRow(
                    key=question["key"],
                    topic_id=topic["id"],
                    topic_label=topic["label"],
                    id=question["id"],
                    no=question["no"],
                    title=question["title"],
                    pages=question.get("pages", ""),
                )
            )
    capped = max(1, min(limit, _BANK_LIMIT))
    return BankListResponse(
        topics=topics,
        questions=rows[:capped],
        total=len(rows),
        limited=len(rows) > capped,
    )


def get_question(topic_id: str, qid: str) -> AdminQuestion:
    topic = _topic_or_404(topic_id)
    _, question = _question_at(topic, qid)
    return views.question_detail(topic, question)


def _save_topic_and_index(topic: dict[str, Any]) -> None:
    index = copy.deepcopy(repository.load_index())
    views.refresh_index(index, topic)
    repository.write_topic(topic["id"], topic)
    repository.write_index(index)


def _best_effort(sync: Any, action: str) -> tuple[bool, str]:
    try:
        return bool(sync()), ""
    except AppError as exc:
        log.warning("%s失败：%s", action, exc.message)
        return False, f"题库已保存，但{action}失败：{exc.message}"
    except Exception:  # noqa: BLE001 - 题库已落盘，卡片同步失败不应回滚内容
        log.exception("%s失败", action)
        return False, f"题库已保存，但{action}失败，请稍后重新保存一次。"


def create_question(payload: CreateQuestionRequest) -> QuestionMutationResponse:
    topic = _topic_or_404(payload.topic_id)
    question_fields = fields.validate_question(topic, payload)
    no = len(topic["questions"]) + 1
    qid = f"q{no:03d}"
    question: dict[str, Any] = {
        "key": f"{topic['id']}/{qid}",
        "no": no,
        "id": qid,
        **question_fields,
    }
    topic["questions"].append(question)
    topic["count"] = len(topic["questions"])
    _save_topic_and_index(topic)

    synced, notice = _best_effort(
        lambda: review_service.sync_bank_create(topic, question), "复习卡片创建"
    )
    return QuestionMutationResponse(
        question=views.question_detail(topic, question), card_synced=synced, notice=notice
    )


def update_question(topic_id: str, qid: str, payload: QuestionWrite) -> QuestionMutationResponse:
    topic = _topic_or_404(topic_id)
    _, question = _question_at(topic, qid)
    question.update(fields.validate_question(topic, payload))
    topic["count"] = len(topic["questions"])
    _save_topic_and_index(topic)

    synced, notice = _best_effort(
        lambda: review_service.sync_bank_update(topic, question), "复习卡片同步"
    )
    return QuestionMutationResponse(
        question=views.question_detail(topic, question), card_synced=synced, notice=notice
    )


def _delete_files(topic: dict[str, Any], question: dict[str, Any]) -> None:
    for group in question.get("evidence", []):
        for file in group.get("files", []):
            try:
                path = fields.public_file(topic, file["file"])
            except AppError:
                continue
            if path.is_file():
                path.unlink(missing_ok=True)


def _rename_evidence(
    topic: dict[str, Any], question: dict[str, Any], old_no: int, new_no: int
) -> None:
    prefix = f"q{old_no:03d}_"
    for group in question.get("evidence", []):
        for file in group.get("files", []):
            public = file["file"]
            name = public.rsplit("/", 1)[-1]
            if not name.startswith(prefix):
                continue
            new_name = f"q{new_no:03d}_" + name[len(prefix) :]
            try:
                source = fields.public_file(topic, public)
                target = source.with_name(new_name)
                if source.is_file():
                    if target.is_file() and target != source:
                        target.unlink()
                    source.replace(target)
            except (AppError, OSError):
                log.warning("重命名证据截图失败：%s → %s", public, new_name)
            file["file"] = f"{public[: -len(name)]}{new_name}"


def delete_question(topic_id: str, qid: str) -> DeleteQuestionResponse:
    topic = _topic_or_404(topic_id)
    position, target = _question_at(topic, qid)
    questions = topic["questions"]

    moves: list[tuple[str, str, dict[str, Any], int, int]] = []
    for index in range(position + 1, len(questions)):
        original = questions[index]
        new_no = index
        new_id = f"q{new_no:03d}"
        moved = copy.deepcopy(original)
        moved["no"] = new_no
        moved["id"] = new_id
        moved["key"] = f"{topic['id']}/{new_id}"
        moves.append((original["key"], moved["key"], moved, original["no"], new_no))

    card_deleted = False
    reindexed = 0
    if review_service.anki_available():
        # 先处理卡片：同步进行中会抛 503，此时题库文件保持原样。
        card_deleted = review_service.sync_bank_delete(target["key"])
        if moves:
            reindexed = review_service.sync_bank_reindex(
                topic, [(old_key, new_key, moved) for old_key, new_key, moved, _, _ in moves]
            )

    _delete_files(topic, target)
    for _, _, moved, old_no, new_no in moves:
        _rename_evidence(topic, moved, old_no, new_no)

    topic["questions"] = questions[:position] + [moved for _, _, moved, _, _ in moves]
    topic["count"] = len(topic["questions"])
    _save_topic_and_index(topic)
    return DeleteQuestionResponse(card_deleted=card_deleted, reindexed=reindexed)


def upload_evidence(
    topic_id: str,
    no: int,
    group: int,
    page: int,
    content_type: str,
    data: bytes,
) -> EvidenceUploadResponse:
    topic = _topic_or_404(topic_id)
    if no < 1 or no > len(topic["questions"]) + 1:
        raise AppError("题目序号超出范围", code="invalid_params", status=400)
    if group < 0 or group >= fields.EVIDENCE_LIMIT:
        raise AppError("证据分组序号超出范围", code="invalid_params", status=400)
    if page < 1 or page > 9999:
        raise AppError("证据页码超出范围", code="invalid_params", status=400)
    try:
        directory = safe_join(settings.study_dir, topic["slug"], "assets", "ev")
    except ValueError as exc:
        raise AppError("专题资源目录非法", code="invalid_params", status=400) from exc
    file, width, height = media_service.save_image(
        directory,
        f"/study/{topic['slug']}/assets/ev",
        f"q{no:03d}_{group}_{page}",
        content_type,
        data,
    )
    return EvidenceUploadResponse(file=file, width=width, height=height)
