from __future__ import annotations
# pyright: reportMissingImports=false

from datetime import date
from pathlib import Path
import sys

import matplotlib.pyplot as plt
import numpy as np

# Import simulator code from the Streamlit app repository.
SIM_PATH = Path(r"C:\Users\Ken\Debt-Payoff-Simulator")
if str(SIM_PATH) not in sys.path:
    sys.path.insert(0, str(SIM_PATH))

from src.simulator import Debt, compare, simulate  # noqa: E402

OUT_DIR = Path(r"C:\Users\Ken\DrKenReid.github.io\blog\img")
OUT_DIR.mkdir(parents=True, exist_ok=True)

BG = "#0f1117"
PLOT_BG = "#171a22"
FG = "#e6edf3"
MUTED = "#9da7b3"


plt.rcParams.update({
    "figure.facecolor": BG,
    "axes.facecolor": PLOT_BG,
    "savefig.facecolor": BG,
    "savefig.edgecolor": BG,
    "axes.edgecolor": MUTED,
    "axes.labelcolor": FG,
    "axes.titlecolor": FG,
    "xtick.color": FG,
    "ytick.color": FG,
    "text.color": FG,
    "grid.color": "#323848",
    "font.size": 10,
})


def style_axes(ax, title: str, xlabel: str, ylabel: str) -> None:
    ax.set_title(title, fontsize=13, weight="bold")
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    ax.grid(True, alpha=0.35)
    for spine in ax.spines.values():
        spine.set_color(MUTED)


def example_debts() -> list[Debt]:
    # Chosen to demonstrate a clearer avalanche advantage while remaining realistic.
    return [
        Debt("Store Card", 890, 15.92, 77),
        Debt("Credit Card A", 14123, 28.20, 224),
        Debt("Personal Loan", 7287, 11.25, 193),
        Debt("Credit Card B", 8356, 20.47, 212),
        Debt("Medical Bill", 3540, 2.08, 66),
    ]


def save_total_debt_curve() -> None:
    debts = example_debts()
    comp = compare(debts, income=4219, expenses=3376, extra=200, start_date=date(2026, 4, 1))
    avalanche = comp["avalanche"]
    snowball = comp["snowball"]

    months_a = [m["month"] for m in avalanche.monthly_payments]
    remain_a = [m["total_remaining"] for m in avalanche.monthly_payments]
    months_s = [m["month"] for m in snowball.monthly_payments]
    remain_s = [m["total_remaining"] for m in snowball.monthly_payments]

    plt.figure(figsize=(10, 5.2), facecolor=BG)
    ax = plt.gca()
    ax.plot(months_a, remain_a, label="Avalanche", linewidth=2.5, color="#1b9e77")
    ax.plot(months_s, remain_s, label="Snowball", linewidth=2.5, color="#3b82f6")
    style_axes(ax, "Debt Remaining Over Time", "Month", "Total Remaining Debt ($)")
    ax.legend()
    plt.tight_layout()
    plt.savefig(OUT_DIR / "debt_total_curve.png", dpi=180, facecolor=BG)
    plt.close()


def save_payment_power_plot() -> None:
    debt = Debt("Credit Card", 4000, 24.0, 120)
    low = simulate([debt], monthly_income=3500, monthly_expenses=3380, method="avalanche", start_date=date(2026, 4, 1))
    high = simulate([Debt("Credit Card", 4000, 24.0, 120)], monthly_income=3500, monthly_expenses=3280, method="avalanche", start_date=date(2026, 4, 1))

    months_l = [m["month"] for m in low.monthly_payments]
    rem_l = [m["total_remaining"] for m in low.monthly_payments]
    months_h = [m["month"] for m in high.monthly_payments]
    rem_h = [m["total_remaining"] for m in high.monthly_payments]

    plt.figure(figsize=(10, 5.2), facecolor=BG)
    ax = plt.gca()
    ax.plot(months_l, rem_l, label="$120/month", linewidth=2.5, color="#ef4444")
    ax.plot(months_h, rem_h, label="$220/month", linewidth=2.5, color="#10b981")
    style_axes(ax, "Same Debt, Different Monthly Payment", "Month", "Remaining Balance ($)")
    ax.legend()
    plt.tight_layout()
    plt.savefig(OUT_DIR / "debt_payment_power.png", dpi=180, facecolor=BG)
    plt.close()


