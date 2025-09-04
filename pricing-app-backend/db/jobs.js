// db/jobs.js
const db = require('./index');

/**
 * Create a new job
 */
async function createJob(data) {
  const {
    customer_name,
    po_number,
    address,
    email,
    phone,
    product_type,
    metal_type,
    delivery_or_install,
    price,
    cut_sheet_url,
    nesting_file_url,
  } = data;

  const result = await db.query(
    `INSERT INTO jobs (
      customer_name, po_number, address, email, phone,
      product_type, metal_type, delivery_or_install,
      price, cut_sheet_url, nesting_file_url
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING *`,
    [
      customer_name, po_number, address, email, phone,
      product_type, metal_type, delivery_or_install,
      price, cut_sheet_url, nesting_file_url
    ]
  );

  return result.rows[0];
}

/**
 * Get job by ID
 */
async function getJobById(id) {
  const result = await db.query(`SELECT * FROM jobs WHERE id = $1`, [id]);
  return result.rows[0];
}

/**
 * List jobs with optional filters + pagination
 */
async function listJobs(filters = {}) {
  const { status, search, customer, po, startDate, endDate, limit = 50, offset = 0 } = filters;

  let conditions = [];
  let params = [];
  let idx = 1;

  if (status) {
    conditions.push(`status = $${idx++}`);
    params.push(status);
  }

  if (search) {
    conditions.push(`(
      customer_name ILIKE $${idx} OR
      po_number ILIKE $${idx} OR
      product_type ILIKE $${idx} OR
      metal_type ILIKE $${idx}
    )`);
    params.push(`%${search}%`);
    idx++;
  }

  if (customer) {
    conditions.push(`customer_name ILIKE $${idx++}`);
    params.push(`%${customer}%`);
  }

  if (po) {
    conditions.push(`po_number ILIKE $${idx++}`);
    params.push(`%${po}%`);
  }

  if (startDate && endDate) {
    conditions.push(`created_at BETWEEN $${idx++} AND $${idx++}`);
    params.push(startDate, endDate);
  }

  let baseSql = `FROM jobs`;
  if (conditions.length > 0) {
    baseSql += ` WHERE ${conditions.join(' AND ')}`;
  }

  // total count
  const countResult = await db.query(`SELECT COUNT(*) ${baseSql}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  // paginated results
  let sql = `SELECT * ${baseSql} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
  const result = await db.query(sql, [...params, limit, offset]);

  return {
    total,
    limit,
    offset,
    jobs: result.rows,
  };
}

/**
 * Record job history entry
 */
async function recordJobHistory(jobId, fromStatus, toStatus, userId = null, notes = null) {
  await db.query(
    `INSERT INTO job_history (job_id, from_status, to_status, user_id, notes)
     VALUES ($1,$2,$3,$4,$5)`,
    [jobId, fromStatus, toStatus, userId, notes]
  );
}

/**
 * Update job status + record in job_history
 */
async function updateJobStatus(jobId, newStatus, userId = null, notes = null) {
  const job = await getJobById(jobId);
  if (!job) throw new Error('Job not found');

  const result = await db.query(
    `UPDATE jobs
     SET status = $1, updated_at = now()
     WHERE id = $2
     RETURNING *`,
    [newStatus, jobId]
  );

  await recordJobHistory(jobId, job.status, newStatus, userId, notes);
  return result.rows[0];
}

/**
 * Advance job to the next status in the enum
 */
async function advanceJobStatus(jobId, userId = null, notes = null) {
  const job = await getJobById(jobId);
  if (!job) throw new Error('Job not found');

  const enumResult = await db.query(
    `SELECT enumlabel 
     FROM pg_enum
     JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
     WHERE pg_type.typname = 'job_status'
     ORDER BY enumsortorder`
  );
  const statuses = enumResult.rows.map(r => r.enumlabel);

  const currentIndex = statuses.indexOf(job.status);
  if (currentIndex === -1 || currentIndex === statuses.length - 1) {
    throw new Error(`Cannot advance job status from: ${job.status}`);
  }

  const nextStatus = statuses[currentIndex + 1];
  return await updateJobStatus(jobId, nextStatus, userId, notes);
}

/**
 * Fetch job history with user info
 */
async function getJobHistory(jobId) {
  const result = await db.query(
    `SELECT h.id, h.from_status, h.to_status, h.notes, h.created_at,
            u.id as user_id, u.name as user_name, u.email as user_email
     FROM job_history h
     LEFT JOIN users u ON u.id = h.user_id
     WHERE h.job_id = $1
     ORDER BY h.created_at ASC`,
    [jobId]
  );
  return result.rows;
}

/**
 * Add an attachment to a job
 */
async function addAttachment(jobId, file_url, file_type, uploaded_by) {
  const res = await db.query(
    `INSERT INTO attachments (job_id, file_url, file_type, uploaded_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [jobId, file_url, file_type, uploaded_by]
  );
  return res.rows[0];
}

/**
 * List job attachments
 */
async function listAttachments(jobId) {
  const result = await db.query(
    `SELECT * FROM attachments WHERE job_id = $1 ORDER BY uploaded_at ASC`,
    [jobId]
  );
  return result.rows;
}

/**
 * Get a single attachment by ID
 */
async function getAttachmentById(id) {
  const result = await db.query(
    `SELECT * FROM attachments WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

module.exports = {
  createJob,
  getJobById,
  listJobs,
  updateJobStatus,
  advanceJobStatus,
  getJobHistory,
  recordJobHistory,
  addAttachment,
  listAttachments,
  getAttachmentById,
};
