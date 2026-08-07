const prisma = require("../config/db");

// ===================================================
// Shared validation helpers
// ===================================================

const VALID_DATE_TYPES = ["birth", "death"];
const VALID_CALENDARS = ["hijri", "gregorian"];

// Reasonable bounds so bad input (negative numbers, 5-digit typos, etc.)
// doesn't silently get stored. Adjust the upper bound as needed.
const CURRENT_GREGORIAN_YEAR = new Date().getFullYear();
const MIN_YEAR = 1;
const MAX_YEAR = CURRENT_GREGORIAN_YEAR + 1; // allow near-future/hijri offset slack

function validateDateType(date_type) {
  if (!VALID_DATE_TYPES.includes(date_type)) {
    return `date_type must be one of: ${VALID_DATE_TYPES.join(", ")}`;
  }
  return null;
}

function validateCalendar(calendar) {
  if (!VALID_CALENDARS.includes(calendar)) {
    return `calendar must be one of: ${VALID_CALENDARS.join(", ")}`;
  }
  return null;
}

// Returns { error, value } — value is the parsed int (or null if omitted)
function validateYear(year) {
  if (year === undefined || year === null || year === "") {
    return { error: null, value: null };
  }

  const parsed = Number(year);

  if (!Number.isInteger(parsed)) {
    return { error: "year must be a whole number", value: undefined };
  }
  if (parsed < MIN_YEAR || parsed > MAX_YEAR) {
    return { error: `year must be between ${MIN_YEAR} and ${MAX_YEAR}`, value: undefined };
  }

  return { error: null, value: parsed };
}

function validateRawText(raw_text) {
  if (raw_text === undefined || raw_text === null || raw_text === "") {
    return null;
  }
  if (typeof raw_text !== "string") {
    return "raw_text must be a string";
  }
  if (raw_text.length > 100) {
    return "raw_text must be 100 characters or fewer";
  }
  return null;
}

// ===================================================
// Create a date entry for a scholar version (standalone)
// ===================================================
// Each (version_id, date_type, calendar) combo can exist only once —
// enforced by the @@unique constraint in the schema. If one already
// exists, the caller should use updateDate instead of create.

