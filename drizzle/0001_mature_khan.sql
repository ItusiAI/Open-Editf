CREATE TABLE "affiliate_earnings" (
	"id" text PRIMARY KEY NOT NULL,
	"affiliateId" text NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'FROZEN' NOT NULL,
	"releaseDate" timestamp NOT NULL,
	"stripeOrderId" text,
	"relationId" text,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "affiliate_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"code" text NOT NULL,
	"codeChanged" boolean DEFAULT false NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"frozenBalance" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	CONSTRAINT "affiliate_profiles_userId_unique" UNIQUE("userId"),
	CONSTRAINT "affiliate_profiles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "affiliate_relations" (
	"id" text PRIMARY KEY NOT NULL,
	"referrerId" text NOT NULL,
	"inviteeId" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"hasConverted" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	CONSTRAINT "affiliate_relations_inviteeId_unique" UNIQUE("inviteeId"),
	CONSTRAINT "affiliate_relation_invitee_unique" UNIQUE("inviteeId")
);
--> statement-breakpoint
CREATE TABLE "affiliate_withdrawals" (
	"id" text PRIMARY KEY NOT NULL,
	"affiliateId" text NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"paymentMethod" text NOT NULL,
	"accountName" text NOT NULL,
	"accountInfo" text NOT NULL,
	"transactionId" text,
	"failureReason" text,
	"processedAt" timestamp,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "generationHistory" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"prompt" text NOT NULL,
	"imageUrls" text NOT NULL,
	"model" text NOT NULL,
	"aspectRatio" text,
	"resolution" text,
	"pointsUsed" integer NOT NULL,
	"requestId" text,
	"seed" text,
	"description" text,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "referralHistory" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"referralId" text,
	"action" text NOT NULL,
	"description" text,
	"pointsAwarded" integer,
	"subscriptionDaysExtended" integer,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" text PRIMARY KEY NOT NULL,
	"referrerId" text NOT NULL,
	"referredId" text NOT NULL,
	"referralCode" text NOT NULL,
	"hasSubscribed" boolean DEFAULT false,
	"subscriptionRewarded" boolean DEFAULT false,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "hasTrialSubscription" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referralCode" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referralCodeChanged" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referredBy" text;--> statement-breakpoint
ALTER TABLE "affiliate_earnings" ADD CONSTRAINT "affiliate_earnings_affiliateId_affiliate_profiles_id_fk" FOREIGN KEY ("affiliateId") REFERENCES "public"."affiliate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_earnings" ADD CONSTRAINT "affiliate_earnings_relationId_affiliate_relations_id_fk" FOREIGN KEY ("relationId") REFERENCES "public"."affiliate_relations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_profiles" ADD CONSTRAINT "affiliate_profiles_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_relations" ADD CONSTRAINT "affiliate_relations_referrerId_affiliate_profiles_id_fk" FOREIGN KEY ("referrerId") REFERENCES "public"."affiliate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_relations" ADD CONSTRAINT "affiliate_relations_inviteeId_users_id_fk" FOREIGN KEY ("inviteeId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_withdrawals" ADD CONSTRAINT "affiliate_withdrawals_affiliateId_affiliate_profiles_id_fk" FOREIGN KEY ("affiliateId") REFERENCES "public"."affiliate_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generationHistory" ADD CONSTRAINT "generationHistory_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referralHistory" ADD CONSTRAINT "referralHistory_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referralHistory" ADD CONSTRAINT "referralHistory_referralId_referrals_id_fk" FOREIGN KEY ("referralId") REFERENCES "public"."referrals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrerId_users_id_fk" FOREIGN KEY ("referrerId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referredId_users_id_fk" FOREIGN KEY ("referredId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "affiliate_earning_affiliate_idx" ON "affiliate_earnings" USING btree ("affiliateId");--> statement-breakpoint
CREATE INDEX "affiliate_earning_status_idx" ON "affiliate_earnings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "affiliate_earning_release_date_idx" ON "affiliate_earnings" USING btree ("releaseDate");--> statement-breakpoint
CREATE INDEX "affiliate_earning_stripe_order_idx" ON "affiliate_earnings" USING btree ("stripeOrderId");--> statement-breakpoint
CREATE INDEX "affiliate_code_idx" ON "affiliate_profiles" USING btree ("code");--> statement-breakpoint
CREATE INDEX "affiliate_user_id_idx" ON "affiliate_profiles" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "affiliate_relation_referrer_idx" ON "affiliate_relations" USING btree ("referrerId");--> statement-breakpoint
CREATE INDEX "affiliate_relation_invitee_idx" ON "affiliate_relations" USING btree ("inviteeId");--> statement-breakpoint
CREATE INDEX "affiliate_withdrawal_affiliate_idx" ON "affiliate_withdrawals" USING btree ("affiliateId");--> statement-breakpoint
CREATE INDEX "affiliate_withdrawal_status_idx" ON "affiliate_withdrawals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "affiliate_withdrawal_created_at_idx" ON "affiliate_withdrawals" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "generation_history_user_id_idx" ON "generationHistory" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "generation_history_type_idx" ON "generationHistory" USING btree ("type");--> statement-breakpoint
CREATE INDEX "generation_history_created_at_idx" ON "generationHistory" USING btree ("createdAt");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_referralCode_unique" UNIQUE("referralCode");