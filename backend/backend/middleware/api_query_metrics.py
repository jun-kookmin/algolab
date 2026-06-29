import logging
import time

from django.conf import settings
from django.db import connections


logger = logging.getLogger("api.query.metrics")


class ApiQueryMetricsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not getattr(settings, "API_QUERY_METRICS_ENABLED", False):
            return self.get_response(request)
        if not request.path.startswith("/api/"):
            return self.get_response(request)

        start = time.perf_counter()
        initial_counts = {}
        forced = []

        for conn in connections.all():
            initial_counts[conn.alias] = len(conn.queries)
            if not conn.force_debug_cursor:
                conn.force_debug_cursor = True
                forced.append(conn)

        try:
            response = self.get_response(request)
        finally:
            for conn in forced:
                conn.force_debug_cursor = False

        total_ms = (time.perf_counter() - start) * 1000.0
        query_count = 0
        sql_time_ms = 0.0
        queries = []

        for conn in connections.all():
            qs = conn.queries[initial_counts.get(conn.alias, 0):]
            query_count += len(qs)
            for q in qs:
                try:
                    sql_time_ms += float(q.get("time", 0.0)) * 1000.0
                except (TypeError, ValueError):
                    pass
            queries.extend(qs)

        response["X-API-Query-Count"] = str(query_count)
        response["X-API-SQL-Time-ms"] = f"{sql_time_ms:.2f}"
        response["X-API-Total-Time-ms"] = f"{total_ms:.2f}"

        log_level = logging.WARNING if total_ms >= settings.API_QUERY_METRICS_SLOW_MS else logging.INFO
        logger.log(
            log_level,
            "api_metrics method=%s path=%s status=%s total_ms=%.2f sql_ms=%.2f queries=%d",
            request.method,
            request.path,
            getattr(response, "status_code", "-"),
            total_ms,
            sql_time_ms,
            query_count,
        )

        if getattr(settings, "API_QUERY_METRICS_LOG_SQL", False):
            for q in queries[: settings.API_QUERY_METRICS_MAX_SQL]:
                logger.debug("api_sql time=%s sql=%s", q.get("time"), q.get("sql"))

        return response
