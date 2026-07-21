from contextvars import ContextVar
from typing import Optional

target_week_var: ContextVar[Optional[int]] = ContextVar("target_week", default=None)
