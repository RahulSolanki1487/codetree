"""Helpers for the tools."""
import os


@dataclass
class Report(Base):
    """A report of one run.

    It has a second paragraph that is not shown.
    """
    kind = 1

    @property
    def title(self, x: int) -> str:
        """The title of the report."""
        return "t"

    async def send(self):
        return 1

    def undocumented(self):
        return 2


def top(a, b=2):
    """Adds two numbers."""
    def inner():
        pass
    return a + b


def lonely(x):
    return x


def one_line(): return 1
