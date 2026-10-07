import WhatsappCampaign from "./whatsappCampaign.model.js";
import WhatsappAccount from "../whatsapp/whatsappAccount.model.js";
import {
  getCloudApiConfig,
  updateCloudApiConfig,
  testOfficialCloudApi,
} from "../whatsapp/services/whatsappCloudApi.service.js";
import {
  generateSampleExcelBuffer,
  parseExcelContacts,
  fetchDatabaseAudience,
  executeCampaign,
  pauseCampaign as pauseCampaignService,
  resumeCampaign as resumeCampaignService,
  cancelCampaign as cancelCampaignService,
  retryFailedRecipients as retryFailedService,
} from "./whatsappBulk.service.js";

/**
 * Download sample Excel spreadsheet
 */
export async function downloadSampleTemplate(req, res) {
  try {
    const buffer = generateSampleExcelBuffer();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="whatsapp_bulk_contacts_sample.xlsx"'
    );
    return res.send(buffer);
  } catch (err) {
    console.error("[WhatsAppBulk] Error generating sample template:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to generate sample Excel template",
      error: err.message,
    });
  }
}

/**
 * Preview audience before creating campaign
 */
export async function previewAudience(req, res) {
  try {
    const {
      sourceType = "database",
      modules = ["business", "property", "marketplace", "jobs", "users"],
      role = "all",
      listingStatus = "all",
      city = "all",
      deduplicate = true,
    } = req.body || {};

    let contacts = [];

    if (sourceType === "excel") {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({
          success: false,
          message: "Please upload an Excel spreadsheet (.xlsx, .xls, .csv)",
        });
      }
      contacts = parseExcelContacts(req.file.buffer);
    } else {
      let parsedModules = modules;
      if (typeof modules === "string") {
        try {
          parsedModules = JSON.parse(modules);
        } catch (e) {
          parsedModules = modules.split(",").map((m) => m.trim());
        }
      }

      contacts = await fetchDatabaseAudience({
        modules: parsedModules,
        role,
        listingStatus,
        city,
        deduplicate: deduplicate === "true" || deduplicate === true,
      });
    }

    return res.status(200).json({
      success: true,
      totalCount: contacts.length,
      contacts: contacts,
      sample: contacts.slice(0, 15),
      summaryByModule: contacts.reduce((acc, curr) => {
        acc[curr.sourceModule] = (acc[curr.sourceModule] || 0) + 1;
        return acc;
      }, {}),
    });
  } catch (err) {
    console.error("[WhatsAppBulk] Error previewing audience:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to preview audience",
    });
  }
}

/**
 * Create a new campaign
 */
