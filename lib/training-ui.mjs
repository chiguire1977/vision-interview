export function shouldShowTrainingSettings(preparingGroup, manuallyExpanded) {
  return Boolean(preparingGroup || manuallyExpanded);
}
