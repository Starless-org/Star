import { describe, expect, it } from "vite-plus/test";
import { workflowInputs } from "./doctor.ts";
import type { Gh } from "./gh.ts";
import { declaredInputs, starWorkflowUses } from "./workflow-inputs.ts";

const WEB_RELEASE_V070 = `name: Web release

on:
  workflow_call:
    inputs:
      version:
        description: La versión, sin la v.
        type: string
        required: true
      assets:
        type: string
        default: ""
    secrets:
      token:
        required: false

jobs:
  release:
    runs-on: ubuntu-latest
`;

const APP_RELEASE = `name: Release
on:
  push:
    tags: ["v*"]
jobs:
  verify:
    uses: baironvillar/star/.github/workflows/verify.yml@v0.7.0
  release:
    needs: verify
    uses: baironvillar/star/.github/workflows/web-release.yml@v0.7.0
    with:
      # un comentario
      version: \${{ needs.verify.outputs.version }}
      publish: \${{ needs.verify.outputs.publish }}
    secrets: inherit
`;

const gh = (workflow: string | null, available = true): Gh =>
  ({ available: () => available, starWorkflow: () => workflow }) as unknown as Gh;

describe("declaredInputs", () => {
  it("lee sólo los inputs de workflow_call, no los secretos ni los jobs", () => {
    expect(declaredInputs(WEB_RELEASE_V070)).toEqual(["version", "assets"]);
    expect(declaredInputs("on: push\njobs: {}\n")).toEqual([]);
  });
});

describe("starWorkflowUses", () => {
  it("devuelve cada uso con las claves de su with", () => {
    expect(starWorkflowUses(APP_RELEASE)).toEqual([
      { file: "verify.yml", version: "0.7.0", inputs: [] },
      { file: "web-release.yml", version: "0.7.0", inputs: ["version", "publish"] },
    ]);
  });

  it("encuentra el with aunque vaya antes del uses", () => {
    const text =
      "jobs:\n  r:\n    with:\n      a: 1\n    uses: baironvillar/star/.github/workflows/x.yml@v1.0.0\n";
    expect(starWorkflowUses(text)[0]?.inputs).toEqual(["a"]);
  });

  it("reconoce el repo con su nombre nuevo, Starless-org/Star", () => {
    const text =
      "jobs:\n  r:\n    uses: Starless-org/Star/.github/workflows/x.yml@v1.0.0\n    with:\n      a: 1\n";
    expect(starWorkflowUses(text)[0]?.file).toBe("x.yml");
  });
});

describe("workflowInputs", () => {
  it("un input que esa versión no define es un error (publish en v0.7.0)", () => {
    const found = workflowInputs([APP_RELEASE], gh(WEB_RELEASE_V070));
    expect(found).toHaveLength(1);
    expect(found[0]?.level).toBe("error");
    expect(found[0]?.message).toMatch(/web-release\.yml@v0\.7\.0 no define el input publish/);
  });

  it("con todos los inputs definidos, está bien", () => {
    const withPublish = WEB_RELEASE_V070.replace(
      "      assets:",
      "      publish:\n        type: string\n      assets:",
    );
    expect(workflowInputs([APP_RELEASE], gh(withPublish)).map((f) => f.level)).toEqual(["ok"]);
  });

  it("si no puede leer el workflow, avisa; sin gh, no dice nada", () => {
    expect(workflowInputs([APP_RELEASE], gh(null)).map((f) => f.level)).toEqual(["warn"]);
    expect(workflowInputs([APP_RELEASE], gh(null, false))).toEqual([]);
  });
});
