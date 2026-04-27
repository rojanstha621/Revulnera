#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'revulnera_project.settings')

    # Dev ergonomics: run `devserver` behavior when users type `runserver`.
    # Opt out with REVULNERA_PLAIN_RUNSERVER=1 or --plain-runserver.
    if len(sys.argv) > 1 and sys.argv[1] == 'runserver':
        use_plain_runserver = (
            os.environ.get('REVULNERA_PLAIN_RUNSERVER', '').strip().lower() in {'1', 'true', 'yes'}
            or '--plain-runserver' in sys.argv
        )

        if '--plain-runserver' in sys.argv:
            sys.argv.remove('--plain-runserver')

        if not use_plain_runserver:
            sys.argv[1] = 'devserver'

    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
