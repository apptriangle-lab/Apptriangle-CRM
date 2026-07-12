#!/bin/sh
set -e

echo "Starting CRM backend (gunicorn)..."
exec gunicorn -c gunicorn.conf.py run:app
