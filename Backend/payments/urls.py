from django.urls import path

from .views import (
    CreateInvoiceView,
    PaymentHistoryView,
    PaymentPricesView,
    SaveWalletView,
    TelegramWebhookView,
    TonVerifyView,
    VerifyPaymentView,
)

urlpatterns = [
    path("create-invoice/", CreateInvoiceView.as_view(), name="payment-create-invoice"),
    path("verify/", VerifyPaymentView.as_view(), name="payment-verify"),
    path("ton/verify/", TonVerifyView.as_view(), name="ton-verify"),
    path("wallet/", SaveWalletView.as_view(), name="wallet-save"),
    path("prices/", PaymentPricesView.as_view(), name="payment-prices"),
    path("webhook/telegram/", TelegramWebhookView.as_view(), name="telegram-webhook"),
    path("history/", PaymentHistoryView.as_view(), name="payment-history"),
]
