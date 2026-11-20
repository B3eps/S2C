"""Plot the first losing and first winning trade from the archived VWAP test."""
import json
from datetime import datetime, timezone
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
from matplotlib.patches import Patch, Rectangle


MINUTE = 60_000
SPREAD = 0.20
ROOT = Path(__file__).resolve().parents[2]


def plot_trade(ax, panel):
    trade = panel["trade"]
    bars = panel["bars"]
    entry_time = trade["openedAt"]
    exit_candle = (trade["closedAt"] - entry_time) / MINUTE - 1
    end_minute = min(25, max(8, exit_candle + 3))
    setup = trade["context"]
    reference, atr = setup["reference"], setup["atr"]
    short = trade["side"] == "short"
    sign = -1 if short else 1
    sl_bid = trade["sl"] - (SPREAD if short else 0)
    tp_bid = trade["tp"] - (SPREAD if short else 0)

    ax.axhspan(*sorted([reference - sign * atr, reference - sign * 1.5 * atr]),
               color="#92b7ef", alpha=0.22)
    ax.axhline(reference, color="#2359a6", linestyle="--", lw=1.15)
    ax.axhline(reference - sign * 2 * atr, color="#8555a4", lw=1.1, linestyle=":")
    ax.axhline(sl_bid, color="#a43d30", linestyle="--", lw=1.0)
    ax.axhline(tp_bid, color="#057e70", linestyle="--", lw=1.0)
    ax.axvspan(-1.5, -0.5, color="#f5cc75", alpha=0.34)
    ax.axvline(0, color="#536473", lw=0.75, alpha=0.7)

    weight = weighted = 0
    xs, values = [], []
    for b in bars:
        x = (b["t"] - entry_time) / MINUTE
        if x > end_minute:
            break
        weight += b["v"]
        weighted += (b["h"] + b["l"] + b["c"]) / 3 * b["v"]
        if x < -6:
            continue
        xs.append(x)
        values.append(weighted / weight)
        color = "#157a65" if b["c"] >= b["o"] else "#ba5b48"
        ax.vlines(x, b["l"], b["h"], color=color, linewidth=1.15, zorder=3)
        ax.add_patch(Rectangle((x - 0.26, min(b["o"], b["c"])), 0.52,
                               max(abs(b["o"] - b["c"]), 0.025),
                               facecolor=color, edgecolor="none", zorder=3))
    ax.plot(xs, values, color="#2359a6", lw=1.65, zorder=2)
    ax.scatter(0, trade["entry"], marker="^" if not short else "v",
               color="#1c2f42", s=43, linewidth=0, zorder=5)
    ax.scatter(exit_candle, trade["exit"] - (SPREAD if short else 0),
               marker="X", color="#1c2f42", s=42, linewidth=0, zorder=5)

    dt = datetime.fromtimestamp(entry_time / 1000, timezone.utc)
    money = f'{trade["pnl"]:+.2f}'.replace(".", ",").replace("-", "−")
    ax.set_title(f'{dt:%d.%m.%Y %H:%M} UTC  ·  {trade["side"]}  ·  {money} $',
                 loc="left", fontsize=12, fontweight="bold", pad=10)
    ax.set_xlim(-6.6, end_minute + 0.6)
    ax.set_ylabel("Bid fiyatı ($/ons)", labelpad=10)
    ax.ticklabel_format(style="plain", axis="y", useOffset=False)
    ax.grid(axis="y", color="#e4e9ef", linewidth=0.85, zorder=0)
    for spine in ax.spines.values():
        spine.set_color("#dbe2e9")
    ax.tick_params(length=0, pad=6, labelcolor="#3e4e5b")


def main():
    panels = json.loads((ROOT / "analysis/research-vwap-chart-data.json").read_text(encoding="utf-8"))
    panels.sort(key=lambda d: d["trade"]["openedAt"])
    fig, axes = plt.subplots(2, 1, figsize=(10.2, 7.45), dpi=150, facecolor="#ffffff")
    fig.subplots_adjust(left=0.11, right=0.965, top=0.86, bottom=0.25, hspace=0.44)
    fig.text(0.11, 0.952, "VWAP’a dönüş · iki simülasyon işlemi",
             fontsize=21, fontweight="bold", color="#1c2f42")
    fig.text(0.11, 0.912, "Kronolojik ilk stop ve ilk hedef. Sıfır, sinyalden sonraki giriş açılışıdır.",
             fontsize=10.5, color="#3e4e5b")
    for ax, panel in zip(axes, panels):
        plot_trade(ax, panel)
    axes[-1].set_xlabel("Giriş açılışına göre dakika", labelpad=8)
    handles = [
        Line2D([], [], color="#2359a6", lw=1.65, label="Dinamik VWAP"),
        Line2D([], [], color="#2359a6", lw=1.15, ls="--", label="Sinyal anında sabitlenen VWAP"),
        Line2D([], [], color="#8555a4", lw=1.1, ls=":", label="2 ATR taşma çizgisi"),
        Patch(facecolor="#92b7ef", alpha=0.42, label="1–1,5 ATR kapanış bandı"),
        Patch(facecolor="#f5cc75", alpha=0.52, label="Sinyal mumu"),
        Line2D([], [], color="#a43d30", lw=1, ls="--", label="Stop"),
        Line2D([], [], color="#057e70", lw=1, ls="--", label="1,25 R hedefi"),
        Line2D([], [], color="#1c2f42", marker="^", ls="", label="Giriş kotasyonu"),
        Line2D([], [], color="#1c2f42", marker="X", ls="", label="Çıkış mumu"),
    ]
    fig.legend(handles=handles, ncol=3, loc="lower left", bbox_to_anchor=(0.105, 0.068),
               frameon=False, fontsize=9, columnspacing=1.75)
    fig.text(0.11, 0.035, "Mumlar Dukascopy bid. Long giriş işareti ask fiyatıdır. Çıkış işareti mum içi sıralamayı göstermez.",
             fontsize=8.5, color="#566675")
    fig.savefig(ROOT / "analysis/research-vwap-cizgiler.png", facecolor=fig.get_facecolor())


if __name__ == "__main__":
    main()
