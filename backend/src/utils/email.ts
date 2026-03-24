import nodemailer from 'nodemailer';
import { config } from '../config';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: config.smtpPass,
  },
});

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: nodemailer.Attachment[];
}) {
  return transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    ...opts,
  });
}
