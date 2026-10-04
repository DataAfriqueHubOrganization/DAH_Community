FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ENV=prod

WORKDIR /app

COPY requirements/ requirements/
RUN pip install --no-cache-dir -r requirements/prod.txt

COPY . .

# Utilisateur sans privilèges ; dossiers des fichiers envoyés (volumes persistants).
RUN useradd --create-home --uid 1000 app \
    && mkdir -p /app/media /app/private_media /app/staticfiles \
    && chown -R app:app /app
USER app

# SECRET_KEY réel non disponible au build (il vient des variables d'env au
# démarrage) ; collectstatic n'a besoin que d'une valeur qui ne commence pas
# par "dev-insecure" pour passer le garde-fou de prod.py.
RUN SECRET_KEY=build-time-placeholder-key python manage.py collectstatic --noinput

EXPOSE 8000

# Migrations + fichiers statiques au démarrage, puis Gunicorn.
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py collectstatic --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 60 --access-logfile -"]

CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:8000 --timeout 60"]
