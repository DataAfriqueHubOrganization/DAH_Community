from decimal import ROUND_HALF_UP, Decimal

from django.db import migrations


def recompute_checkin_points(apps, schema_editor):
    """Point d'étape ramené à 5 points maximum (au lieu de 20) : les points
    d'étape déjà confirmés sont recalculés, pour un classement cohérent."""
    CheckIn = apps.get_model("engagement", "CheckIn")
    PointEntry = apps.get_model("engagement", "PointEntry")
    for checkin in CheckIn.objects.exclude(final_scores={}).exclude(final_scores__isnull=True):
        scores = list((checkin.final_scores or {}).values())
        if not scores:
            continue
        mean = Decimal(sum(scores)) / Decimal(len(scores))
        points = int(mean.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        CheckIn.objects.filter(pk=checkin.pk).update(points=points)
        PointEntry.objects.filter(checkin_id=checkin.pk).update(points=points)


class Migration(migrations.Migration):

    dependencies = [
        ('engagement', '0003_pointentry_contribution_month_and_more'),
    ]

    operations = [
        migrations.RunPython(recompute_checkin_points, migrations.RunPython.noop),
    ]
