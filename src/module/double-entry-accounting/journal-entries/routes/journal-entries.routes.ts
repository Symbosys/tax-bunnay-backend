import { Router } from "express";
import { protect } from "../../../../middlewares/auth.middleware";
import { journalEntriesController } from "../controllers/journal-entries.controller";

const router = Router();

// Protect all journal entries routes with JWT authentication
router.use(protect);

/**
 * 1. Chart of Accounts Dropdown for Dr/Cr selection
 * Note: Must be placed BEFORE /:id route
 */
router.get("/accounts", journalEntriesController.getAccounts);

/**
 * 2. Export Journal Day Book
 * Note: Must be placed BEFORE /:id route
 */
router.get("/export", journalEntriesController.exportJournals);
router.post("/export", journalEntriesController.exportJournals);

/**
 * 3. Journal Entries List & Summaries (with KPIs, filters, pagination)
 */
router.get("/", journalEntriesController.getJournalEntries);
router.get("/summary", journalEntriesController.getJournalEntries);

/**
 * 4. Create new Double-Entry Journal Entry
 */
router.post("/", journalEntriesController.createJournalEntry);

/**
 * 5. Single Journal Entry Detail with all legs
 */
router.get("/:id", journalEntriesController.getJournalDetail);

/**
 * 6. Update Journal Entry
 */
router.put("/:id", journalEntriesController.updateJournalEntry);

/**
 * 7. Void Journal Entry
 */
router.post("/:id/void", journalEntriesController.voidJournalEntry);

/**
 * 8. Delete Journal Entry
 */
router.delete("/:id", journalEntriesController.deleteJournalEntry);

export default router;
export { router as journalEntriesRouter };
