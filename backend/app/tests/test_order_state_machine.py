"""
PRD 模块四 · 订单状态机单元测试。

只测 is_valid_order_transition 这条纯函数，避免触发 Supabase。
"""
import pytest

from app.services.order_service import is_valid_order_transition, OrderStatus as S


VALID = [
    (S.PENDING_PAYMENT, S.PAID),
    (S.PENDING_PAYMENT, S.REFUNDED_AUTO),
    (S.PAID, S.SHIPPED),
    (S.PAID, S.REFUNDED_AUTO),
    (S.SHIPPED, S.DELIVERED),
    (S.SHIPPED, S.REFUNDED),
    (S.SHIPPED, S.DISPUTED),
    (S.DELIVERED, S.COMPLETED),
    (S.DELIVERED, S.DISPUTED),
    (S.DELIVERED, S.REFUNDED),
    (S.COMPLETED, S.SETTLED),
    (S.COMPLETED, S.DISPUTED),
    (S.DISPUTED, S.RESOLVED),
    (S.RESOLVED, S.SETTLED),
    (S.RESOLVED, S.REFUNDED),
]

INVALID = [
    (S.SETTLED, S.REFUNDED),
    (S.REFUNDED, S.PAID),
    (S.REFUNDED_AUTO, S.PAID),
    (S.PENDING_PAYMENT, S.SHIPPED),
    (S.PENDING_PAYMENT, S.DELIVERED),
    (S.PAID, S.SETTLED),
    (S.SHIPPED, S.SETTLED),
    (S.DELIVERED, S.SETTLED),
    (S.DISPUTED, S.PAID),
]


@pytest.mark.parametrize("src,target", VALID)
def test_valid_order_transitions(src, target):
    assert is_valid_order_transition(src.value, target.value), f"{src} → {target} should be valid"


@pytest.mark.parametrize("src,target", INVALID)
def test_invalid_order_transitions(src, target):
    assert not is_valid_order_transition(src.value, target.value), f"{src} → {target} should be invalid"


def test_unknown_status_strings_rejected():
    assert not is_valid_order_transition("foo", "paid")
    assert not is_valid_order_transition("paid", "bar")


def test_terminal_states_have_no_outgoing():
    for terminal in (S.SETTLED, S.REFUNDED_AUTO, S.REFUNDED):
        for target in S:
            assert not is_valid_order_transition(terminal.value, target.value), \
                f"{terminal} should be terminal but allows transition to {target}"
