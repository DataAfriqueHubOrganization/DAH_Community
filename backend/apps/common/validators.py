from django.core.exceptions import ValidationError
from django.utils.deconstruct import deconstructible


@deconstructible
class MaxFileSizeValidator:
    """Refuse les fichiers plus lourds que `megabytes` Mo."""

    def __init__(self, megabytes: int):
        self.megabytes = megabytes

    def __call__(self, file):
        size = getattr(file, "size", None)
        if size is not None and size > self.megabytes * 1024 * 1024:
            raise ValidationError(f"Fichier trop lourd ({self.megabytes} Mo maximum).")

    def __eq__(self, other):
        return isinstance(other, MaxFileSizeValidator) and other.megabytes == self.megabytes
