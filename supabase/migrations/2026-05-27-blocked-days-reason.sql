-- HK May 27 2026: blocked_days.reason for the Settings yearly planner.
-- Users can name their blocks ("Spring break with family") so the
-- yearly planner row can show meaningful chips instead of generic
-- "Block 1, Block 2." Same column used to group consecutive days
-- with the same reason into a single planner pill.
--
-- Optional column. NULL means anonymous block (existing rows stay
-- valid). Calendar grid in Schedule does not require this column;
-- it's purely for display in the yearly planner.

ALTER TABLE blocked_days ADD COLUMN IF NOT EXISTS reason TEXT;

COMMENT ON COLUMN blocked_days.reason IS
  'Optional human label for the block (e.g. Spring break, Thanksgiving). Used by the Settings yearly planner to group consecutive days with the same reason into one named block pill. NULL = anonymous block.';
