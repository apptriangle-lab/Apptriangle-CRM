"""
Run the CRM backend. From project root: python run.py
Or: flask --app app run
"""
import os
import socket

os.environ.setdefault("FLASK_APP", "app:create_app")

from app import create_app

app = create_app()


def find_free_port(start_port=5000, max_attempts=10):
    """Find a free port starting from start_port."""
    for port in range(start_port, start_port + max_attempts):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(("", port))
                return port
        except OSError:
            continue
    return None


def _start_report_scheduler_in_worker(app):
    """Start the scheduler only in the single werkzeug worker (never the reloader parent)."""
    if os.environ.get("REPORT_SCHEDULER_DISABLED"):
        return
    if os.environ.get("FLASK_DEBUG") == "1" and os.environ.get("WERKZEUG_RUN_MAIN") != "true":
        return
    from app.services.report_automation.report_scheduler_service import start_report_scheduler

    start_report_scheduler(app)


if __name__ == "__main__":
    railway_port = os.environ.get("PORT")
    is_production = railway_port is not None

    if is_production:
        port = int(railway_port)
    else:
        os.environ["FLASK_DEBUG"] = "1"
        port = int(os.environ.get("FLASK_RUN_PORT", 5000))
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(("", port))
        except OSError:
            print(f"Port {port} is already in use. Searching for a free port...")
            free_port = find_free_port(5000)
            if free_port:
                port = free_port
                print(f"Using port {port} instead.")
            else:
                print("Error: Could not find a free port. Please close other applications using ports 5000-5010.")
                exit(1)

    _start_report_scheduler_in_worker(app)

    print(f"Starting Flask server on http://0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=not is_production, use_reloader=not is_production)
