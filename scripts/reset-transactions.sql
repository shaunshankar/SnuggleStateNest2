-- ============================================================
-- Reset transactions — start fresh
-- Run in the Neon SQL editor.
-- ============================================================
--
-- This deletes transactions for YOUR household. It does NOT touch
-- bills, budgets, savings goals, or savings contributions.
--
-- NOTE on savings: contributing to a goal creates BOTH a savings
-- contribution AND a transaction. Deleting transactions here leaves
-- your goals' balances and the contribution history intact. See the
-- optional "fuller reset" block at the bottom if you want those gone too.
--
-- Change the email below if needed. It is scoped to the household
-- linked to this user, so a fresh import won't collide with old rows.

-- ── STEP 1: Preview — how many rows will be deleted? ────────────
SELECT COUNT(*) AS will_delete
FROM nest.transactions
WHERE household_id = (
  SELECT household_id FROM nest.users WHERE email = 'shaunshankar1@gmail.com'
);

-- ── STEP 2: Delete. Run this only after checking the count above ─
DELETE FROM nest.transactions
WHERE household_id = (
  SELECT household_id FROM nest.users WHERE email = 'shaunshankar1@gmail.com'
);

-- ── STEP 3 (optional): Confirm it's empty ──────────────────────
-- SELECT COUNT(*) AS remaining
-- FROM nest.transactions
-- WHERE household_id = (
--   SELECT household_id FROM nest.users WHERE email = 'shaunshankar1@gmail.com'
-- );


-- ============================================================
-- OPTIONAL: only-my-own rows (not the whole household)
-- Use this INSTEAD of STEP 2 if you share a household and only
-- want to remove transactions you personally created.
-- ============================================================
-- DELETE FROM nest.transactions
-- WHERE household_id = (SELECT household_id FROM nest.users WHERE email = 'shaunshankar1@gmail.com')
--   AND user_email = 'shaunshankar1@gmail.com';


-- ============================================================
-- OPTIONAL: fuller reset — also wipe savings contributions and
-- reset goal balances + bill paid-status. ONLY if you want a
-- completely clean slate. Uncomment to use.
-- ============================================================
-- WITH hh AS (SELECT household_id AS id FROM nest.users WHERE email = 'shaunshankar1@gmail.com')
-- DELETE FROM nest.savings_contributions WHERE household_id = (SELECT id FROM hh);
--
-- UPDATE nest.savings_goals
--   SET current_amount = 0
--   WHERE household_id = (SELECT household_id FROM nest.users WHERE email = 'shaunshankar1@gmail.com');
--
-- UPDATE nest.bills
--   SET is_paid = false, paid_date = NULL
--   WHERE household_id = (SELECT household_id FROM nest.users WHERE email = 'shaunshankar1@gmail.com');
