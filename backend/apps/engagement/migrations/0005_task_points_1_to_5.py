from django.db import migrations
from django.utils import timezone


def recompute_task_points(apps, schema_editor):
    """Tâches notées de 1 à 5 (+1 à temps, −1 en retard, +1 remarquable, 1 au
    minimum) : les points des tâches déjà validées sont recalculés."""
    PointEntry = apps.get_model("engagement", "PointEntry")
    for model, field in (("projects.ProjectTask", "project_task"), ("departments.DepartmentTask", "department_task")):
        Task = apps.get_model(*model.split("."))
        for task in Task.objects.filter(status="done"):
            points = task.weight or 3
            if task.due_date and task.submitted_at:
                points += 1 if timezone.localdate(task.submitted_at) <= task.due_date else -1
            if task.is_outstanding:
                points += 1
            points = max(points, 1)
            Task.objects.filter(pk=task.pk).update(points_awarded=points)
            PointEntry.objects.filter(**{f"{field}_id": task.pk}).update(points=points)


class Migration(migrations.Migration):

    dependencies = [
        ("engagement", "0004_checkin_points_max_5"),
        ("projects", "0004_task_weight_1_to_5"),
        ("departments", "0007_task_weight_1_to_5"),
    ]

    operations = [
        migrations.RunPython(recompute_task_points, migrations.RunPython.noop),
    ]
