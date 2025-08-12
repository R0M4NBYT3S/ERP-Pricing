const { sendEmail } = require('./utils/mailer');
app.post('/api/utils/test-email', async (_req, res) => {
  try {
    await sendEmail({ subject: 'SMTP smoke test', text: 'SMTP is configured.' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e) });
  }
});
