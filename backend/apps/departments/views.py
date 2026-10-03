from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.common.permissions import IsAdminOrBureau, is_bureau
from apps.engagement import services as engagement
from apps.engagement.serializers import ReturnTaskSerializer, SubmitTaskSerializer, ValidateTaskSerializer
from .models import Department, DepartmentMembership, DepartmentAnnouncement, DepartmentSession, DepartmentTask
from .serializers import (
    DepartmentListSerializer, DepartmentDetailSerializer, DepartmentWriteSerializer,
    DepartmentMembershipSerializer, AddMembershipSerializer, EndMembershipSerializer,
    DepartmentAnnouncementSerializer, AnnouncementWriteSerializer,
    DepartmentSessionSerializer, SessionWriteSerializer, SessionUpdateSerializer, SessionReportSerializer,
    DepartmentTaskSerializer, TaskWriteSerializer, TaskStatusUpdateSerializer,
)
from .services import (
    save_department, add_member, end_membership,
    can_manage_department, is_current_department_member, get_my_department_context,
    get_user_department_ids,
    create_announcement, update_announcement,
    create_session, update_session, delete_session_series, submit_session_report, send_session_reminder,
    create_task,
)


class DepartmentViewSet(ModelViewSet):
    queryset = Department.objects.select_related("lead", "co_lead").prefetch_related("memberships")

    def get_serializer_class(self):
        if self.action == "list":
            return DepartmentListSerializer
        if self.action in ["create", "update", "partial_update"]:
            return DepartmentWriteSerializer
        return DepartmentDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        # Bureau/admin voient tous les départements ; un membre uniquement le(s)
        # sien(s) (adhésion en cours ou lead/co-lead). Un autre département répond
        # 404, sous-ressources comprises (membres, annonces, séances, tâches).
        if self.action != "public_list" and not is_bureau(self.request.user):
            qs = qs.filter(id__in=get_user_department_ids(self.request.user))
        return qs

    def get_permissions(self):
        if self.action == "public_list":
            return [AllowAny()]
        if self.action == "mine":
            return [IsAuthenticated()]
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAuthenticated(), IsAdminOrBureau()]
        # list/retrieve et actions sur les sous-ressources : tout utilisateur connecté peut
        # consulter ; les vérifications fines (gérant / membre du département) se font dans
        # chaque action, car elles varient (lecture ouverte aux membres, écriture réservée
        # au lead/co-lead/bureau, ou self-service limité pour ses propres tâches).
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        save_department(serializer)

    def perform_update(self, serializer):
        save_department(serializer)

    # ── Membres ────────────────────────────────────────────────────
    @action(detail=True, methods=["get"], url_path="searchable-members")
    def searchable_members(self, request, pk=None):
        """Liste des membres pour la recherche par nom (ajout de membre, assignation
        de lead/co-lead ou de tâche) — accessible au lead/co-lead de CE département
        même s'il n'est pas admin/bureau, contrairement à /members/ (réservé au bureau)."""
        department = self.get_object()
        if not can_manage_department(request.user, department):
            raise PermissionDenied("Vous ne gérez pas ce département.")

        from apps.members.models import MemberProfile
        from apps.members.serializers import MemberListSerializer

        queryset = MemberProfile.objects.select_related("user").order_by("user__first_name")
        return Response(MemberListSerializer(queryset, many=True).data)

    @action(detail=True, methods=["get", "post"], url_path="members")
    def members(self, request, pk=None):
        department = self.get_object()
        if not can_manage_department(request.user, department):
            raise PermissionDenied("Vous ne gérez pas ce département.")

        if request.method == "GET":
            queryset = department.memberships.select_related("user").order_by("-start_date")
            return Response(DepartmentMembershipSerializer(queryset, many=True).data)

        serializer = AddMembershipSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        membership = add_member(
            department,
            serializer.validated_data["user"],
            serializer.validated_data["start_date"],
            serializer.validated_data.get("end_date"),
        )
        return Response(
            DepartmentMembershipSerializer(membership).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="members/(?P<membership_id>[^/.]+)/end")
    def end_member(self, request, pk=None, membership_id=None):
        department = self.get_object()
        if not can_manage_department(request.user, department):
            raise PermissionDenied("Vous ne gérez pas ce département.")
        try:
            membership = department.memberships.get(pk=membership_id)
        except DepartmentMembership.DoesNotExist:
            return Response({"detail": "Adhésion introuvable."}, status=status.HTTP_404_NOT_FOUND)
        serializer = EndMembershipSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        end_membership(membership, serializer.validated_data.get("end_date"))
        return Response(DepartmentMembershipSerializer(membership).data)

    @action(detail=True, methods=["delete"], url_path="members/(?P<membership_id>[^/.]+)")
    def remove_member(self, request, pk=None, membership_id=None):
        department = self.get_object()
        if not can_manage_department(request.user, department):
            raise PermissionDenied("Vous ne gérez pas ce département.")
        try:
            membership = department.memberships.get(pk=membership_id)
        except DepartmentMembership.DoesNotExist:
            return Response({"detail": "Adhésion introuvable."}, status=status.HTTP_404_NOT_FOUND)
        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ── Annonces ───────────────────────────────────────────────────
    @action(detail=True, methods=["get", "post"], url_path="announcements")
    def announcements(self, request, pk=None):
        department = self.get_object()
        manages = can_manage_department(request.user, department)

        if request.method == "GET":
            if not (manages or is_current_department_member(request.user, department)):
                raise PermissionDenied("Vous n'êtes pas membre de ce département.")
            queryset = department.announcements.select_related("author").order_by("-created_at")
            return Response(DepartmentAnnouncementSerializer(queryset, many=True).data)

        if not manages:
            raise PermissionDenied("Vous ne gérez pas ce département.")
        serializer = AnnouncementWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        announcement = create_announcement(
            department, request.user,
            serializer.validated_data["title"], serializer.validated_data["content"],
        )
        return Response(
            DepartmentAnnouncementSerializer(announcement).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["patch", "delete"], url_path="announcements/(?P<announcement_id>[^/.]+)")
    def announcement_detail(self, request, pk=None, announcement_id=None):
        department = self.get_object()
        if not can_manage_department(request.user, department):
            raise PermissionDenied("Vous ne gérez pas ce département.")
        try:
            announcement = department.announcements.get(pk=announcement_id)
        except DepartmentAnnouncement.DoesNotExist:
            return Response({"detail": "Annonce introuvable."}, status=status.HTTP_404_NOT_FOUND)

        if request.method == "DELETE":
            announcement.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        serializer = AnnouncementWriteSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        update_announcement(announcement, **serializer.validated_data)
        return Response(DepartmentAnnouncementSerializer(announcement).data)

    # ── Séances ────────────────────────────────────────────────────
    @action(detail=True, methods=["get", "post"], url_path="sessions")
    def sessions(self, request, pk=None):
        department = self.get_object()
        manages = can_manage_department(request.user, department)

        if request.method == "GET":
            if not (manages or is_current_department_member(request.user, department)):
                raise PermissionDenied("Vous n'êtes pas membre de ce département.")
            queryset = department.sessions.order_by("-date")
            return Response(DepartmentSessionSerializer(queryset, many=True).data)

        if not manages:
            raise PermissionDenied("Vous ne gérez pas ce département.")
        serializer = SessionWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        session = create_session(
            department, request.user,
            date=serializer.validated_data["date"],
            theme=serializer.validated_data.get("theme", ""),
            meet_link=serializer.validated_data.get("meet_link", ""),
            frequency=serializer.validated_data.get("frequency", "none"),
            occurrences=serializer.validated_data.get("occurrences", 1),
        )
        return Response(DepartmentSessionSerializer(session).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch", "delete"], url_path="sessions/(?P<session_id>[^/.]+)")
    def session_detail(self, request, pk=None, session_id=None):
        department = self.get_object()
        if not can_manage_department(request.user, department):
            raise PermissionDenied("Vous ne gérez pas ce département.")
        try:
            session = department.sessions.get(pk=session_id)
        except DepartmentSession.DoesNotExist:
            return Response({"detail": "Séance introuvable."}, status=status.HTTP_404_NOT_FOUND)

        if request.method == "DELETE":
            session.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        serializer = SessionUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        update_session(session, **serializer.validated_data)
        return Response(DepartmentSessionSerializer(session).data)

    @action(detail=True, methods=["delete"], url_path="sessions/(?P<session_id>[^/.]+)/series")
    def session_series(self, request, pk=None, session_id=None):
        department = self.get_object()
        if not can_manage_department(request.user, department):
            raise PermissionDenied("Vous ne gérez pas ce département.")
        try:
            session = department.sessions.get(pk=session_id)
        except DepartmentSession.DoesNotExist:
            return Response({"detail": "Séance introuvable."}, status=status.HTTP_404_NOT_FOUND)
        delete_session_series(session)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="sessions/(?P<session_id>[^/.]+)/report")
    def session_report(self, request, pk=None, session_id=None):
        department = self.get_object()
        if not can_manage_department(request.user, department):
            raise PermissionDenied("Vous ne gérez pas ce département.")
        try:
            session = department.sessions.get(pk=session_id)
        except DepartmentSession.DoesNotExist:
            return Response({"detail": "Séance introuvable."}, status=status.HTTP_404_NOT_FOUND)
        serializer = SessionReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        submit_session_report(
            session,
            serializer.validated_data["report"],
            [u.id for u in serializer.validated_data.get("present_user_ids", [])],
        )
        return Response(DepartmentSessionSerializer(session).data)

    @action(detail=True, methods=["post"], url_path="sessions/(?P<session_id>[^/.]+)/remind")
    def session_remind(self, request, pk=None, session_id=None):
        department = self.get_object()
        if not can_manage_department(request.user, department):
            raise PermissionDenied("Vous ne gérez pas ce département.")
        try:
            session = department.sessions.get(pk=session_id)
        except DepartmentSession.DoesNotExist:
            return Response({"detail": "Séance introuvable."}, status=status.HTTP_404_NOT_FOUND)
        send_session_reminder(session)
        return Response({"detail": "Rappel envoyé."})

    # ── Tâches ─────────────────────────────────────────────────────
    @action(detail=True, methods=["get", "post"], url_path="tasks")
    def tasks(self, request, pk=None):
        department = self.get_object()
        if not can_manage_department(request.user, department):
            raise PermissionDenied("Vous ne gérez pas ce département.")

        if request.method == "GET":
            queryset = department.tasks.select_related("assigned_to").order_by("-created_at")
            return Response(DepartmentTaskSerializer(queryset, many=True).data)

        serializer = TaskWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        task = create_task(
            department, request.user,
            title=serializer.validated_data["title"],
            description=serializer.validated_data.get("description", ""),
            assigned_to=serializer.validated_data.get("assigned_to"),
            due_date=serializer.validated_data.get("due_date"),
            status=serializer.validated_data.get("status", "todo"),
            size=serializer.validated_data.get("size", "medium"),
        )
        return Response(DepartmentTaskSerializer(task).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch", "delete"], url_path="tasks/(?P<task_id>[^/.]+)")
    def task_detail(self, request, pk=None, task_id=None):
        department = self.get_object()
        try:
            task = department.tasks.get(pk=task_id)
        except DepartmentTask.DoesNotExist:
            return Response({"detail": "Tâche introuvable."}, status=status.HTTP_404_NOT_FOUND)

        if request.method == "DELETE":
            if not can_manage_department(request.user, department):
                raise PermissionDenied("Vous ne gérez pas ce département.")
            task.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        if can_manage_department(request.user, department):
            if "status" in request.data:
                engagement.check_free_status_change(task, request.data["status"])
            serializer = TaskWriteSerializer(data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            for field, value in serializer.validated_data.items():
                setattr(task, field, value)
            task.save()
        elif task.assigned_to_id == request.user.id:
            serializer = TaskStatusUpdateSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            engagement.check_free_status_change(task, serializer.validated_data["status"])
            task.status = serializer.validated_data["status"]
            task.save(update_fields=["status"])
        else:
            raise PermissionDenied("Vous ne pouvez modifier que vos propres tâches.")

        return Response(DepartmentTaskSerializer(task).data)

    # ── Cycle de validation des tâches (points accordés à la validation) ──
    def _get_task(self, task_id):
        department = self.get_object()
        try:
            return department.tasks.select_related("department", "assigned_to").get(pk=task_id)
        except DepartmentTask.DoesNotExist:
            raise NotFound("Tâche introuvable.")

    @action(detail=True, methods=["post"], url_path="tasks/(?P<task_id>[^/.]+)/submit")
    def submit_task(self, request, pk=None, task_id=None):
        task = self._get_task(task_id)
        serializer = SubmitTaskSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        engagement.submit_task(task, request.user, serializer.validated_data["note"])
        return Response(DepartmentTaskSerializer(task).data)

    @action(detail=True, methods=["post"], url_path="tasks/(?P<task_id>[^/.]+)/validate")
    def validate_task(self, request, pk=None, task_id=None):
        task = self._get_task(task_id)
        serializer = ValidateTaskSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        engagement.validate_task(task, request.user, serializer.validated_data["outstanding"])
        return Response(DepartmentTaskSerializer(task).data)

    @action(detail=True, methods=["post"], url_path="tasks/(?P<task_id>[^/.]+)/return")
    def return_task(self, request, pk=None, task_id=None):
        task = self._get_task(task_id)
        serializer = ReturnTaskSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        engagement.return_task(task, request.user, serializer.validated_data["reason"])
        return Response(DepartmentTaskSerializer(task).data)

    # ── Liste publique (id + nom) : filtre de l'annuaire public des membres ──
    @action(detail=False, methods=["get"], url_path="public")
    def public_list(self, request):
        return Response(list(Department.objects.order_by("name").values("id", "name")))

    # ── Mon département (vue membre) ────────────────────────────────
    @action(detail=False, methods=["get"], url_path="mine")
    def mine(self, request):
        department, since = get_my_department_context(request.user)
        if not department:
            return Response(None)

        manages = can_manage_department(request.user, department)
        announcements = department.announcements.select_related("author").order_by("-created_at")[:20]
        sessions = department.sessions.order_by("-date")[:20]
        my_tasks = department.tasks.filter(assigned_to=request.user).order_by("-created_at")

        return Response({
            "department": DepartmentListSerializer(department, context={"request": request}).data,
            "since": since,
            "can_manage": manages,
            "announcements": DepartmentAnnouncementSerializer(announcements, many=True).data,
            "sessions": DepartmentSessionSerializer(sessions, many=True).data,
            "my_tasks": DepartmentTaskSerializer(my_tasks, many=True).data,
        })
