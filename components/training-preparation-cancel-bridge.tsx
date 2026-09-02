"use client";

import { useEffect } from "react";
import {
  findTrainingPreparationContainer,
  isTrainingPreparationHeading,
  TRAINING_PREPARATION_CANCEL_ID,
} from "@/lib/training-preparation-dom.mjs";

function findTransportCancelButton() {
  for (const button of document.querySelectorAll("button")) {
    if (button.id === TRAINING_PREPARATION_CANCEL_ID) continue;
    if ((button.textContent || "").trim() === "中断准备") return button as HTMLButtonElement;
  }
  return null;
}

export function TrainingPreparationCancelBridge() {
  useEffect(() => {
    const cancelPreparation = () => {
      // Prefer the existing transport cancellation so active web/AI fetches receive AbortSignal.
      // Always reload afterwards so cancellation also works before the first request is created.
      findTransportCancelButton()?.click();
      window.stop();
      window.setTimeout(() => window.location.reload(), 0);
    };

    const syncButton = () => {
      const container = findTrainingPreparationContainer(document) as HTMLElement | null;
      const existing = document.getElementById(TRAINING_PREPARATION_CANCEL_ID);

      if (!container) {
        existing?.parentElement?.remove();
        return;
      }
      if (existing) return;

      const heading = Array.from(container.querySelectorAll("h1")).find((item) => isTrainingPreparationHeading(item.textContent));
      const content = heading?.parentElement ?? container;
      const actionRow = document.createElement("div");
      actionRow.dataset.trainingPreparationCancelRow = "true";
      actionRow.className = "mt-6 flex justify-center";

      const button = document.createElement("button");
      button.id = TRAINING_PREPARATION_CANCEL_ID;
      button.type = "button";
      button.textContent = "中断准备";
      button.setAttribute("aria-label", "中断当前题组准备");
      button.className = "inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-200";
      button.addEventListener("click", cancelPreparation);
      actionRow.appendChild(button);
      content.appendChild(actionRow);
    };

    syncButton();
    const observer = new MutationObserver(syncButton);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      const button = document.getElementById(TRAINING_PREPARATION_CANCEL_ID);
      button?.removeEventListener("click", cancelPreparation);
      const row = button?.parentElement;
      if (row?.dataset.trainingPreparationCancelRow === "true") row.remove();
    };
  }, []);

  return null;
}
