/**
 * Server API disabled — static site only; no backend calls from the player UI.
 */
const NeonDrawApi = (() => ({
  base: () => '',
  useServer: () => false,
}))();

window.NeonDrawApi = NeonDrawApi;
