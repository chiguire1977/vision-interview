export const TRAINING_PREPARATION_HEADING = "正在准备本题组";
export const TRAINING_PREPARATION_CANCEL_ID = "vision-interview-training-preparation-cancel";

function normalizeText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function isTrainingPreparationHeading(value) {
  return normalizeText(value) === TRAINING_PREPARATION_HEADING;
}

export function shouldMountTrainingPreparationCancel({ headingText, hasExistingButton } = {}) {
  return isTrainingPreparationHeading(headingText) && !hasExistingButton;
}

export function findTrainingPreparationContainer(root) {
  if (!root || typeof root.querySelectorAll !== "function") return null;
  for (const heading of root.querySelectorAll("h1")) {
    if (!isTrainingPreparationHeading(heading?.textContent)) continue;
    if (typeof heading.closest === "function") return heading.closest("section") || heading.parentElement || null;
    return heading.parentElement || null;
  }
  return null;
}
