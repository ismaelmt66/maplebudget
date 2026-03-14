import { describe, it, expect, vi, beforeEach } from "vitest";
import { getToken, setToken, getRefreshToken, setRefreshToken, clearToken } from "@/lib/auth";

describe("auth token management", () => {
  beforeEach(() => {
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    vi.mocked(localStorage.setItem).mockClear();
    vi.mocked(localStorage.removeItem).mockClear();
  });

  it("getToken returns null when no token set", () => {
    expect(getToken()).toBeNull();
  });

  it("setToken stores token in localStorage", () => {
    setToken("test-token");
    expect(localStorage.setItem).toHaveBeenCalledWith("nexledger_token", "test-token");
  });

  it("setRefreshToken stores refresh token", () => {
    setRefreshToken("refresh-token");
    expect(localStorage.setItem).toHaveBeenCalledWith("nexledger_refresh_token", "refresh-token");
  });

  it("getToken returns stored token", () => {
    vi.mocked(localStorage.getItem).mockReturnValue("stored-token");
    expect(getToken()).toBe("stored-token");
  });

  it("getRefreshToken returns stored refresh token", () => {
    vi.mocked(localStorage.getItem).mockReturnValue("stored-refresh");
    expect(getRefreshToken()).toBe("stored-refresh");
  });

  it("clearToken removes both tokens", () => {
    clearToken();
    expect(localStorage.removeItem).toHaveBeenCalledWith("nexledger_token");
    expect(localStorage.removeItem).toHaveBeenCalledWith("nexledger_refresh_token");
  });
});
