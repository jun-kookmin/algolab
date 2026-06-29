from rest_framework.permissions import BasePermission, SAFE_METHODS
from variables.groups import GroupEnum


def _group_name_candidates(*group_names):
    names = set()
    for name in group_names:
        if not name:
            continue
        base = str(name).strip()
        if not base:
            continue
        lower = base.lower()
        names.add(base)
        names.add(lower)

        if lower in {"admin", "administrator"}:
            names.update({"admin", "administrator"})
        if lower in {"professor", "prof"}:
            names.update({"professor", "prof"})
        if lower in {"student", "std"}:
            names.update({"student"})

    return list(names)


def get_user_group_name_set(user):
    if not getattr(user, "is_authenticated", False):
        return set()

    cached = getattr(user, "_cached_group_name_set", None)
    if cached is not None:
        return cached

    prefetched = getattr(user, "_prefetched_objects_cache", {})
    prefetched_groups = prefetched.get("groups")
    if prefetched_groups is not None:
        names = {
            str(getattr(group, "name", "")).strip().lower()
            for group in prefetched_groups
            if getattr(group, "name", None)
        }
    else:
        names = {
            str(name).strip().lower()
            for name in user.groups.values_list("name", flat=True)
        }

    user._cached_group_name_set = names
    return names

def user_in_groups(user, *group_names):
    if not getattr(user, "is_authenticated", False):
        return False

    candidates = _group_name_candidates(*group_names)
    if not candidates:
        return False

    group_names = get_user_group_name_set(user)
    return any(str(name).strip().lower() in group_names for name in candidates)


def user_is_student_only(user):
    if not getattr(user, "is_authenticated", False):
        return False

    return bool(
        user_in_groups(user, GroupEnum.STUDENT.value)
        and not user_in_groups(
            user,
            GroupEnum.ADMINISTRATOR.value,
            GroupEnum.PROFESSOR.value,
        )
    )


def user_can_open_submission_target(viewer, target_user):
    if not getattr(viewer, "is_authenticated", False):
        return False
    if target_user is None:
        return False
    if user_in_groups(viewer, GroupEnum.ADMINISTRATOR.value):
        return True
    if user_in_groups(viewer, GroupEnum.PROFESSOR.value) and user_in_groups(
        target_user,
        GroupEnum.ADMINISTRATOR.value,
        GroupEnum.PROFESSOR.value,
    ):
        return True
    return user_is_student_only(target_user)

class InGroups(BasePermission):
    groups = ()
    def has_permission(self, request, view):
        return user_in_groups(request.user, *self.groups)

# .name -> 변수명 ADMINISTRATOR, .value -> 변수 값 Administrator
class IsAdmin(InGroups):
    groups = (GroupEnum.ADMINISTRATOR.value,)

class IsInstructor(InGroups):
    groups = (GroupEnum.PROFESSOR.value,)

class IsStudent(InGroups):
    groups = (GroupEnum.STUDENT.value,)

class ReadOnlyOr(InGroups):
    groups = ()
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return super().has_permission(request, view)