exports.createDate = async (req, res) => {
  const { version_id, date_type, calendar, year, is_approximate, raw_text } = req.body;
  const userId = req.user.id;

  if (!version_id || !date_type || !calendar) {
    return res.status(400).json({
      success: false,
      message: "version_id, date_type, and calendar are required",
    });
  }

  const parsedVersionId = parseInt(version_id);
  if (Number.isNaN(parsedVersionId)) {
    return res.status(400).json({ success: false, message: "version_id must be a valid number" });
  }

  const dateTypeError = validateDateType(date_type);
  if (dateTypeError) {
    return res.status(400).json({ success: false, message: dateTypeError });
  }

  const calendarError = validateCalendar(calendar);
  if (calendarError) {
    return res.status(400).json({ success: false, message: calendarError });
  }

  const { error: yearError, value: parsedYear } = validateYear(year);
  if (yearError) {
    return res.status(400).json({ success: false, message: yearError });
  }

  const rawTextError = validateRawText(raw_text);
  if (rawTextError) {
    return res.status(400).json({ success: false, message: rawTextError });
  }

  if (is_approximate !== undefined && typeof is_approximate !== "boolean") {
    // allow "true"/"false" strings from form submissions, reject anything else
    if (is_approximate !== "true" && is_approximate !== "false") {
      return res.status(400).json({ success: false, message: "is_approximate must be a boolean" });
    }
  }

  try {
    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user || !user.allowed_to_contribute) {
      return res.status(403).json({ success: false, message: "You are not allowed to contribute" });
    }

    const version = await prisma.scholar_versions.findUnique({
      where: { version_id: parsedVersionId },
    });

    if (!version) {
      return res.status(404).json({ success: false, message: "Scholar version not found" });
    }

    const existing = await prisma.scholar_dates.findUnique({
      where: {
        version_id_date_type_calendar: {
          version_id: parsedVersionId,
          date_type,
          calendar,
        },
      },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `A ${date_type} date in the ${calendar} calendar already exists for this version — use update instead`,
      });
    }

    const date = await prisma.scholar_dates.create({
      data: {
        version_id: parsedVersionId,
        date_type, // "birth" | "death"
        calendar, // "hijri" | "gregorian"
        year: parsedYear,
        is_approximate: is_approximate === true || is_approximate === "true",
        raw_text: raw_text || null,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Date added",
      data: date,
    });
  } catch (error) {
    console.error("createDate error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ===================================================
// Get all date entries for a scholar version
// ===================================================

exports.getScholarDates = async (req, res) => {
  const versionId = parseInt(req.params.version_id);

  if (Number.isNaN(versionId)) {
    return res.status(400).json({ success: false, message: "version_id must be a valid number" });
  }

  try {
    const dates = await prisma.scholar_dates.findMany({
      where: { version_id: versionId },
      orderBy: { date_id: "asc" },
    });

    res.json({
      success: true,
      data: dates,
    });
  } catch (error) {
    console.error("getScholarDates error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ===================================================
// Update a date entry
// ===================================================
// date_type and calendar are intentionally NOT editable here — they're
// part of the unique-key identity of the row. To "change" a date's type
// or calendar, delete the row and create a new one instead.
// scholar_dates has no created_by column, so ownership is derived through
// the parent scholar_versions.created_by, same as references.

exports.updateDate = async (req, res) => {
  const dateId = parseInt(req.params.id);
  const userId = req.user.id;
  const { year, is_approximate, raw_text } = req.body;

  if (Number.isNaN(dateId)) {
    return res.status(400).json({ success: false, message: "Invalid date id" });
  }

  if (year === undefined && is_approximate === undefined && raw_text === undefined) {
    return res.status(400).json({
      success: false,
      message: "At least one of year, is_approximate, or raw_text must be provided",
    });
  }

  const { error: yearError, value: parsedYear } = validateYear(year);
  if (yearError) {
    return res.status(400).json({ success: false, message: yearError });
  }

  const rawTextError = validateRawText(raw_text);
  if (rawTextError) {
    return res.status(400).json({ success: false, message: rawTextError });
  }

  if (
    is_approximate !== undefined &&
    typeof is_approximate !== "boolean" &&
    is_approximate !== "true" &&
    is_approximate !== "false"
  ) {
    return res.status(400).json({ success: false, message: "is_approximate must be a boolean" });
  }

  try {
    const date = await prisma.scholar_dates.findUnique({
      where: { date_id: dateId },
      include: { scholar_versions: true },
    });

    if (!date) {
      return res.status(404).json({ success: false, message: "Date not found" });
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: { roles: true },
    });

    const isOwner = date.scholar_versions.created_by === userId;
    const isAdmin = user?.roles?.role_name === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: "Not authorized to edit this date" });
    }

    const updated = await prisma.scholar_dates.update({
      where: { date_id: dateId },
      data: {
        year: year !== undefined ? parsedYear : date.year,
        is_approximate:
          is_approximate !== undefined ? is_approximate === true || is_approximate === "true" : date.is_approximate,
        raw_text: raw_text !== undefined ? raw_text : date.raw_text,
      },
    });

    res.json({
      success: true,
      message: "Date updated",
      data: updated,
    });
  } catch (error) {
    console.error("updateDate error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ===================================================
// Delete a date entry
// ===================================================

exports.deleteDate = async (req, res) => {
  const dateId = parseInt(req.params.id);
  const userId = req.user.id;

  if (Number.isNaN(dateId)) {
    return res.status(400).json({ success: false, message: "Invalid date id" });
  }

  try {
    const date = await prisma.scholar_dates.findUnique({
      where: { date_id: dateId },
      include: { scholar_versions: true },
    });

    if (!date) {
      return res.status(404).json({ success: false, message: "Date not found" });
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: { roles: true },
    });

    const isOwner = date.scholar_versions.created_by === userId;
    const isAdmin = user?.roles?.role_name === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: "Not authorized to delete this date" });
    }

    await prisma.scholar_dates.delete({
      where: { date_id: dateId },
    });

    res.json({
      success: true,
      message: "Date deleted successfully",
    });
  } catch (error) {
    console.error("deleteDate error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};