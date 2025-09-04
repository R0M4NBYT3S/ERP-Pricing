const express = require('express');
const router = express.Router();
const Jobs = require('../db/jobs');
const { authRequired, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const path = require('path');
const fs = require('fs');

// 📌 Create a new job (admin/office only)
router.post('/', authRequired, requireRole(['admin', 'office']), async (req, res) => {
  try {
    const job = await Jobs.createJob(req.body);
    res.status(201).json(job);
  } catch (err) {
    console.error('Error creating job:', err);
    res.status(500).json({ error: err.message });
  }
});

// 📌 List jobs (with filters + pagination)
router.get('/', authRequired, async (req, res) => {
  try {
    const filters = {
      status: req.query.status || null,
      search: req.query.search || null,
      customer: req.query.customer || null,
      po: req.query.po || null,
      startDate: req.query.startDate || null,
      endDate: req.query.endDate || null,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : 50,
      offset: req.query.offset ? parseInt(req.query.offset, 10) : 0,
    };

    const { total, limit, offset, jobs } = await Jobs.listJobs(filters);

    res.json({
      total,
      limit,
      offset,
      jobs,
    });
  } catch (err) {
    console.error('Error listing jobs:', err);
    res.status(500).json({ error: err.message });
  }
});

// 📌 Get a job by ID
router.get('/:id', authRequired, async (req, res) => {
  try {
    const job = await Jobs.getJobById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err) {
    console.error('Error fetching job:', err);
    res.status(500).json({ error: err.message });
  }
});

// 📌 Update job status
router.patch('/:id/status', authRequired, requireRole(['admin', 'office', 'shop']), async (req, res) => {
  try {
    const { status, notes } = req.body;
    const job = await Jobs.updateJobStatus(req.params.id, status, req.user.id, notes);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err) {
    console.error('Error updating job status:', err);
    res.status(500).json({ error: err.message });
  }
});

// 📌 Advance job to next status
router.patch('/:id/advance', authRequired, requireRole(['admin', 'office', 'shop']), async (req, res) => {
  try {
    const updated = await Jobs.advanceJobStatus(req.params.id, req.user.id, req.body.notes || null);
    res.json(updated);
  } catch (err) {
    console.error('Error advancing job:', err);
    res.status(500).json({ error: err.message });
  }
});

// 📌 Get full job history
router.get('/:id/history', authRequired, requireRole(['admin', 'office', 'shop']), async (req, res) => {
  try {
    const history = await Jobs.getJobHistory(req.params.id);
    res.json(history);
  } catch (err) {
    console.error('Error fetching job history:', err);
    res.status(500).json({ error: err.message });
  }
});

// 📌 Upload an attachment
router.post(
  '/:id/attachments',
  authRequired,
  requireRole(['admin', 'office', 'shop']),
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const fileUrl = `/uploads/jobs/${req.params.id}/${req.file.filename}`;
      const fileType = req.file.mimetype;

      const attachment = await Jobs.addAttachment(
        req.params.id,
        fileUrl,
        fileType,
        req.user.id
      );

      res.status(201).json(attachment);
    } catch (err) {
      console.error('Error uploading attachment:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// 📌 List all attachments for a job
router.get('/:id/attachments', authRequired, async (req, res) => {
  try {
    const attachments = await Jobs.listAttachments(req.params.id);
    res.json(attachments);
  } catch (err) {
    console.error('Error fetching attachments:', err);
    res.status(500).json({ error: err.message });
  }
});

// 📌 Download an attachment by ID
router.get('/attachments/:attachmentId/download', authRequired, async (req, res) => {
  try {
    const attachment = await Jobs.getAttachmentById(req.params.attachmentId);
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const relativePath = attachment.file_url.replace(/^\/uploads/, 'uploads');
    const filePath = path.join(__dirname, '..', relativePath);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File missing on server' });
    }

    res.download(filePath, path.basename(filePath));
  } catch (err) {
    console.error('Error downloading attachment:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
