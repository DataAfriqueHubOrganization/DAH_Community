import django.core.validators
from django.db import migrations, models

# Envergure (petite / moyenne / grande) → points de 1 à 5 choisis par le responsable.
SIZE_TO_WEIGHT = {"small": 1, "medium": 3, "large": 5}


def size_to_weight(apps, schema_editor):
    Task = apps.get_model("departments", "DepartmentTask")
    for size, weight in SIZE_TO_WEIGHT.items():
        Task.objects.filter(size=size).update(weight=weight)


class Migration(migrations.Migration):

    dependencies = [
        ('departments', '0006_department_project_managers'),
    ]

    operations = [
        migrations.AddField(
            model_name='departmenttask',
            name='weight',
            field=models.PositiveSmallIntegerField(default=3, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(5)], verbose_name='Points de la tâche'),
        ),
        migrations.RunPython(size_to_weight, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='departmenttask',
            name='size',
        ),
    ]
