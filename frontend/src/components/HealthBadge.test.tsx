import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HealthBadge } from "./HealthBadge";

vi.mock("../hooks/useHealth", () => ({
  useHealth: () => ({
    data: { status: "ok", version: "0.1.0", environment: "test" },
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

describe("HealthBadge", () => {
  it("renders connected state", () => {
    render(<HealthBadge />);
    expect(screen.getByText(/Connected/)).toBeInTheDocument();
    expect(screen.getByText(/v0\.1\.0/)).toBeInTheDocument();
  });
});
