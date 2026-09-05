import { Router } from "express";
import { protect } from "../../../middlewares/auth.middleware";
import { onboardingController } from "../controllers/onboarding.controller";

const onboardingRouter = Router();

/**
 * @route   POST /api/v1/onboarding/organization
 * @desc    Complete Organization Setup & Multi-Tenant Provisioning
 * @access  Public
 */
onboardingRouter.post("/organization", onboardingController.onboardOrganization);

/**
 * @route   POST /api/v1/onboarding/validate-gstin
 * @desc    Validate GSTIN and decode state/PAN metadata
 * @access  Public
 */
onboardingRouter.post("/validate-gstin", onboardingController.validateGstin);

/**
 * @route   GET /api/v1/onboarding/check-name
 * @desc    Check organization name & domain availability
 * @access  Public
 */
onboardingRouter.get("/check-name", onboardingController.checkNameAvailability);

/**
 * @route   GET /api/v1/onboarding/plans
 * @desc    Get all available SaaS subscription plans
 * @access  Public
 */
onboardingRouter.get("/plans", onboardingController.getPlans);

/**
 * @route   GET /api/v1/onboarding/organization/:id
 * @desc    Get complete organization profile and setup status
 * @access  Private
 */
onboardingRouter.get(
  "/organization/:id",
  protect,
  onboardingController.getOrganizationDetails
);

/**
 * @route   GET /api/v1/onboarding/organizations
 * @desc    List all onboarded organizations / tenants
 * @access  Private
 */
onboardingRouter.get(
  "/organizations",
  protect,
  onboardingController.listOrganizations
);

export { onboardingRouter };
