from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.common.permissions import IsOwnerOrAdmin, is_bureau
from apps.departments.services import get_user_department_ids
from apps.engagement.serializers import ReturnTaskSerializer, SubmitTaskSerializer, ValidateTaskSerializer
from apps.engagement import services as engagement
from .models import Project, ProjectTask
from .serializers import (
    ProjectSerializer, ProjectWriteSerializer,
    ProjectTaskSerializer, ProjectTaskWriteSerializer, ProjectTaskStatusUpdateSerializer,
)


class ProjectViewSet(ModelViewSet):
    """Projets des départements. Lecture : bureau/admin voient tout ; les autres
    uniquement les projets de leur(s) département(s) (adhésion en cours ou
    lead/co-lead), plus ceux qu'ils portent ou auxquels ils sont rattachés — un
    projet d'un autre département répond 404, tâches comprises. Création réservée
    par ProjectWriteSerializer.validate() (responsable/adjoint du département
    visé, ou bureau/admin) ; édition/suppression réservées au propriétaire, à
    l'admin ou au bureau."""
    queryset = Project.objects.select_related("owner", "department").prefetch_related("members")

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not is_bureau(user):
            qs = qs.filter(
                Q(department_id__in=get_user_department_ids(user))
                | Q(owner=user)
                | Q(members=user)
            ).distinct()
        department_id = self.request.query_params.get("department")
        if department_id:
            qs = qs.filter(department_id=department_id)
        return qs

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return ProjectWriteSerializer
        return ProjectSerializer

    def get_permissions(self):
        if self.action in ["update", "partial_update", "destroy"]:
            return [IsAuthenticated(), IsOwnerOrAdmin()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def _can_manage_project(self, project) -> bool:
        return is_bureau(self.request.user) or project.owner_id == self.request.user.id

    # ── Mes tâches (tous projets confondus) ───────────────────────────
    @action(detail=False, methods=["get"], url_path="my-tasks")
    def my_tasks(self, request):
        queryset = (
            ProjectTask.objects
            .filter(assigned_to=request.user)
            .select_related("project", "assigned_to")
            .order_by("due_date")
        )
        return Response(ProjectTaskSerializer(queryset, many=True).data)

    # ── Tâches d'un projet ─────────────────────────────────────────────
    @action(detail=True, methods=["get", "post"], url_path="tasks")
    def tasks(self, request, pk=None):
        project = self.get_object()

        if request.method == "GET":
            queryset = project.tasks.select_related("assigned_to").order_by("due_date")
            return Response(ProjectTaskSerializer(queryset, many=True).data)

        if not self._can_manage_project(project):
            raise PermissionDenied("Vous ne gérez pas ce projet.")
        serializer = ProjectTaskWriteSerializer(data=request.data, context={"request": request, "project": project})
        serializer.is_valid(raise_exception=True)
        task = serializer.save(project=project)
        return Response(ProjectTaskSerializer(task).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch", "delete"], url_path="tasks/(?P<task_id>[^/.]+)")
    def task_detail(self, request, pk=None, task_id=None):
        project = self.get_object()
        try:
            task = project.tasks.get(pk=task_id)
        except ProjectTask.DoesNotExist:
            return Response({"detail": "Tâche introuvable."}, status=status.HTTP_404_NOT_FOUND)

        if request.method == "DELETE":
            if not self._can_manage_project(project):
                raise PermissionDenied("Vous ne gérez pas ce projet.")
            task.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        if self._can_manage_project(project):
            if "status" in request.data:
                engagement.check_free_status_change(task, request.data["status"])
            serializer = ProjectTaskWriteSerializer(
                task, data=request.data, partial=True, context={"request": request, "project": project},
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
        elif task.assigned_to_id == request.user.id:
            serializer = ProjectTaskStatusUpdateSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            engagement.check_free_status_change(task, serializer.validated_data["status"])
            task.status = serializer.validated_data["status"]
            task.save(update_fields=["status"])
        else:
            raise PermissionDenied("Vous ne pouvez modifier que vos propres tâches.")

        return Response(ProjectTaskSerializer(task).data)

    # ── Cycle de validation (points accordés à la validation) ───────────
    def _get_task(self, pk, task_id):
        project = self.get_object()
        try:
            return project.tasks.select_related("project__department", "assigned_to").get(pk=task_id)
        except ProjectTask.DoesNotExist:
            raise NotFound("Tâche introuvable.")

    @action(detail=True, methods=["post"], url_path="tasks/(?P<task_id>[^/.]+)/submit")
    def submit_task(self, request, pk=None, task_id=None):
        task = self._get_task(pk, task_id)
        serializer = SubmitTaskSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        engagement.submit_task(task, request.user, serializer.validated_data["note"])
        return Response(ProjectTaskSerializer(task).data)

    @action(detail=True, methods=["post"], url_path="tasks/(?P<task_id>[^/.]+)/validate")
    def validate_task(self, request, pk=None, task_id=None):
        task = self._get_task(pk, task_id)
        serializer = ValidateTaskSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        engagement.validate_task(task, request.user, serializer.validated_data["outstanding"])
        return Response(ProjectTaskSerializer(task).data)

    @action(detail=True, methods=["post"], url_path="tasks/(?P<task_id>[^/.]+)/return")
    def return_task(self, request, pk=None, task_id=None):
        task = self._get_task(pk, task_id)
        serializer = ReturnTaskSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        engagement.return_task(task, request.user, serializer.validated_data["reason"])
        return Response(ProjectTaskSerializer(task).data)
