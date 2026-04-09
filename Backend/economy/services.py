from decimal import Decimal

from accounts.models import UserProfile


def log_transaction(profile: UserProfile, tx_type: str, amount: Decimal, detail: str = "") -> None:
    from economy.models import TransactionHistory

    TransactionHistory.objects.create(
        profile=profile,
        tx_type=tx_type,
        amount=amount,
        balance_after=profile.balance,
        detail=detail,
    )
