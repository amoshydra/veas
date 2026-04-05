import { RealApiClient } from "./client.js";

export type ApiMode = "real";

export function getApiMode(): ApiMode {
  return "real";
}

export function setApiMode(_mode: ApiMode) {
  // no-op: production always uses real API
}

export function getServerUrl(): string | undefined {
  return localStorage.getItem("veas_server_url") || undefined;
}

export function setServerUrl(url: string | undefined) {
  if (url) {
    localStorage.setItem("veas_server_url", url);
  } else {
    localStorage.removeItem("veas_server_url");
  }
}

export function createApiClient() {
  const serverUrl = getServerUrl();
  return new RealApiClient(serverUrl);
}
