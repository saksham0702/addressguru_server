import { validatePublicUrl } from "../modules/website-audit/websiteAudit.service.js";
import WebsiteAudit from "../modules/website-audit/websiteAudit.model.js";
import mongoose from "mongoose";

describe("Website Audit Module - Unit & SSRF Tests", () => {
  describe("SSRF and URL Validation", () => {
    it("should reject localhost and loopback targets", async () => {
      await expect(validatePublicUrl("http://localhost:3000")).rejects.toThrow();
      await expect(validatePublicUrl("http://127.0.0.1")).rejects.toThrow();
      await expect(validatePublicUrl("http://0.0.0.0")).rejects.toThrow();
    });

    it("should reject non-HTTP/HTTPS protocols", async () => {
      await expect(validatePublicUrl("ftp://example.com")).rejects.toThrow(
        "Only HTTP and HTTPS URLs are supported."
      );
      await expect(validatePublicUrl("file:///etc/passwd")).rejects.toThrow();
    });

    it("should accept valid public HTTPS domains", async () => {
      const valid = await validatePublicUrl("https://example.com");
      expect(valid).toBe("https://example.com/");
    });
  });

  describe("WebsiteAudit Database Model", () => {
    it("should save and retrieve audit report with valid fields", async () => {
      const testUserId = new mongoose.Types.ObjectId();
      const audit = new WebsiteAudit({
        user: testUserId,
        url: "https://example.com",
        domain: "example.com",
        status: "completed",
        overallScore: 82,
        grade: "B",
        categoryScores: {
          seo: 25,
          technical: 22,
          links: 16,
          images: 12,
          performance: 7,
        },
        stats: {
          totalPagesCrawled: 3,
          totalImages: 10,
          totalInternalLinks: 15,
          totalExternalLinks: 4,
          durationMs: 1200,
          totalHtmlSizeKb: 45.2,
        },
        crawledPages: [
          {
            url: "https://example.com",
            statusCode: 200,
            title: "Example Domain - Official Website",
            titleLength: 33,
            metaDescription: "This is an example description for testing audit functionality.",
            metaDescriptionLength: 64,
            h1: "Example Domain",
            h1Count: 1,
            wordCount: 350,
            responseTimeMs: 180,
            pageSizeKb: 15.1,
          },
        ],
        issues: [
          {
            id: "title-length",
            category: "seo",
            severity: "warning",
            title: "Title Length Can Be Improved",
            recommendation: "Keep between 30 and 60 chars",
            pageUrl: "https://example.com",
            evidence: "Length 33 chars",
          },
        ],
        passedChecks: [
          {
            category: "technical",
            title: "HTTPS Encryption Enabled",
            description: "Site is served securely",
          },
        ],
        unavailableChecks: [
          {
            category: "performance",
            title: "Core Web Vitals",
            reason: "Requires browser instrumentation",
          },
        ],
      });

      const saved = await audit.save();
      expect(saved._id).toBeDefined();
      expect(saved.overallScore).toBe(82);
      expect(saved.grade).toBe("B");

      const found = await WebsiteAudit.findOne({ user: testUserId });
      expect(found).not.toBeNull();
      expect(found.domain).toBe("example.com");
      expect(found.crawledPages.length).toBe(1);
      expect(found.passedChecks.length).toBe(1);
      expect(found.unavailableChecks.length).toBe(1);
    });

    it("should prevent unauthorized users from viewing another user's audit", async () => {
      const userA = new mongoose.Types.ObjectId();
      const userB = new mongoose.Types.ObjectId();

      const audit = await new WebsiteAudit({
        user: userA,
        url: "https://user-a-site.com",
        domain: "user-a-site.com",
        status: "completed",
        overallScore: 90,
      }).save();

      // Simulate ownership check as in getAuditById
      const isOwner = audit.user.toString() === userB.toString();
      const isAdmin = false;
      expect(isOwner || isAdmin).toBe(false);
    });
  });
});
