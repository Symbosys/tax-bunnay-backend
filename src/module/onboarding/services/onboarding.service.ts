import bcrypt from "bcrypt";
import env from "../../../config/env.config";
import { signToken } from "../../../utils/jwt.util";
import { ErrorResponse } from "../../../utils/response.util";
import { onboardingRepo, OnboardingRepository } from "../repo/onboarding.repo";
import type {
  OnboardOrganizationInput,
  ValidateGstinInput,
  CheckNameAvailabilityInput,
} from "../validators/onboarding.validators";
import type { GstRegistrationType, BillingCycle } from "../../../generated/prisma/client";

/**
 * Standard Indian State Code Mapping for GSTIN
 */
const GST_STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "25": "Daman & Diu",
  "26": "Dadra & Nagar Haveli",
  "27": "Maharashtra",
  "28": "Andhra Pradesh (Old)",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman & Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh (New)",
  "38": "Ladakh",
  "97": "Other Territory",
  "99": "Centre Jurisdiction",
};

export class OnboardingService {
  private repo: OnboardingRepository;

  constructor(repo: OnboardingRepository = onboardingRepo) {
    this.repo = repo;
  }

  /**
   * Helper to strip sensitive fields from user object
   */
  private sanitizeUser(user: any) {
    const { passwordHash, twoFactorSecret, ...sanitized } = user;
    return sanitized;
  }