export async function createCampaign(req, res) {
  try {
    const body = req.body || {};
    const name = body.name || `Campaign - ${new Date().toLocaleDateString()}`;
    const messageText = body.messageText;
    const sourceType = body.sourceType || "database";
    const templateId = body.templateId || null;
    const autoStart = body.autoStart === "true" || body.autoStart === true;

    if (!messageText) {
      return res.status(400).json({
        success: false,
        message: "Message text is required",
      });
    }

    // Anti-ban settings
    const minDelaySeconds = Number(body.minDelaySeconds) || 3;
    const maxDelaySeconds = Number(body.maxDelaySeconds) || 20;
    const batchSize = Number(body.batchSize) || 50;
    const batchCooldownSeconds = Number(body.batchCooldownSeconds) || 60;

    let recipients = [];
    let excelOriginalName = null;
    let sourceFilters = {};

    // Check if frontend provided a custom selection of recipients
    if (body.selectedRecipients) {
      let customList = body.selectedRecipients;
      if (typeof customList === "string") {
        try {
          customList = JSON.parse(customList);
        } catch (e) {
          customList = [];
        }
      }
      if (Array.isArray(customList) && customList.length > 0) {
        recipients = customList;
      }
    }

    if (!recipients || recipients.length === 0) {
      if (sourceType === "excel") {
        const excelFile = req.files?.excelFile?.[0] || req.file;
        if (!excelFile || !excelFile.buffer) {
          return res.status(400).json({
            success: false,
            message: "Excel file is required when sourceType is 'excel'",
          });
        }
        recipients = parseExcelContacts(excelFile.buffer);
        excelOriginalName = excelFile.originalname;
      } else {
        let modules = body.modules || [
          "business",
          "property",
          "marketplace",
          "jobs",
          "users",
        ];
        if (typeof modules === "string") {
          try {
            modules = JSON.parse(modules);
          } catch (e) {
            modules = modules.split(",").map((m) => m.trim());
          }
        }

        const role = body.role || "all";
        const listingStatus = body.listingStatus || "all";
        const city = body.city || "all";
        const deduplicate =
          body.deduplicate === "true" || body.deduplicate === true;

        sourceFilters = {
          modules,
          role,
          listingStatus,
          city,
          deduplicate,
        };

        recipients = await fetchDatabaseAudience(sourceFilters);
      }
    }

    if (!recipients || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid recipients found matching your audience criteria",
      });
    }

    // Handle media attachment if provided
    let messageType = body.messageType || "text";
    let mediaUrl = body.mediaUrl || null;
    let mediaFileName = null;
    let mediaMimeType = null;

    const mediaFile = req.files?.mediaFile?.[0];
    if (mediaFile) {
      mediaFileName = mediaFile.originalname;
      mediaMimeType = mediaFile.mimetype;
      // If file saved locally or in buffer
      if (mediaFile.path) {
        mediaUrl = mediaFile.path;
      }
      if (mediaMimeType.startsWith("image/")) messageType = "image";
      else if (mediaMimeType.startsWith("video/")) messageType = "video";
      else if (mediaMimeType.startsWith("audio/")) messageType = "audio";
      else messageType = "document";
    }

    const provider = body.provider || "baileys";

    const campaign = new WhatsappCampaign({
      name,
      status: "draft",
      sourceType,
      provider,
      sourceFilters,
      excelOriginalName,
      messageType,
      messageText,
      mediaUrl,
      mediaFileName,
      mediaMimeType,
      templateId,
      antiBanSettings: {
        minDelaySeconds,
        maxDelaySeconds,
        batchSize,
        batchCooldownSeconds,
      },
      recipients,
      createdBy: req.user?._id || null,
    });

    campaign.updateStats();
    await campaign.save();

    if (autoStart) {
      executeCampaign(campaign._id).catch((err) =>
        console.error("[WhatsAppBulk] Auto-start failed:", err)
      );
    }

    return res.status(201).json({
      success: true,
      message: `Campaign "${campaign.name}" created with ${recipients.length} recipients`,
      campaign: {
        _id: campaign._id,
        name: campaign.name,
        status: campaign.status,
        stats: campaign.stats,
        createdAt: campaign.createdAt,
      },
    });
  } catch (err) {
    console.error("[WhatsAppBulk] Error creating campaign:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to create campaign",
    });
  }
}

/**
 * Get all campaigns with pagination and filter
 */
export async function getCampaigns(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;
    const search = req.query.search;

    const query = {};
    if (status && status !== "all") {
      query.status = status;
    }
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const total = await WhatsappCampaign.countDocuments(query);
    const campaigns = await WhatsappCampaign.find(query)
      .select(
        "-recipients.renderedMessage -recipients.errorReason"
      )
      .select({
        recipients: { $slice: 5 }, // return first 5 sample recipients only for speed
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("createdBy", "name email")
      .lean();

    return res.status(200).json({
      success: true,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      campaigns,
    });
  } catch (err) {
    console.error("[WhatsAppBulk] Error fetching campaigns:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch campaigns",
      error: err.message,
    });
  }
}

/**
 * Get campaign by ID with full details & recipient list
 */
