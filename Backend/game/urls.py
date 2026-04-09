from django.urls import path

from .views import (
    AscendView,
    BlockFeedView,
    LeaderboardView,
    MiningHarvestView,
    MiningStartView,
    MiningStopView,
    UpgradeBuyView,
)

urlpatterns = [
    path("mining/start/", MiningStartView.as_view(), name="mining-start"),
    path("mining/stop/", MiningStopView.as_view(), name="mining-stop"),
    path("mining/harvest/", MiningHarvestView.as_view(), name="mining-harvest"),
    path("upgrade/buy/", UpgradeBuyView.as_view(), name="upgrade-buy"),
    path("ascend/", AscendView.as_view(), name="ascend"),
    path("leaderboard/", LeaderboardView.as_view(), name="leaderboard"),
    path("blocks/", BlockFeedView.as_view(), name="block-feed"),
]
