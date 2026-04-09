from rest_framework.throttling import SimpleRateThrottle


class GameBurstRateThrottle(SimpleRateThrottle):
    scope = "game_burst"

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            return self.cache_format % {"scope": self.scope, "ident": request.user.pk}
        return self.get_ident(request)


class GameSustainedRateThrottle(SimpleRateThrottle):
    scope = "game_sustained"

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            return self.cache_format % {"scope": self.scope, "ident": request.user.pk}
        return self.get_ident(request)