export async function getCampaignById(req, res) {
  try {
    const { id } = req.params;
    const recipientStatus = req.query.recipientStatus;
    const search = req.query.search;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    const campaign = await WhatsappCampaign.findById(id)
      .populate("createdBy", "name email")
      .lean();

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    // Filter and paginate recipients
    let filteredRecipients = campaign.recipients || [];

    if (recipientStatus && recipientStatus !== "all") {
      filteredRecipients = filteredRecipients.filter(
        (r) => r.status === recipientStatus
      );
    }

    if (search) {
      const s = search.toLowerCase();
      filteredRecipients = filteredRecipients.filter(
        (r) =>
          (r.name && r.name.toLowerCase().includes(s)) ||
          (r.businessName && r.businessName.toLowerCase().includes(s)) ||
          (r.contactPersonName && r.contactPersonName.toLowerCase().includes(s)) ||
          (r.phone && r.phone.includes(s))
      );
    }

    const totalRecipients = filteredRecipients.length;
    const paginatedRecipients = filteredRecipients.slice(
      (page - 1) * limit,
      page * limit
    );

    return res.status(200).json({
      success: true,
      campaign: {
        ...campaign,
        recipients: paginatedRecipients,
        recipientPagination: {
          total: totalRecipients,
          page,
          totalPages: Math.ceil(totalRecipients / limit),
        },
      },
    });
  } catch (err) {
    console.error("[WhatsAppBulk] Error fetching campaign detail:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch campaign details",
      error: err.message,
    });
  }
}

/**
 * Start or resume a campaign
 */
export async function startCampaign(req, res) {
  try {
    const { id } = req.params;
    const campaign = await executeCampaign(id);
    return res.status(200).json({
      success: true,
      message: `Campaign "${campaign.name}" started successfully`,
      status: campaign.status,
    });
  } catch (err) {
    console.error("[WhatsAppBulk] Error starting campaign:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to start campaign",
    });
  }
}

/**
 * Pause a campaign
 */
export async function pauseCampaign(req, res) {
  try {
    const { id } = req.params;
    const campaign = await pauseCampaignService(id);
    return res.status(200).json({
      success: true,
      message: `Campaign "${campaign.name}" paused`,
      status: campaign.status,
    });
  } catch (err) {
    console.error("[WhatsAppBulk] Error pausing campaign:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to pause campaign",
    });
  }
}

/**
 * Resume a paused campaign
 */
export async function resumeCampaign(req, res) {
  try {
    const { id } = req.params;
    const campaign = await resumeCampaignService(id);
    return res.status(200).json({
      success: true,
      message: `Campaign "${campaign.name}" resumed`,
      status: campaign.status,
    });
  } catch (err) {
    console.error("[WhatsAppBulk] Error resuming campaign:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to resume campaign",
    });
  }
}

/**
 * Cancel/Stop a campaign
 */
export async function cancelCampaign(req, res) {
  try {
    const { id } = req.params;
    const campaign = await cancelCampaignService(id);
    return res.status(200).json({
      success: true,
      message: `Campaign "${campaign.name}" cancelled`,
      status: campaign.status,
    });
  } catch (err) {
    console.error("[WhatsAppBulk] Error cancelling campaign:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to cancel campaign",
    });
  }
}

/**
 * Retry failed recipients
 */
export async function retryFailedRecipients(req, res) {
  try {
    const { id } = req.params;
    const campaign = await retryFailedService(id);
    return res.status(200).json({
      success: true,
      message: `Retrying failed recipients for "${campaign.name}"`,
      status: campaign.status,
    });
  } catch (err) {
    console.error("[WhatsAppBulk] Error retrying failed recipients:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to retry recipients",
    });
  }
}

/**
 * Delete a campaign
 */
export async function deleteCampaign(req, res) {
  try {
    const { id } = req.params;
    const campaign = await WhatsappCampaign.findById(id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    if (campaign.status === "running") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete a campaign that is currently running. Pause or cancel it first.",
      });
    }

    await WhatsappCampaign.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Campaign deleted successfully",
    });
  } catch (err) {
    console.error("[WhatsAppBulk] Error deleting campaign:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to delete campaign",
      error: err.message,
    });
  }
}

