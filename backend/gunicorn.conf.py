import os

bind = f"0.0.0.0:{os.environ.get('PORT', '5000')}"
workers = int(os.environ.get("WEB_CONCURRENCY", "1"))
threads = int(os.environ.get("GUNICORN_THREADS", "8"))
timeout = 120
keepalive = 5
accesslog = "-"
errorlog = "-"
capture_output = True


def when_ready(server):
    from run import _start_report_scheduler_in_worker, app

    _start_report_scheduler_in_worker(app)
