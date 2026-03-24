ALTER TABLE "invoices" ADD COLUMN "stripe_payment_intent_id" varchar(255);
ALTER TABLE "invoices" ADD COLUMN "stripe_checkout_session_id" varchar(255);
ALTER TABLE "invoices" ADD COLUMN "payment_method" varchar(50);