/**
 * Get WhatsApp Configuration (Baileys + Official Cloud API status)
 */
export async function getWhatsAppConfig(req, res) {
  try {
    const config = await getCloudApiConfig();
    const baileysAccount = await WhatsappAccount.findOne({
      status: "connected",
    });

    return res.status(200).json({
      success: true,
      config: {
        provider: config.provider || "baileys",
        cloudApi: {
          phoneNumberId: config.cloudApi?.phoneNumberId || "",
          wabaId: config.cloudApi?.wabaId || "",
          displayPhoneNumber: config.cloudApi?.displayPhoneNumber || "",
          apiVersion: config.cloudApi?.apiVersion || "v20.0",
          isConfigured: Boolean(config.cloudApi?.isConfigured),
          hasToken: Boolean(config.cloudApi?.accessToken),
        },
      },
      baileys: {
        status: baileysAccount ? "connected" : "disconnected",
        phoneNumber: baileysAccount?.phoneNumber || null,
        label: baileysAccount?.label || "default",
      },
    });
  } catch (err) {
    console.error("[WhatsAppBulk] Error fetching config:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to load WhatsApp configuration",
      error: err.message,
    });
  }
}

/**
 * Save / Update Official WhatsApp Cloud API Credentials
 */
export async function saveCloudApiConfig(req, res) {
  try {
    const {
      phoneNumberId,
      wabaId,
      accessToken,
      displayPhoneNumber,
      apiVersion,
      defaultProvider,
    } = req.body || {};

    const updated = await updateCloudApiConfig({
      phoneNumberId,
      wabaId,
      accessToken,
      displayPhoneNumber,
      apiVersion,
      defaultProvider,
    });

    return res.status(200).json({
      success: true,
      message: "Official WhatsApp Cloud API configuration saved successfully!",
      config: {
        provider: updated.provider,
        cloudApi: {
          phoneNumberId: updated.cloudApi?.phoneNumberId || "",
          wabaId: updated.cloudApi?.wabaId || "",
          displayPhoneNumber: updated.cloudApi?.displayPhoneNumber || "",
          apiVersion: updated.cloudApi?.apiVersion || "v20.0",
          isConfigured: updated.cloudApi?.isConfigured,
          hasToken: Boolean(updated.cloudApi?.accessToken),
        },
      },
    });
  } catch (err) {
    console.error("[WhatsAppBulk] Error saving cloud API config:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to save Official Cloud API configuration",
    });
  }
}

/**
 * Test Official WhatsApp Cloud API Connection with a test message
 */
export async function testCloudApi(req, res) {
  try {
    const {
      phoneNumberId,
      accessToken,
      testPhoneNumber,
      countryCode = "+971",
      apiVersion = "v20.0",
    } = req.body || {};

    let pId = phoneNumberId;
    let token = accessToken;

    if (!pId || !token) {
      const stored = await getCloudApiConfig();
      pId = pId || stored.cloudApi?.phoneNumberId;
      token = token || stored.cloudApi?.accessToken;
    }

    if (!pId || !token) {
      return res.status(400).json({
        success: false,
        message:
          "Phone Number ID and Access Token are required to test the connection.",
      });
    }

    if (!testPhoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Please enter a test recipient phone number.",
      });
    }

    const testRes = await testOfficialCloudApi({
      phoneNumberId: pId,
      accessToken: token,
      testPhoneNumber,
      countryCode,
      apiVersion,
    });

    return res.status(200).json({
      success: true,
      message: "Test message sent successfully via Official Meta Cloud API!",
      data: testRes,
    });
  } catch (err) {
    console.error("[WhatsAppBulk] Error testing cloud API:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Official Cloud API test failed",
    });
  }
}