def save_start_date_delay_plot() -> None:
    immediate = simulate([Debt("Credit Card", 4000, 24.0, 250)], 3600, 3350, "avalanche", start_date=date(2026, 4, 1))

    # Waiting 4 months: let interest accrue without payment first.
    bal = 4000.0
    monthly_rate = 24.0 / 100.0 / 12.0
    for _ in range(4):
        bal += bal * monthly_rate
    delayed = simulate([Debt("Credit Card", bal, 24.0, 250)], 3600, 3350, "avalanche", start_date=date(2026, 8, 1))

    x1 = [m["month"] for m in immediate.monthly_payments]
    y1 = [m["total_remaining"] for m in immediate.monthly_payments]
    x2 = [m["month"] for m in delayed.monthly_payments]
    y2 = [m["total_remaining"] for m in delayed.monthly_payments]

    plt.figure(figsize=(10, 5.2), facecolor=BG)
    ax = plt.gca()
    ax.plot(x1, y1, label="Start now", linewidth=2.5, color="#2563eb")
    ax.plot(x2, y2, label="Start in 4 months", linewidth=2.5, color="#f59e0b")
    style_axes(ax, "Delaying Payoff Adds Cost", "Months Since Plan Start", "Remaining Balance ($)")
    ax.legend()
    plt.tight_layout()
    plt.savefig(OUT_DIR / "debt_start_delay.png", dpi=180, facecolor=BG)
    plt.close()


def save_method_breakdown_plot() -> None:
    debts = example_debts()
    comp = compare(debts, income=4219, expenses=3376, extra=200, start_date=date(2026, 4, 1))
    avalanche = comp["avalanche"]
    snowball = comp["snowball"]

    dollars_metrics = ["Interest", "Total Paid"]
    aval_dollars = [avalanche.total_interest, avalanche.total_paid]
    snow_dollars = [snowball.total_interest, snowball.total_paid]

    width = 0.34
    x_dollars = np.arange(len(dollars_metrics))

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11.2, 5.2), facecolor=BG)

    bars1 = ax1.bar(x_dollars - width / 2, aval_dollars, width, label="Avalanche", color="#14b8a6")
    bars2 = ax1.bar(x_dollars + width / 2, snow_dollars, width, label="Snowball", color="#6366f1")
    style_axes(ax1, "Cost Comparison ($)", "Metric", "Dollars")
    ax1.set_xticks(x_dollars)
    ax1.set_xticklabels(dollars_metrics)
    ax1.legend(facecolor=PLOT_BG, edgecolor=MUTED)

    months_vals = [avalanche.months_to_payoff, snowball.months_to_payoff]
    x_months = np.arange(2)
    bars3 = ax2.bar(x_months, months_vals, width=0.56, color=["#14b8a6", "#6366f1"])
    style_axes(ax2, "Speed Comparison (Months)", "Method", "Months")
    ax2.set_xticks(x_months)
    ax2.set_xticklabels(["Avalanche", "Snowball"])

    for bars in (bars1, bars2, bars3):
        for b in bars:
            h = b.get_height()
            ax = b.axes
            ax.text(b.get_x() + b.get_width() / 2, h, f"{h:,.0f}", ha="center", va="bottom", fontsize=8)

    fig.suptitle("Avalanche vs Snowball (Same Inputs)", fontsize=14, fontweight="bold", color=FG)
    fig.tight_layout(rect=(0.0, 0.0, 1.0, 0.96))
    plt.savefig(OUT_DIR / "debt_method_comparison.png", dpi=180, facecolor=BG)
    plt.close()


def main() -> None:
    save_total_debt_curve()
    save_payment_power_plot()
    save_start_date_delay_plot()
    save_method_breakdown_plot()
    print("Generated debt blog images in", OUT_DIR)


if __name__ == "__main__":
    main()