  /**
   * Complete multi-tenant Organization Onboarding
   */
  async onboardOrganization(
    input: OnboardOrganizationInput,
    meta?: { ipAddress?: string; platform?: string; deviceInfo?: string }
  ) {
    const orgName = input.organizationName.trim();
    const adminEmail = (input.adminEmail || input.email).toLowerCase().trim();

    // 1. Check for duplicate organization name owned by a different user
    const existingOrg = await this.repo.findBusinessByName(orgName);
    if (existingOrg && existingOrg.owner?.email.toLowerCase() !== adminEmail) {
      throw new ErrorResponse(
        `An organization named "${orgName}" is already registered by another account. Please choose a distinct name.`,
        409
      );
    }

    // 2. Check for duplicate GSTIN if supplied
    if (input.gstin && input.gstin.trim().length > 0) {
      const existingGstin = await this.repo.findBusinessByGstin(input.gstin.trim());
      if (existingGstin && existingGstin.id !== existingOrg?.id) {
        throw new ErrorResponse(
          `The GSTIN "${input.gstin.toUpperCase()}" is already registered to "${existingGstin.businessName}".`,
          409
        );
      }
    }

    // 3. Hash administrator master password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(input.password, saltRounds);

    // 4. Assemble address strings
    const combinedAddress = [
      input.addressLine1,
      input.addressLine2,
      input.city,
      input.state,
      input.pinCode ? `PIN: ${input.pinCode}` : null,
    ]
      .filter(Boolean)
      .join(", ");

    const businessAddress = input.businessAddress || combinedAddress || null;
    const billingAddress = input.billingAddress || businessAddress;
    const shippingAddress = input.shippingAddress || businessAddress;

    // 5. Parse dates
    let fyStart: Date | null = null;
    if (input.financialYearStart) {
      fyStart = new Date(input.financialYearStart);
      if (isNaN(fyStart.getTime())) fyStart = new Date();
    }

    let booksStart: Date | null = null;
    if (input.booksStartingDate) {
      booksStart = new Date(input.booksStartingDate);
      if (isNaN(booksStart.getTime())) booksStart = new Date();
    }

    // 6. Execute atomic multi-table setup transaction
    const result = await this.repo.createOrganizationWithSetup({
      ownerData: {
        fullName: input.adminName.trim(),
        email: adminEmail,
        passwordHash,
        phone: input.mobileNumber.trim(),
      },
      businessData: {
        businessName: orgName,
        legalName: input.legalName?.trim() || orgName,
        tradeName: input.tradeName?.trim() || orgName,
        gstin: input.gstin?.trim() || null,
        pan: input.pan?.trim() || null,
        tan: input.tan?.trim() || null,
        cinOrLlpin: input.cinOrLlpin?.trim() || null,
        businessAddress,
        billingAddress,
        shippingAddress,
        state: input.state?.trim() || null,
        pinCode: input.pinCode?.trim() || null,
        email: input.email.toLowerCase().trim(),
        mobileNumber: input.mobileNumber.trim(),
        financialYearStart: fyStart,
        booksStartingDate: booksStart,
        gstRegistrationType: (input.gstRegistrationType || "REGULAR") as GstRegistrationType,
        logoUrl: input.logoUrl || null,
      },
      planName: input.planName || "Growth",
      billingCycle: (input.billingCycle || "MONTHLY") as BillingCycle,
    });

    // 7. Generate JWT access and refresh tokens
    const jwtPayload = {
      id: result.user.id,
      email: result.user.email,
      fullName: result.user.fullName,
      businessId: result.business.id,
      role: "OWNER",
      isPlatformAdmin: result.user.isPlatformAdmin,
    };

    const accessToken = signToken(
      jwtPayload,
      env.jwt.secret || "123456",
      7 * 24 * 60 * 60
    ); // 7 days
    const refreshToken = signToken(
      { id: result.user.id, businessId: result.business.id, type: "refresh" },
      env.jwt.secret || "123456",
      30 * 24 * 60 * 60 // 30 days
    );

    return {
      organization: {
        id: result.business.id,
        businessName: result.business.businessName,
        tradeName: result.business.tradeName,
        gstin: result.business.gstin,
        pan: result.business.pan,
        email: result.business.email,
        mobileNumber: result.business.mobileNumber,
        state: result.business.state,
        pinCode: result.business.pinCode,
        logoUrl: result.business.logoUrl,
        createdAt: result.business.createdAt,
      },
      adminUser: this.sanitizeUser(result.user),
      subscription: {
        id: result.subscription.id,
        planName: result.plan.name,
        price: result.plan.price,
        status: result.subscription.status,
        billingCycle: result.subscription.billingCycle,
        trialEndsAt: result.subscription.trialEndsAt,
        currentPeriodEnd: result.subscription.currentPeriodEnd,
      },
      defaultWarehouse: {
        id: result.warehouse.id,
        name: result.warehouse.name,
      },
      defaultInvoiceSeries: {
        id: result.invoiceSeries.id,
        seriesName: result.invoiceSeries.seriesName,
        prefix: result.invoiceSeries.prefix,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  /**
   * Validate GSTIN structure & decode state/PAN metadata
   */
  async validateGstin(input: ValidateGstinInput) {
    const gstin = input.gstin.trim().toUpperCase();

    const stateCode = gstin.substring(0, 2);
    const pan = gstin.substring(2, 12);
    const entityNumber = gstin.substring(12, 13);
    const checkDigit = gstin.substring(14, 15);

    const stateName = GST_STATE_CODES[stateCode] || "Unknown State / Union Territory";

    // Fourth character of PAN indicates entity type
    const panEntityTypeChar = pan.charAt(3);
    const entityTypes: Record<string, string> = {
      C: "Company",
      P: "Individual / Proprietorship",
      H: "Hindu Undivided Family (HUF)",
      F: "Partnership Firm / LLP",
      A: "Association of Persons (AOP)",
      T: "Trust",
      B: "Body of Individuals (BOI)",
      L: "Local Authority",
      J: "Artificial Juridical Person",
      G: "Government Agency",
    };

    const entityType = entityTypes[panEntityTypeChar] || "Registered Entity";

    // Check if GSTIN already exists in our system
    const existing = await this.repo.findBusinessByGstin(gstin);

    return {
      isValid: true,
      gstin,
      stateCode,
      stateName,
      pan,
      entityNumber,
      checkDigit,
      entityType,
      isAlreadyRegisteredInPlatform: !!existing,
      registeredBusinessName: existing?.businessName || null,
    };
  }

  /**
   * Check organization name & domain availability
   */
  async checkOrganizationName(input: CheckNameAvailabilityInput) {
    const name = input.name.trim();
    const existing = await this.repo.findBusinessByName(name);
    const domainSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .substring(0, 30);

    return {
      isAvailable: !existing,
      name,
      suggestedSubdomain: `${domainSlug}.billing-erp.in`,
      existingOrganizationId: existing?.id || null,
    };
  }

  /**
   * Retrieve available SaaS plans
   */
  async getAvailablePlans() {
    return this.repo.getAllActivePlans();
  }

  /**
   * Retrieve organization onboarding details by ID
   */
  async getOrganizationDetails(id: string) {
    const business = await this.repo.findBusinessById(id);
    if (!business) {
      throw new ErrorResponse("Organization not found", 404);
    }
    return business;
  }

  /**
   * List all onboarded organizations for Platform Admin dashboard
   */
  async listRecentOrganizations(limit: number = 20, offset: number = 0) {
    return this.repo.listRecentOrganizations(limit, offset);
  }
}

export const onboardingService = new OnboardingService();
