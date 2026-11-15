import { describe, expect, it } from "vite-plus/test";
import { summarizeChecks } from "./gh.ts";

describe("summarizeChecks", () => {
  it("los checks ignorados no cuentan, ni como fallo ni como pendiente", () => {
    const rollup = [
      { name: "Check, test, build", status: "COMPLETED", conclusion: "SUCCESS" },
      { context: "Vercel", state: "FAILURE" },
      { name: "Vercel Preview Comments", status: "IN_PROGRESS" },
    ];
    expect(summarizeChecks(rollup)).toBe("failing");
    // Nombre completo: ignorar "vercel" no ignora "Vercel Preview Comments".
    expect(summarizeChecks(rollup, ["vercel"])).toBe("pending");
    expect(summarizeChecks(rollup, ["vercel", "Vercel Preview Comments"])).toBe("passing");
  });

  it("si todo se ignora, no queda ningún check", () => {
    expect(summarizeChecks([{ context: "Vercel", state: "FAILURE" }], ["Vercel"])).toBe("none");
  });

  it("sin checks es none", () => {
    expect(summarizeChecks([])).toBe("none");
  });

  it("todo completo y bien es passing, aunque haya skipped o neutral", () => {
    expect(
      summarizeChecks([
        { status: "COMPLETED", conclusion: "SUCCESS" },
        { status: "COMPLETED", conclusion: "SKIPPED" },
        { status: "COMPLETED", conclusion: "NEUTRAL" },
        { state: "SUCCESS" },
      ]),
    ).toBe("passing");
  });

  it("algo corriendo es pending", () => {
    expect(
      summarizeChecks([{ status: "COMPLETED", conclusion: "SUCCESS" }, { status: "IN_PROGRESS" }]),
    ).toBe("pending");
    expect(summarizeChecks([{ state: "PENDING" }])).toBe("pending");
  });

  it("un fallo o un cancelado gana sobre todo lo demás", () => {
    expect(
      summarizeChecks([{ status: "IN_PROGRESS" }, { status: "COMPLETED", conclusion: "FAILURE" }]),
    ).toBe("failing");
    expect(summarizeChecks([{ status: "COMPLETED", conclusion: "CANCELLED" }])).toBe("failing");
    expect(summarizeChecks([{ state: "ERROR" }])).toBe("failing");
  });
});
