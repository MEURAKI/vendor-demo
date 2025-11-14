// scripts/send-test.mjs
import 'dotenv/config';
import mailchimp from '@mailchimp/mailchimp_transactional';
console.log('🚀 Sending test email via Mailchimp Transactional (Mandrill)...', process.env);

const key = process.env.MAILCHIMP_TRANSACTIONAL_KEY;
if (!key) throw new Error('MAILCHIMP_TRANSACTIONAL_KEY missing');

const client = mailchimp(key);

try {
  const res = await client.messages.send({
    message: {
      from_email: 'no-reply@meuraki.com.sg',
      from_name: 'MEURAKI',
      to: [{ email: 'sachini456pieris@gmail.com', type: 'to' }],
      subject: 'Test Mandrill',
      html: '<p>✅ It works!</p>',
    },
  });

  console.log('✅ Sent successfully:', res);
} catch (err) {
  console.error('❌ Mandrill Error:', err.response?.body || err);
}