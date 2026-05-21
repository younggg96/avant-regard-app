"""
PRD 模块一 · Listing 状态机单测。

只测纯状态机判定（`is_valid_transition`），不依赖 Supabase / DB。这一份测试同时支持：
  - pytest:   python -m pytest backend/app/tests/test_listing_state_machine.py
  - 直接运行: python backend/app/tests/test_listing_state_machine.py
"""
from app.schemas.store_product import ProductStatus
from app.services.store_product_service import is_valid_transition


VALID_TRANSITIONS = [
    # draft 出口
    (ProductStatus.DRAFT, ProductStatus.REVIEWING),
    (ProductStatus.DRAFT, ProductStatus.OFFLINE),
    # reviewing 出口
    (ProductStatus.REVIEWING, ProductStatus.ACTIVE),
    (ProductStatus.REVIEWING, ProductStatus.REJECTED),
    (ProductStatus.REVIEWING, ProductStatus.DRAFT),
    # active 出口
    (ProductStatus.ACTIVE, ProductStatus.FROZEN),
    (ProductStatus.ACTIVE, ProductStatus.OFFLINE),
    (ProductStatus.ACTIVE, ProductStatus.SOLD),
    # frozen 出口
    (ProductStatus.FROZEN, ProductStatus.ACTIVE),
    (ProductStatus.FROZEN, ProductStatus.SOLD),
    # rejected 出口
    (ProductStatus.REJECTED, ProductStatus.DRAFT),
    (ProductStatus.REJECTED, ProductStatus.OFFLINE),
    # offline 出口
    (ProductStatus.OFFLINE, ProductStatus.DRAFT),
]

INVALID_TRANSITIONS = [
    # 终态 sold 不能再迁
    (ProductStatus.SOLD, ProductStatus.ACTIVE),
    (ProductStatus.SOLD, ProductStatus.DRAFT),
    # 跨态跳跃
    (ProductStatus.DRAFT, ProductStatus.ACTIVE),
    (ProductStatus.DRAFT, ProductStatus.SOLD),
    (ProductStatus.DRAFT, ProductStatus.FROZEN),
    # active 不能直接回到 draft
    (ProductStatus.ACTIVE, ProductStatus.DRAFT),
    (ProductStatus.ACTIVE, ProductStatus.REJECTED),
    # frozen 不能直接到 offline
    (ProductStatus.FROZEN, ProductStatus.OFFLINE),
    # offline 不能直接到 active
    (ProductStatus.OFFLINE, ProductStatus.ACTIVE),
    # rejected 不能直接到 active
    (ProductStatus.REJECTED, ProductStatus.ACTIVE),
]


def test_valid_transitions_all_pass():
    for src, target in VALID_TRANSITIONS:
        assert is_valid_transition(src.value, target.value), (
            f"应当合法但被拒绝：{src.value} → {target.value}"
        )


def test_invalid_transitions_all_blocked():
    for src, target in INVALID_TRANSITIONS:
        assert not is_valid_transition(src.value, target.value), (
            f"应当拒绝但通过：{src.value} → {target.value}"
        )


def test_unknown_status_strings_rejected():
    assert not is_valid_transition("foo", "active")
    assert not is_valid_transition("draft", "bar")
    assert not is_valid_transition("", "")


def test_self_loop_rejected_unless_explicitly_allowed():
    # 当前实现里 draft → draft 等自循环不在合法集，update path 上通过 noop 处理
    for src in ProductStatus:
        assert not is_valid_transition(src.value, src.value), (
            f"自循环不应直接当作合法跳转：{src.value} → {src.value}"
        )


if __name__ == "__main__":
    test_valid_transitions_all_pass()
    test_invalid_transitions_all_blocked()
    test_unknown_status_strings_rejected()
    test_self_loop_rejected_unless_explicitly_allowed()
    print("OK ✓ listing state machine")
