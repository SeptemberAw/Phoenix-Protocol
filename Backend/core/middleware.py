from django.http import JsonResponse
from django.utils import timezone


class BanCheckMiddleware:
    EXEMPT_PATHS = ("/admin/", "/api/v1/auth/")

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if any(request.path.startswith(p) for p in self.EXEMPT_PATHS):
            return self.get_response(request)

        if not hasattr(request, "user") or not request.user.is_authenticated:
            return self.get_response(request)

        profile = getattr(request.user, "profile", None)
        if profile is None:
            return self.get_response(request)

        if profile.is_banned:
            if profile.ban_until and profile.ban_until <= timezone.now():
                profile.is_banned = False
                profile.ban_until = None
                profile.ban_reason = ""
                profile.save(update_fields=["is_banned", "ban_until", "ban_reason"])
            else:
                return JsonResponse(
                    {"detail": "Your account has been suspended.", "reason": profile.ban_reason},
                    status=403,
                )

        return self.get_response(request)
