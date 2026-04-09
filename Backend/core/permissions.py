from rest_framework.permissions import BasePermission


class IsVerified(BasePermission):
    message = "Payment required. Complete identity verification first."
    code = "payment_required"

    def has_permission(self, request, view):
        profile = getattr(request.user, "profile", None)
        if profile is None:
            return False
        return profile.is_verified


class IsNotBanned(BasePermission):
    message = "Your account has been suspended."

    def has_permission(self, request, view):
        profile = getattr(request.user, "profile", None)
        if profile is None:
            return False
        return not profile.is_banned
