"""
EventBridge Scheduler, every 15 minutes - send whatever show email is due.

Each tick reads every current season (a catalog Query per show) and sends the
show-night reminders and the DWTS closing reminder that are due
(common/email_reminders.py), and each period's results digest
(common/email_digest.py). The sent log keeps a tick that overlaps or reruns
from sending anything twice. Returns, and logs, the counts per type and event.
"""

from __future__ import annotations

from lambdas.common import email_digest, email_reminders, email_shows, mailer, window


def handler(event, context):
    at = window.now()
    jobs = []
    for season in email_shows.seasons():
        jobs += email_reminders.tonight(season, at)
        if isinstance(season, email_shows.Dwts):
            jobs += email_reminders.closing(season, at)
            jobs += email_digest.dwts(season, at)
        else:
            jobs += email_digest.traitors(season, at)
    return mailer.run_jobs(jobs, at)
