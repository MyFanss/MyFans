import { describe, expect, it } from "vitest";
import {
  validateHttpsUrl,
  validateInstagramHandle,
  validateUsername,
  validateXHandle,
} from "./profile";

describe("profile validation", () => {
  it("accepts empty optional fields", () => {
    expect(validateHttpsUrl("", "Site")).toBeUndefined();
    expect(validateXHandle("")).toBeUndefined();
    expect(validateInstagramHandle("")).toBeUndefined();
    expect(validateUsername("")).toBeUndefined();
  });

  it("validates https URLs", () => {
    expect(validateHttpsUrl("https://example.com/path", "Site")).toBeUndefined();
    expect(validateHttpsUrl("http://a.co", "Site")).toBeUndefined();
    expect(validateHttpsUrl("ftp://x.com", "Site")).toContain("http");
    expect(validateHttpsUrl("not-a-url", "Site")).toBeDefined();
  });

  it("validates X handles", () => {
    expect(validateXHandle("@jack")).toBeUndefined();
    expect(validateXHandle("valid_user_12")).toBeUndefined();
    expect(validateXHandle("toolonghandleforthistowork")).toBeDefined();
  });

  it("validates Instagram handles", () => {
    expect(validateInstagramHandle("@user.name")).toBeUndefined();
    expect(validateInstagramHandle("bad space")).toBeDefined();
  });

  it("validates username when present", () => {
    expect(validateUsername("ab")).toBeDefined();
    expect(validateUsername("good.name_01")).toBeUndefined();
  });
});
